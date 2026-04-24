import React, { useState, useCallback, useRef, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import './App.css'
import { supabase } from './supabase'
import Auth from './Auth'
import { WalletWidget } from './components/Wallet'
import { N8N_WEBHOOK_URL, MODALITIES } from './config/constants'
import { MODEL_REGISTRY, MODEL_SCHEMAS, getModelOptions, getModelHint } from './config/modelRegistry'
import { enhancePrompt } from './services/geminiService'
import { calculatePreviewCost, formatCost, optionsToParams } from './pricing/PricingEngine'
import { useDriveMedia } from './hooks/useDriveMedia'
import { genId, deleteVariant, downloadAsset, getDriveDisplayUrl } from './utils/assetUtils'

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
  const [costPreview, setCostPreview] = useState(null)
  const [logs, setLogs] = useState([{type:'ok',icon:'✓',msg:'System ready'}])
  const [modelCategories, setModelCategories] = useState({})
  const [pipelineStep, setPipelineStep] = useState(0)
  const promptRef = useRef(null)

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
      const { data } = await supabase.from('ai_models').select('id,title,category,provider,pricing_base,variables_schema').eq('is_active', true)
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
          // Track real session cost
          if (o.actual_cost) {
            setSessionCost(prev => prev + parseFloat(o.actual_cost))
          } else if (o.estimated_cost) {
            setSessionCost(prev => prev + parseFloat(o.estimated_cost))
          }
          setPipelineStep(3)
        } else if (o.status === 'processing') {
          setGenProgress(o.progress || 50)
          setGenLabel(o.status_message || 'Processing…')
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [session, refreshMedia])

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

  // ─── COST PREVIEW ─────────────────────────
  const updateCostPreview = useCallback((modelId, params) => {
    const cost = calculatePreviewCost(modelId, params)
    setCostPreview(cost)
  }, [])

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
    const payload = {
      action: 'generate',
      task_id: taskId,
      prompt: shot?.prompt || promptText,
      model_id: shot?.model || 'fal-ai/flux-pro/v1.1',
      project_id: activeProject?.id,
      profile_id: session?.user?.id,
      options: { aspect_ratio: shot?.ar || '16:9', resolution: shot?.res || '1080p' }
    }

    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method:'POST', headers:{'Content-Type':'application/json'},
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
        <button className="rail-btn" onClick={() => { setMode('sandbox'); toast('Sandbox mode — free generation') }}>⚡<span className="rail-tip">Sandbox</span></button>
        <div className="rail-end">
          <div className="rail-sep" />
          <button className="rail-btn" onClick={() => { if(confirm('Sign out?')) supabase.auth.signOut() }}>
            ⚙<span className="rail-tip">Sign Out</span>
          </button>
        </div>
      </nav>

      {/* ═══ CANVAS ═══ */}
      <main className="canvas">
        {/* Shots Grid */}
        {view === 'canvas' && (
          <>
            <div className="shots">
              {shots.map((s,i) => {
                const variant = media.find(m => m.task_id === s.id && m.status === 'ready')
                return (
                  <div key={s.id} className={`shot${s.id===selectedShot?' selected':''}`}
                    onClick={() => { setSelectedShot(s.id); setInspectorOpen(true); setPipelineStep(0) }}>
                    <div className="shot-thumb">
                      {variant?.thumbnailLink && <img src={getDriveDisplayUrl(variant.thumbnailLink)} alt="" />}
                      <span className="shot-status" style={{background:STATUS[s.status]||STATUS.pending}} />
                      <span className="shot-badge">{CAT_ICONS[s.cat]||'🎬'} #{i+1}</span>
                      <span className="shot-model-badge">{(s.model||'').split('/').pop()}</span>
                    </div>
                    <div className="shot-body">
                      <div className="shot-title">{s.title || s.prompt?.substring(0,40)}</div>
                      <div className="shot-meta">
                        <span>{s.res||'1080p'}</span><span>{s.ar||'16:9'}</span>
                        {s.dur && s.dur!=='—' && <span>{s.dur}</span>}
                      </div>
                      {s.entities?.length > 0 && (
                        <div className="shot-ents">{s.entities.map(e => <span key={e} className="shot-ent">@{e}</span>)}</div>
                      )}
                    </div>
                  </div>
                )
              })}
              {shots.length === 0 && (
                <div style={{color:'var(--t3)',textAlign:'center',padding:60,fontSize:13}}>
                  No shots yet. Type a prompt below to create your first shot.
                </div>
              )}
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
                  {['shot','sandbox','edit','audio','3d'].map(m => (
                    <button key={m} className={`p-mode-b${mode===m?' on':''}`} onClick={() => setMode(m)}>
                      {m==='shot'?'🎬':m==='sandbox'?'⚡':m==='edit'?'✏️':m==='audio'?'🎵':'🧊'} {m}
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
                </div>
                <div className="insp-sec">
                  <div className="insp-lbl">Resolution</div>
                  <div className="chips">
                    {['720p','1080p','4K'].map(r => (
                      <span key={r} className={`chip${(selected.res||'1080p')===r?' on':''}`} onClick={() => updateShot(selected.id,'res',r)}>{r}</span>
                    ))}
                  </div>
                </div>
                <div className="insp-sec">
                  <div className="insp-lbl">Aspect Ratio</div>
                  <div className="chips">
                    {['16:9','9:16','1:1','21:9','4:3'].map(r => (
                      <span key={r} className={`chip${(selected.ar||'16:9')===r?' on':''}`} onClick={() => updateShot(selected.id,'ar',r)}>{r}</span>
                    ))}
                  </div>
                </div>
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
            </div>
            <div className="ap-body">
              {(assetTab==='chars'?contract.characters:assetTab==='props'?contract.props:contract.environments).map(a => (
                <div key={a.id||a.name} className="asset-card">
                  <div className="ac-thumb" />
                  <div className="ac-info"><span className="ac-name">{a.name}</span><span className="ac-desc">{a.prompt?.substring(0,50)}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ═══ SHARE MODAL ═══ */}
      {shareOpen && (
        <div className="modal-overlay" onClick={() => setShareOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">Share Project</span>
              <button className="modal-x" onClick={() => setShareOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="share-sec">
                <div className="insp-lbl">Public Link</div>
                <div className="share-link-row">
                  <input className="field" value={`https://renderfarm.ai/p/${activeProject?.name||'project'}`} readOnly />
                  <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(`https://renderfarm.ai/p/${activeProject?.name||''}`); toast.success('Copied') }}>📋</button>
                </div>
              </div>
              <div className="share-sec">
                <div className="insp-lbl">Visibility</div>
                <div className="chips">
                  <span className="chip on">🔒 Private</span><span className="chip">👥 Team</span><span className="chip">🌐 Public</span>
                </div>
              </div>
              <div className="share-sec">
                <div className="insp-lbl">Export</div>
                <div className="share-exports">
                  <button className="btn btn-ghost btn-sm btn-full" onClick={() => { const blob = new Blob([JSON.stringify(contract,null,2)],{type:'application/json'}); const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=`${activeProject?.name||'project'}_contract.json`; a.click(); toast.success('Contract JSON exported') }}>📄 Export Contract JSON</button>
                  <button className="btn btn-ghost btn-sm btn-full" onClick={() => { const rows = (contract.shots||[]).map((s,i) => `${i+1},"${s.title||''}","${(s.prompt||'').replace(/"/g,'""')}",${s.model||''},${s.res||''},${s.ar||''},${s.status||''}`); const csv = 'Shot,Title,Prompt,Model,Resolution,AR,Status\n'+rows.join('\n'); const blob = new Blob([csv],{type:'text/csv'}); const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=`${activeProject?.name||'project'}_shotlist.csv`; a.click(); toast.success('CSV exported') }}>🎬 CSV for Premiere</button>
                  <button className="btn btn-ghost btn-sm btn-full" onClick={() => { navigator.clipboard.writeText(JSON.stringify(contract,null,2)); toast.success('Contract copied to clipboard') }}>📋 Copy B_CONTRACT JSON</button>
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
          <button className={`dock-tab${dockTab==='history'?' on':''}`} onClick={()=>setDockTab('history')}>History ({media.length})</button>
          <button className={`dock-tab${dockTab==='exports'?' on':''}`} onClick={()=>setDockTab('exports')}>Exports</button>
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
    const newShot = {
      id: genId('SHOT'), title: promptText.substring(0,40), prompt: promptText,
      model: 'fal-ai/flux-pro/v1.1', cat,
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
      const enhanced = await enhancePrompt(promptText, null, 'fal-ai/flux-pro/v1.1')
      setPromptText(enhanced)
      addLog('ok','✦','Prompt enhanced')
    } catch(e) { toast.error(e.message) }
  }
}

export default App
