import React, { useState, useCallback, useRef, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import './App.css'
import { supabase } from './supabase'
import Auth from './Auth'
import { WalletWidget } from './components/Wallet'
import { N8N_WEBHOOK_URL, MODALITIES } from './config/constants'
import { MODEL_REGISTRY, MODEL_SCHEMAS, getModelOptions, getModelHint } from './config/modelRegistry'
import { enhancePrompt } from './services/geminiService'
import { calculatePreviewCost, formatCost, updateModelPricing } from './pricing/PricingEngine'
import { useDriveMedia } from './hooks/useDriveMedia'
import { genId, deleteVariant, getDriveDisplayUrl } from './utils/assetUtils'
import NodeCanvas from './NodeCanvas'
import EntityTaskCard from './components/EntityTaskCard'
import LogMonitor from './components/LogMonitor'
import useGlobalTactile from './hooks/useGlobalTactile'

// ─── STATUS COLORS ─────────────────────────
const STATUS = { done:'var(--ok)', pending:'var(--warn)', error:'var(--err)', processing:'var(--cyan)', ready:'var(--t3)' }
const CAT_ICONS = { image:'🖼', video:'🎬', audio:'🎵', '3d':'🧊', lipsync:'💋' }
const MODE_TO_CAT = { shot:'image', sandbox:'image', edit:'image', audio:'audio', '3d':'3d' }

// ─── MAIN APP ──────────────────────────────
function App() {
  const [session, setSession] = useState(null)
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [contract, setContract] = useState({ characters:[], props:[], environments:[], shots:[] })
  const [selectedShot, setSelectedShot] = useState(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [assetsOpen, setAssetsOpen] = useState(false)
  const [assetTab, setAssetTab] = useState('chars')
  const [shareOpen, setShareOpen] = useState(false)
  const [view, setView] = useState('canvas')
  const [mode, setMode] = useState('shot')
  const [promptText, setPromptText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState(0)
  const [genLabel, setGenLabel] = useState('No active jobs')
  const [sessionCost, setSessionCost] = useState(0)
  const [glogOpen, setGlogOpen] = useState(true)
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [dockTab, setDockTab] = useState('queue')
  const [shareData, setShareData] = useState({token:null, visibility:'private', invites:[]})
  const [inviteEmail, setInviteEmail] = useState('')
  const [logs, setLogs] = useState([{type:'ok',icon:'✓',msg:'System ready'}])
  const [modelCategories, setModelCategories] = useState({})
  const [pipelineStep, setPipelineStep] = useState(0)
  const promptRef = useRef(null)

  // ─── GLOBAL TACTILE HAPTICS (P13 FIX) ────
  useGlobalTactile();

  // ─── AUTH ─────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({data:{session:s}}) => setSession(s))
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // ─── LOAD MODELS FROM DB ─────────────────
  useEffect(() => {
    if (!session) return
    ;(async () => {
      const { data } = await supabase.from('ai_models').select('id,title,category,provider,pricing_base,pricing_type,pricing_desc,pricing_multipliers,variables_schema').eq('is_active', true)
      if (!data) return
      const cats = {}
      data.forEach(m => {
        const cat = m.category || 'other'
        if (!cats[cat]) cats[cat] = []
        cats[cat].push(m)
      })
      setModelCategories(cats)
      // Populate MODEL_REGISTRY
      Object.keys(cats).forEach(cat => {
        const byProvider = {}
        cats[cat].forEach(m => {
          const p = m.provider || 'fal-ai'
          if (!byProvider[p]) byProvider[p] = { company: p, models: [] }
          byProvider[p].models.push({ id: m.id, name: m.title })
        })
        MODEL_REGISTRY[cat] = Object.values(byProvider)
      })
      // Populate schemas
      data.forEach(m => {
        if (m.variables_schema && Array.isArray(m.variables_schema) && m.variables_schema.length > 0) {
          MODEL_SCHEMAS[m.id] = m.variables_schema
        }
      })
      // Populate DYNAMIC_PRICING
      data.forEach(m => {
        if (m.pricing_base !== undefined && m.pricing_type) {
          updateModelPricing(m.id, {
            base: Number(m.pricing_base),
            type: m.pricing_type,
            desc: m.pricing_desc || '',
            multipliers: m.pricing_multipliers || {}
          })
        }
      })
      addLog('ok','✓',`${data.length} models loaded`)
    })()
  }, [session])

  // ─── LOAD PROJECTS ────────────────────────
  useEffect(() => {
    if (!session) return
    ;(async () => {
      const { data } = await supabase.from('projects').select('*').eq('profile_id', session.user.id).order('created_at')
      if (data && data.length > 0) {
        setProjects(data)
        setActiveProject(data[0])
        if (data[0].contract) {
          const c = typeof data[0].contract === 'string' ? JSON.parse(data[0].contract) : data[0].contract
          setContract({
            characters: c.characters || c.registry?.characters || [],
            props: c.props || c.registry?.props || [],
            environments: c.environments || c.registry?.locations || c.registry?.environments || [],
            shots: c.shots || c.must_show?.map((ms,i) => ({
              id: ms.ms_id || `SHOT_${i}`, title: ms.description?.substring(0,40) || `Shot ${i+1}`,
              prompt: ms.description || '', model: 'fal-ai/flux-pro/v1.1', cat:'image',
              status:'pending', res:'1080p', dur:'5s', ar:'16:9', entities:[]
            })) || []
          })
          addLog('ok','✓',`Project "${data[0].name}" loaded`)
        }
      }
    })()
  }, [session])

  // ─── MEDIA SYNC ───────────────────────────
  const { media, refresh: refreshMedia } = useDriveMedia(
    activeProject?.id, 'project', session
  )

  // ─── REAL-TIME LOGS ───────────────────────
  useEffect(() => {
    if (!session) return
    const ch = supabase.channel('rf_logs')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'renderfarm_logs' }, (payload) => {
        const l = payload.new
        addLog(l.level === 'error' ? 'err' : l.level === 'warn' ? 'run' : 'ok', 
          l.level === 'error' ? '✗' : l.level === 'warn' ? '⟳' : '✓', l.message || '')
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [session])

  // ─── REAL-TIME OUTPUT STATUS ──────────────
  useEffect(() => {
    if (!session) return
    const ch = supabase.channel('rf_outputs')
      .on('postgres_changes', { event:'*', schema:'public', table:'renderfarm_outputs',
        filter: `profile_id=eq.${session.user.id}` }, (payload) => {
        const o = payload.new
        if (o.status === 'ready') {
          setGenerating(false)
          setGenProgress(0)
          setGenLabel('No active jobs')
          refreshMedia()
          addLog('ok','✓', `Output ready: ${o.file_name || o.task_id}`)
          setPipelineStep(3)
        } else if (o.status === 'processing') {
          setGenProgress(o.progress || 50)
          setGenLabel(o.status_message || 'Processing…')
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [session, refreshMedia])

  // Sync session cost from loaded media
  useEffect(() => {
    const cost = media.reduce((acc, m) => acc + (parseFloat(m.actual_cost) || parseFloat(m.estimated_cost) || 0), 0)
    setSessionCost(cost)
  }, [media])

  // ─── HELPERS ──────────────────────────────
  function addLog(type, icon, msg) {
    setLogs(prev => [...prev.slice(-30), { type, icon, msg, ts: Date.now() }])
  }

  // ─── PERSIST CONTRACT TO SUPABASE ─────────
  const persistContract = useCallback(async (newContract) => {
    if (!activeProject?.id) return
    try {
      await supabase.from('projects').update({ contract: newContract }).eq('id', activeProject.id)
    } catch(e) { console.error('Persist error:', e) }
  }, [activeProject])


  // ─── CREATE PROJECT ───────────────────────
  const createProject = useCallback(async (name) => {
    if (!name.trim() || !session) return
    const { data, error } = await supabase.from('projects').insert({
      name: name.trim(), profile_id: session.user.id, contract: { characters:[], props:[], environments:[], shots:[] }
    }).select().single()
    if (error) { toast.error(error.message); return }
    setProjects(prev => [...prev, data])
    setActiveProject(data)
    setContract({ characters:[], props:[], environments:[], shots:[] })
    setShowNewProject(false)
    setNewProjectName('')
    addLog('ok','✓',`Project "${name}" created`)
  }, [session])

  // ─── GENERATE ─────────────────────────────
  const handleGenerate = useCallback(async (shot) => {
    if (generating) return
    setGenerating(true)
    setGenProgress(5)
    const cost = calculatePreviewCost(shot?.model || 'fal-ai/flux-pro/v1.1', { aspect_ratio: shot?.ar })
    setGenLabel(`Generating ${shot?.title || ''}… ${formatCost(cost)}`)
    setPipelineStep(2)
    addLog('run','⟳',`Sending to ${shot?.model || 'pipeline'}… est. ${formatCost(cost)}`)

    const taskId = genId('TASK')
    // VULNERABILITY FIXED: Include dynamic inspector parameters (seed, guidance_scale, etc.) in the payload options
    const dynamicParams = shot ? { ...shot } : {};
    ['id', 'title', 'prompt', 'model', 'cat', 'status', 'entities'].forEach(k => delete dynamicParams[k]);

    const payload = {
      action: 'generate',
      task_id: taskId,
      prompt: shot?.prompt || promptText,
      model_id: shot?.model || 'fal-ai/flux-pro/v1.1',
      project_id: activeProject?.id,
      profile_id: session?.user?.id,
      options: { aspect_ratio: shot?.ar || '16:9', resolution: shot?.res || '1080p', ...dynamicParams }
    }

    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method:'POST', headers:{
          'Content-Type':'application/json',
          // VULNERABILITY FIXED: Send JWT token to authenticate N8N webhook
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(`Webhook error ${res.status}`)
      addLog('ok','✓','Job submitted to pipeline')
      setGenProgress(15)
    } catch(e) {
      addLog('err','✗', e.message)
      setGenerating(false)
      setGenProgress(0)
      setGenLabel('No active jobs')
    }
  }, [generating, activeProject, session, promptText])

  // ─── RENDER ───────────────────────────────
  if (!session) return <><Auth session={session} /><Toaster position="bottom-right" /></>

  const shots = contract.shots || []
  const selected = shots.find(s => s.id === selectedShot)

  return (
    <div className="app">
      <Toaster position="bottom-right" toastOptions={{ style:{background:'#1a1a28',color:'#f0f0f5',border:'1px solid #333348'}}} />
      <LogMonitor />

      {/* ═══ TOPBAR ═══ */}
      <header className="topbar">
        <div className="top-left">
          <div className="top-brand"><i>◈</i> RENDERFARM</div>
          <div style={{position:'relative'}}>
            <button className="top-project" onClick={() => setShowNewProject(!showNewProject)}>
              📁 {activeProject?.name || 'No Project'} <span className="chevron-sm">▾</span>
            </button>
            {showNewProject && (
              <div style={{position:'absolute',top:'100%',left:0,marginTop:4,background:'var(--bg2)',border:'1px solid var(--t4)',borderRadius:'var(--r2)',padding:8,zIndex:300,width:220,display:'flex',flexDirection:'column',gap:6}}>
                {projects.map(p => (
                  <button key={p.id} className={`btn btn-ghost btn-sm${p.id===activeProject?.id?' btn-primary':''}`}
                    onClick={() => { setActiveProject(p); setShowNewProject(false); const c = p.contract||{}; setContract({characters:c.characters||[],props:c.props||[],environments:c.environments||[],shots:c.shots||[]}); addLog('ok','✓',`Switched to "${p.name}"`) }}>
                    {p.name}
                  </button>
                ))}
                <div style={{borderTop:'1px solid var(--t4)',paddingTop:6,display:'flex',gap:4}}>
                  <input className="field" placeholder="New project…" value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')createProject(newProjectName)}} style={{flex:1}} />
                  <button className="btn btn-primary btn-sm" onClick={()=>createProject(newProjectName)}>+</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="pipeline">
          {['Prompt','Model','Render','Output'].map((s,i) => (
            <React.Fragment key={s}>
              {i>0 && <span className="pipe-arrow">→</span>}
              <span className={`pipe-node${i<=pipelineStep?' active':''}`}>
                <span className={`pipe-dot ${['bg-blue','bg-accent','bg-warn','bg-ok'][i]}`}></span>{s}
              </span>
            </React.Fragment>
          ))}
        </div>
        <div className="top-right">
          <button className="top-btn" title="Share" onClick={() => setShareOpen(true)}>🔗</button>
          <WalletWidget session={session} />
          <div className="top-avatar" onClick={() => supabase.auth.signOut()}>
            {session.user.email?.[0]?.toUpperCase() || 'U'}
          </div>
        </div>
      </header>

      {/* ═══ RAIL ═══ */}
      <nav className="rail">
        {[{k:'canvas',e:'🎬'},{k:'compare',e:'⊞'},{k:'timeline',e:'≡'}].map(r => (
          <button key={r.k} className={`rail-btn${view===r.k?' active':''}`} onClick={() => setView(r.k)}>
            {r.e}<span className="rail-tip">{r.k}</span>
          </button>
        ))}
        <div className="rail-sep" />
        <button className={`rail-btn${assetsOpen?' active':''}`} onClick={() => setAssetsOpen(!assetsOpen)}>
          📦<span className="rail-tip">Assets</span>
        </button>

        <div className="rail-end">
          <div className="rail-sep" />
          <button className="rail-btn" onClick={() => { if(confirm('Sign out?')) supabase.auth.signOut() }}>
            ⚙<span className="rail-tip">Sign Out</span>
          </button>
        </div>
      </nav>

      {/* ═══ CANVAS ═══ */}
      <main className="canvas">
        {/* NodeCanvas Integration */}
        {view === 'canvas' && (
          <>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <NodeCanvas 
                data={contract} 
                onChange={(newData) => { setContract(newData); persistContract(newData); }} 
                media={media} 
                onGenerateNode={(node) => {
                  const shotData = node.data?.rawData || {};
                  handleGenerate({ ...shotData, prompt: shotData.prompt || shotData.beat, model: shotData.modelId, cat: node.data?.typeLabel?.toLowerCase() === 'video' ? 'video' : 'image' });
                }}
              />
            </div>

            {/* Floating Prompt */}
            <div className="prompt">
              <textarea ref={promptRef} className="prompt-txt" placeholder="Describe your shot…" rows={1}
                value={promptText} onChange={e => setPromptText(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); handlePromptSend() }}}
              />
              <div className="prompt-bar">
                <button className="p-tool" title="Enhance with AI" onClick={handleEnhance}>✦</button>
                <div className="p-mode">
                  {['shot','audio','3d'].map(m => (
                    <button key={m} className={`p-mode-b${mode===m?' on':''}`} onClick={() => setMode(m)}>
                      {m==='shot'?'🎬':m==='audio'?'🎵':'🧊'} {m}
                    </button>
                  ))}
                </div>
                <button className="p-send" onClick={handlePromptSend} disabled={generating}>↑</button>
              </div>
            </div>
          </>
        )}

        {/* Compare View */}
        {view === 'compare' && (
          <div className="comp-view open">
            {media.filter(m=>m.status==='ready').slice(0,8).map((m,i) => (
              <div key={m.id} className="comp-card">
                <div className="comp-thumb">
                  {m.thumbnailLink ? <img src={getDriveDisplayUrl(m.thumbnailLink)} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : `Variation ${i+1}`}
                </div>
                <div className="comp-info">
                  <span className="comp-model">{m.metadata?.model_id?.split('/').pop() || 'Model'}</span>
                  <span className="comp-cost">${(m.actual_cost || m.estimated_cost || 0).toFixed(3)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generation Log */}
        <div className={`glog${glogOpen?'':' collapsed'}`}>
          <div className="glog-head" onClick={() => setGlogOpen(!glogOpen)}>
            <span className="glog-dot" style={{background:generating?'var(--warn)':'var(--ok)'}} />
            <span className="glog-lbl">{generating?'Processing…':'Ready'}</span>
            <button className="glog-x">{glogOpen?'▾':'▸'}</button>
          </div>
          <div className="glog-body">
            {logs.slice(-10).map((l,i) => (
              <div key={i} className={`gstep ${l.type}`}><span className="gstep-i">{l.icon}</span><span>{l.msg}</span></div>
            ))}
          </div>
        </div>

        {/* Inspector */}
        <div className={`inspector${inspectorOpen?' open':''}`}>
          <div className="insp-head">
            <span className="insp-title">{selected ? `Shot — ${selected.title||''}` : 'Inspector'}</span>
            <button className="insp-x" onClick={() => { setInspectorOpen(false); setSelectedShot(null) }}>✕</button>
          </div>
          {selected && (
            <>
              <div className="insp-body">
                <div className="insp-sec">
                  <div className="insp-lbl">Prompt</div>
                  <textarea className="field" rows={3} value={selected.prompt||''} onChange={e => updateShot(selected.id,'prompt',e.target.value)} />
                </div>
                <div className="insp-sec">
                  <div className="insp-lbl">Model</div>
                  <select className="field" value={selected.model||''} onChange={e => updateShot(selected.id,'model',e.target.value)}>
                    {Object.entries(modelCategories).slice(0,6).map(([cat,models]) => (
                      <optgroup key={cat} label={cat.toUpperCase()}>
                        {models.slice(0,15).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <div style={{fontSize:10,color:'var(--t3)',marginTop:4}}>{getModelHint(selected.model).substring(0,80)}…</div>
                </div>
                {/* Dynamic params from model schema */}
                {getModelOptions(selected.model, selected.cat).map(opt => (
                  <div className="insp-sec" key={opt.key}>
                    <div className="insp-lbl">{opt.label}</div>
                    <div className="chips">
                      {(opt.options||[]).map(v => {
                        const current = selected[opt.key] || selected.options?.[opt.key] || opt.default
                        return <span key={v} className={`chip${current===v?' on':''}`}
                          onClick={() => updateShot(selected.id, opt.key, v)}>{v}</span>
                      })}
                    </div>
                  </div>
                ))}
                {getModelOptions(selected.model, selected.cat).length === 0 && (
                  <div className="insp-sec">
                    <div style={{fontSize:11,color:'var(--t3)',fontStyle:'italic'}}>No configurable parameters for this model</div>
                  </div>
                )}
              </div>
              <div className="insp-foot">
                <div className="cost-row" style={{marginBottom:6}}>
                  <span className="mono">Estimated cost</span>
                  <span className="cost-val">{formatCost(calculatePreviewCost(selected.model, {aspect_ratio:selected.ar}))}</span>
                </div>
                <button className="btn btn-primary btn-full" onClick={() => handleGenerate(selected)} disabled={generating}>
                  ⚡ Generate — {formatCost(calculatePreviewCost(selected.model, {aspect_ratio:selected.ar}))}
                </button>
                <div className="insp-acts">
                  <button className="btn btn-ghost btn-sm" onClick={() => setView('compare')}>⊞ Compare</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { updateShot(selected.id,'status','done'); toast.success('Approved') }}>✓ Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => removeShot(selected.id)}>✕</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Assets Panel */}
        {assetsOpen && (
          <div className="assets-panel">
            <div className="ap-head">
              <span className="ap-title">Assets</span>
              <div className="ap-tabs">
                {[{k:'chars',l:'👤 Characters'},{k:'props',l:'🔫 Props'},{k:'envs',l:'🏙️ Environments'}].map(t => (
                  <button key={t.k} className={`ap-tab${assetTab===t.k?' on':''}`} onClick={() => setAssetTab(t.k)}>{t.l}</button>
                ))}
              </div>
              <button 
                className="btn btn-primary btn-sm" 
                style={{ marginLeft: 'auto', marginRight: '12px' }}
                onClick={() => {
                  const colName = assetTab === 'chars' ? 'characters' : assetTab === 'props' ? 'props' : 'environments';
                  const prefix = assetTab === 'chars' ? 'CHR' : assetTab === 'props' ? 'PRP' : 'ENV';
                  const newAsset = { id: `${prefix}_${Date.now()}`, name: `New ${prefix}`, prompt: '', modelId: 'fal-ai/flux-pro/v1.1' };
                  setContract(prev => {
                    const updated = {...prev, [colName]: [...(prev[colName]||[]), newAsset]};
                    persistContract(updated);
                    return updated;
                  });
                }}
              >
                + Add
              </button>
            </div>
            <div className="ap-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(assetTab==='chars'?contract.characters:assetTab==='props'?contract.props:contract.environments).map(a => (
                <EntityTaskCard 
                  key={a.id}
                  badge={assetTab === 'chars' ? 'CHR' : assetTab === 'props' ? 'PRP' : 'ENV'}
                  name={a.name}
                  id={a.id}
                  data={a}
                  driveMedia={media}
                  onGenerate={(updatedData) => {
                    handleGenerate({ ...updatedData, cat: 'image' });
                  }}
                  onUpdate={(k, v) => {
                    const colName = assetTab === 'chars' ? 'characters' : assetTab === 'props' ? 'props' : 'environments';
                    setContract(prev => {
                      const updated = {...prev, [colName]: prev[colName].map(item => item.id === a.id ? {...item, [k]: v} : item)}
                      persistContract(updated);
                      return updated;
                    });
                  }}
                  onDeleteEntity={() => {
                    const colName = assetTab === 'chars' ? 'characters' : assetTab === 'props' ? 'props' : 'environments';
                    setContract(prev => {
                      const updated = {...prev, [colName]: prev[colName].filter(item => item.id !== a.id)}
                      persistContract(updated);
                      return updated;
                    });
                  }}
                  onDiscardVariant={(varId) => deleteVariant(varId)}
                  onSelectVersion={() => {}}
                  selectedVersion={null}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ═══ SHARE MODAL ═══ */}
      {shareOpen && (
        <div className="modal-overlay" onClick={() => setShareOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{width:460}}>
            <div className="modal-head">
              <span className="modal-title">Share Project</span>
              <button className="modal-x" onClick={() => setShareOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Share Link */}
              <div className="share-sec">
                <div className="insp-lbl">Share Link</div>
                <div className="share-link-row">
                  <input className="field" value={shareData.token ? `${window.location.origin}/?share=${shareData.token}` : 'Generate a link...'} readOnly />
                  {shareData.token ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?share=${shareData.token}`); toast.success('Link copied!') }}>📋</button>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={async () => {
                      const { data, error } = await supabase.from('project_shares').insert({
                        project_id: activeProject.id, shared_by: session.user.id, visibility: shareData.visibility
                      }).select().single()
                      if (error) { toast.error(error.message); return }
                      setShareData(prev => ({...prev, token: data.share_token}))
                      addLog('ok','🔗','Share link created')
                    }}>Generate</button>
                  )}
                </div>
              </div>
              {/* Visibility */}
              <div className="share-sec">
                <div className="insp-lbl">Visibility</div>
                <div className="chips">
                  {['private','team','public'].map(v => (
                    <span key={v} className={`chip${shareData.visibility===v?' on':''}`}
                      onClick={async () => {
                        setShareData(prev => ({...prev, visibility: v}))
                        if (shareData.token) {
                          await supabase.from('project_shares').update({visibility: v}).eq('share_token', shareData.token)
                          toast.success(`Visibility: ${v}`)
                        }
                      }}>
                      {v==='private'?'🔒':v==='team'?'👥':'🌐'} {v}
                    </span>
                  ))}
                </div>
              </div>
              {/* Invite by email */}
              <div className="share-sec">
                <div className="insp-lbl">Invite Collaborator</div>
                <div className="share-link-row">
                  <input className="field" placeholder="email@example.com" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter')handleInvite()}} />
                  <button className="btn btn-primary btn-sm" onClick={handleInvite}>Invite</button>
                </div>
                {shareData.invites.length > 0 && (
                  <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:4}}>
                    {shareData.invites.map((inv,i) => (
                      <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11,color:'var(--t2)',padding:'4px 8px',background:'var(--bg2)',borderRadius:6}}>
                        <span>{inv.email}</span><span className="chip on" style={{fontSize:9}}>{inv.permission}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Export */}
              <div className="share-sec">
                <div className="insp-lbl">Export</div>
                <div className="share-exports">
                  <button className="btn btn-ghost btn-sm btn-full" onClick={() => { const blob = new Blob([JSON.stringify(contract,null,2)],{type:'application/json'}); const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=`${activeProject?.name||'project'}_contract.json`; a.click(); toast.success('Contract JSON exported') }}>📄 Contract JSON</button>
                  <button className="btn btn-ghost btn-sm btn-full" onClick={() => { 
                    const sanitizeCsv = (str) => {
                      if (!str) return '';
                      const s = String(str).replace(/"/g, '""');
                      return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
                    };
                    const rows = (contract.shots||[]).map((s,i) => `${i+1},"${sanitizeCsv(s.title)}","${sanitizeCsv(s.prompt)}",${s.model||''},${s.res||''},${s.ar||''},${s.status||''}`); 
                    const csv = 'Shot,Title,Prompt,Model,Resolution,AR,Status\n'+rows.join('\n'); const blob = new Blob([csv],{type:'text/csv'}); const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=`${activeProject?.name||'project'}_shotlist.csv`; a.click(); toast.success('CSV exported') 
                  }}>🎬 CSV Shotlist</button>
                  <button className="btn btn-ghost btn-sm btn-full" onClick={() => { navigator.clipboard.writeText(JSON.stringify(contract,null,2)); toast.success('Copied!') }}>📋 B_CONTRACT</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DOCK ═══ */}
      <footer className="dock">
        <div className="dock-tabs">
          <button className={`dock-tab${dockTab==='queue'?' on':''}`} onClick={()=>setDockTab('queue')}>Queue</button>
        </div>
        <div className="dock-sep" />
        <div className="dock-queue">
          {generating && <span className="q-pulse" />}
          <span className="dock-info">{genLabel}</span>
          <div className="q-bar"><div className="q-fill" style={{width:`${genProgress}%`}} /></div>
        </div>
        <div className="dock-stats">
          <span className="dock-stat"><span className="stat-dot bg-ok" />{shots.filter(s=>s.status==='done').length} approved</span>
          <span className="dock-stat"><span className="stat-dot bg-warn" />{shots.filter(s=>s.status==='pending').length} pending</span>
        </div>
        <span className="dock-cost">Session: ${sessionCost.toFixed(2)}</span>
      </footer>
    </div>
  )

  // ─── SHOT HELPERS (with Supabase persistence) ─────────
  function updateShot(id, key, val) {
    setContract(prev => {
      const updated = {...prev, shots: prev.shots.map(s => s.id===id ? {...s,[key]:val} : s)}
      persistContract(updated)
      return updated
    })
  }
  function removeShot(id) {
    setContract(prev => {
      const updated = {...prev, shots: prev.shots.filter(s => s.id!==id)}
      persistContract(updated)
      return updated
    })
    setSelectedShot(null); setInspectorOpen(false)
  }
  function handlePromptSend() {
    if (!promptText.trim()) return
    const cat = MODE_TO_CAT[mode] || 'image'
    // VULNERABILITY FIXED: Determine correct default model based on selected mode instead of hardcoding Flux
    const defaultModels = {
      'image': 'fal-ai/flux-pro/v1.1',
      'video': 'fal-ai/kling-video/v1/standard/text-to-video',
      'audio': 'elevenlabs/text-to-speech',
      '3d': 'meshy/text-to-3d'
    };
    const defaultModel = defaultModels[cat] || 'fal-ai/flux-pro/v1.1';

    const newShot = {
      id: genId('SHOT'), title: promptText.substring(0,40), prompt: promptText,
      model: defaultModel, cat,
      status:'pending', res:'1080p', dur: cat==='video'?'5s':'—', ar:'16:9', entities:[]
    }
    setContract(prev => {
      const updated = {...prev, shots:[...prev.shots, newShot]}
      persistContract(updated)
      return updated
    })
    setPromptText('')
    addLog('ok','✓',`Shot #${shots.length+1} created — ${formatCost(calculatePreviewCost(newShot.model))}`)
  }
  async function handleEnhance() {
    if (!promptText.trim()) return
    try {
      // VULNERABILITY FIXED: Use the active shot's model for enhancement to provide context-aware results
      const currentModel = selectedShot ? contract.shots.find(s => s.id === selectedShot)?.model : 'fal-ai/flux-pro/v1.1';
      const enhanced = await enhancePrompt(promptText, null, currentModel)
      setPromptText(enhanced)
      addLog('ok','✦','Prompt enhanced')
    } catch(e) { toast.error(e.message) }
  }
  async function handleInvite() {
    if (!inviteEmail.trim() || !activeProject) return
    // VULNERABILITY FIXED: Removed useless and dangerous blind query to user_wallets that was ignoring results
    const { error } = await supabase.from('project_shares').insert({
      project_id: activeProject.id,
      shared_by: session.user.id,
      shared_with_email: inviteEmail.trim(),
      permission: 'view',
      visibility: shareData.visibility
    }).select().single()
    if (error) { toast.error(error.message); return }
    setShareData(prev => ({...prev, invites:[...prev.invites, {email:inviteEmail.trim(), permission:'view'}]}))
    setInviteEmail('')
    toast.success(`Invited ${inviteEmail.trim()}`)
    addLog('ok','👥',`Invited ${inviteEmail.trim()} to project`)
  }
}

export default App
