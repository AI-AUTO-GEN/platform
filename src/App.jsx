import React, { useState, useCallback, useRef, useEffect } from 'react'
import './App.css'
import { supabase } from './supabase'

// ─── Constants & Helpers ────────────────────────

const N8N_MEDIA_WEBHOOK = 'https://nsk404.app.n8n.cloud/webhook/media-discovery'
const N8N_WEBHOOK_URL = 'https://nsk404.app.n8n.cloud/webhook/track-and-generate'

const SHOT_SIZES = ['EWS', 'WS', 'MWS', 'MS', 'MCU', 'CU', 'ECU', 'INSERT']
const CAMERA_MOVES = [
  'locked', 'micro_push', 'push_in_slow', 'travelling_lateral', 'stabilized_handheld',
  'handheld_micro_breath', 'orbit_soft', 'tilt_follow', 'slider_short_reveal',
  'rack_focus', 'follow_parallel', 'arc_short', 'gimbal_entry', 'drift_centered',
  'near_locked_drift', 'zoom_fast_micro_tilt', 'MATCHCUT_LOCKED', 'TOPDOWN_90_LOCKED'
]

const MODEL_REGISTRY = {
  image: [
    { company: 'Black Forest Labs', models: [
      { id: 'fal-ai/flux-pro/v1.1/ultra', name: 'FLUX 1.1 Pro Ultra [15-04 SOTA]' },
      { id: 'fal-ai/flux-pro/v1.1', name: 'FLUX 1.1 Pro' },
      { id: 'fal-ai/flux/dev', name: 'FLUX.1 Dev' }
    ]},
    { company: 'Google', models: [
      { id: 'fal-ai/gemini-pro/v3.5-flash', name: 'Gemini 3.5 Flash (Nano Banana 2)' },
      { id: 'fal-ai/gemini-pro/v3.1-flash', name: 'Gemini 3.1 Flash' }
    ]},
    { company: 'ByteDance', models: [
      { id: 'fal-ai/bytedance/seedance-2.0/text-to-image', name: 'Seedance 2.0 T2I [New]' },
      { id: 'fal-ai/bytedance/magic-image/v4.1', name: 'MagicImage v4.1' }
    ]},
    { company: 'OpenAI', models: [
      { id: 'fal-ai/gpt-image/v1.5/pro', name: 'GPT Image 1.5 Pro' },
      { id: 'fal-ai/dalle-3', name: 'DALL-E 3' }
    ]},
    { company: 'Alibaba (Wan)', models: [
      { id: 'fal-ai/wan/v2.7/pro', name: 'Wan 2.7 Pro' }
    ]},
    { company: 'Ideogram', models: [
      { id: 'fal-ai/ideogram/v3', name: 'Ideogram 3.0' }
    ]},
    { company: 'Recraft', models: [
      { id: 'fal-ai/recraft-v4', name: 'Recraft V4 [Pro Vector]' }
    ]}
  ],
  video: [
    { company: 'ByteDance', models: [
      { id: 'fal-ai/bytedance/seedance-2.0/image-to-video', name: 'Seedance 2.0 Pro (SOTA Physics)' },
      { id: 'fal-ai/bytedance/seedance-2.0/fast/image-to-video', name: 'Seedance 2.0 Fast (Real-Time)' },
      { id: 'fal-ai/bytedance/magic-video/v4', name: 'MagicVideo v4' }
    ]},
    { company: 'Kuaishou (Kling)', models: [
      { id: 'fal-ai/kling-video/v3/pro/image-to-video', name: 'Kling 3.0 Pro' },
      { id: 'fal-ai/kling-video/v2.5/turbo-pro', name: 'Kling 2.5 Turbo Pro' }
    ]},
    { company: 'Tencent (Hunyuan)', models: [
      { id: 'fal-ai/hunyuan-video/v2/image-to-video', name: 'Hunyuan Video v2 Pro' },
      { id: 'fal-ai/hunyuan-video/v2/fast', name: 'Hunyuan v2 Turbo' }
    ]},
    { company: 'MiniMax', models: [
      { id: 'fal-ai/minimax/hailuo-v2.3/pro', name: 'Hailuo 2.3 Pro' },
      { id: 'fal-ai/minimax/video-01', name: 'MiniMax v1' }
    ]},
    { company: 'Runway', models: [
      { id: 'fal-ai/runway-gen4-turbo', name: 'Runway Gen-4 Turbo' },
      { id: 'fal-ai/runway-gen3-alpha', name: 'Runway Gen-3 Alpha' }
    ]},
    { company: 'Shengshu (Vidu)', models: [
      { id: 'fal-ai/vidu/v3/pro', name: 'Vidu Q3' }
    ]},
    { company: 'Luma', models: [
      { id: 'fal-ai/luma-v2', name: 'Dream Machine v2' }
    ]}
  ]
}

function ModelPicker({ type, value, onChange }) {
  const categories = MODEL_REGISTRY[type]
  const currentCategory = categories.find(c => c.models.some(m => m.id === value)) || categories[0]
  
  return (
    <div className="model-picker-group">
      <select className="select-mini company-sel" 
              value={currentCategory.company} 
              onChange={(e) => onChange(categories.find(c => c.company === e.target.value).models[0].id)}>
        {categories.map(c => <option key={c.company} value={c.company}>{c.company}</option>)}
      </select>
      <select className="select-mini model-sel accent" 
              value={value} 
              onChange={(e) => onChange(e.target.value)}>
        {currentCategory.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    </div>
  )
}

function genId(prefix) {
  return `${prefix}___${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function useDriveMedia(projectNameOrId, category) {
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!projectNameOrId) return
    setLoading(true)
    try {
      let pId = projectNameOrId;
      if (typeof projectNameOrId === 'string' && projectNameOrId.length > 20) {
        // ID Provided
      } else {
        const { data: proj } = await supabase.from('projects').select('id').eq('name', projectNameOrId).single();
        if (proj) pId = proj.id;
      }

      const { data: outputs, error } = await supabase
        .from('renderfarm_outputs')
        .select('*')
        .eq('project_id', pId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (outputs || []).map(o => ({
        id: o.id,
        name: o.file_name || o.task_id,
        webViewLink: o.url || '#',
        thumbnailLink: o.url || '#',
        mimeType: o.kind?.includes('video') ? 'video/mp4' : 'image/png',
        status: o.status
      }));

      setMedia(formatted)
    } catch (err) {
      console.error('Failed to fetch media from Supabase:', err)
    } finally {
      setLoading(false)
    }
  }, [projectNameOrId, category])

  useEffect(() => { 
    refresh() 
    
    // Conectar telemetría en tiempo real para las imágenes
    const channel = supabase.channel(`media_sync_${category}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'renderfarm_outputs' }, () => {
        refresh() // Forzar recarga automática cuando n8n avise de que ha terminado
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh, category])
  
  return { media, loading, refresh }
}

// ─── UI COMPONENTS ──────────────────────────────

function EntityTaskCard({ badge, name, id, data, onGenerate, onUpdate, driveMedia, selectedVersion, onSelectVersion }) {
  const [prompt, setPrompt] = useState(data.prompt || '')
  const hasChanges = prompt !== data.lastGeneratedPrompt
  
  const variants = driveMedia?.filter(m => m.name.includes(id) || m.name.includes(name?.toUpperCase().replace(/\s+/g, '_'))) || []
  const activeVariant = selectedVersion || variants[0]

  return (
    <div className={`entity-task-card glass ${hasChanges ? 'modified' : ''} slide-in`}>
      <div className="task-header">
        <div className="task-id-zone">
          <span className={`entity-badge ${badge?.toLowerCase()}`}>{badge}</span>
          <span className="task-id mono">{id}</span>
        </div>
        <div className="task-actions">
           <ModelPicker type={badge === 'SHOT' ? 'video' : 'image'} value={data.modelId} onChange={(v) => onUpdate('modelId', v)} />
           <button className={`btn-mini-gen ${hasChanges ? 'pulse' : ''}`} onClick={() => onGenerate({ ...data, prompt })}>⚡</button>
        </div>
      </div>

      <div className="render-preview-zone">
          {activeVariant ? (
            activeVariant.status === 'processing' ? (
              <div className="processing-placeholder">
                <div className="spinner-center"></div>
                <span className="tiny-label">ALCHEMY IN PROGRESS...</span>
              </div>
            ) : (
              <img src={activeVariant.thumbnailLink?.replace('=s220', '=s800')} className="official-render" alt={name} />
            )
          ) : (
             <div className="empty-render">
                <span className="empty-state-text">OFFICIAL RENDER NOT SELECTED</span>
             </div>
          )}
          
          <div className="variant-strip-overlay">
            {variants.slice(0, 6).map(v => (
              <div key={v.id} className={`variant-mini-box ${v.id === activeVariant?.id ? 'active' : ''} ${v.status === 'processing' ? 'busy' : ''}`} onClick={() => onSelectVersion(v)}>
                {v.status === 'processing' ? <div className="spinner-xs"></div> : <img src={v.thumbnailLink} alt="v" />}
              </div>
            ))}
          </div>
      </div>

      <div className="task-body">
        <input type="text" className="tab-input-name" value={name || ''} placeholder="Entity Name" onChange={(e) => onUpdate('name', e.target.value)} />
        <textarea 
          className="input-prompt" 
          rows={3} 
          value={prompt} 
          placeholder="Enter prompt refinement..."
          onChange={(e) => {
            setPrompt(e.target.value);
            onUpdate('prompt', e.target.value);
          }}
        />
      </div>

      <div className="task-card-footer">
        <div className="task-usage-info">
          {data.usageCount > 0 && <span className="usage-pill">Used in {data.usageCount} Shots</span>}
        </div>
        <span className="file-name mono">{name?.toUpperCase().replace(/\s+/g, '_') || id}.png</span>
        <span className={`status-badge ${hasChanges ? 'modified' : ''}`}>
          {hasChanges ? '● Unsaved Changes' : '✓ Synced'}
        </span>
      </div>
    </div>
  )
}


function StepProject({ data, projects, loadingProjects, onSelectProject, onNewProject, onChange }) {
  const fileRef = useRef()
  const handleImportContract = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const contract = JSON.parse(ev.target.result)
        const imported = parseContract(contract)
        onChange({ ...data, ...imported, _importedFileName: file.name })
      } catch (err) { alert('Error parsing JSON: ' + err.message) }
    }
    reader.readAsText(file)
  }

  return (
    <div className="step-content fade-in">
      <div className="step-header">
        <h2>Project <span className="gradient-text">Selector</span></h2>
        <p>Choose an existing production or start a new cinematic project.</p>
      </div>

      <div className="project-selector-zone glass">
        {loadingProjects ? (
          <div className="loading-spinner-box"><div className="spinner-sm"></div> Loading Production Registry...</div>
        ) : (
          <div className="projects-grid">
            {projects.map(p => (
              <div key={p.id} className={`project-pill ${data.projectName === p.name ? 'active' : ''}`} onClick={() => onSelectProject(p)}>
                <span className="pill-icon">🎬</span>
                <span className="pill-name">{p.name}</span>
              </div>
            ))}
            <div className="project-pill add-new" onClick={() => {
              const name = prompt('Enter New Project Name:');
              if (name) onNewProject(name);
            }}>
              <span className="pill-icon">+</span>
              <span className="pill-name">New Project</span>
            </div>
          </div>
        )}
      </div>

      <div className="divider-or"><span>project settings</span></div>

      <div className="import-section glass">
        <div className="import-header">
          <span className="entity-badge">IMPORT</span>
          <span className="text-secondary">Sync with an existing B_CONTRACT JSON</span>
        </div>
        <div className="upload-zone compact" onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImportContract} hidden />
          {data._importedFileName ? (
            <div className="upload-done"><span className="icon">✅</span><span>{data._importedFileName} — loaded</span></div>
          ) : (
            <><span className="icon">📦</span><span>Click to import B_CONTRACT (.json)</span></>
          )}
        </div>
      </div>

      <div className="form-grid-2 mt-16">
        <div className="form-group">
          <label>Project Title</label>
          <input type="text" className="input-field" placeholder="e.g. LA PUJA" readOnly
            value={data.projectName || ''} />
        </div>
        <div className="form-group">
          <label>Format</label>
          <select className="input-field" value={data.format || 'film_essay_montage'} onChange={(e) => onChange({ ...data, format: e.target.value })}>
            <option value="film_essay_montage">Film Essay Montage</option>
            <option value="narrative_short">Narrative Short</option>
          </select>
        </div>
      </div>
    </div>
  )
}

function StepCharacters({ data, onChange }) {
  const chars = data.characters || []
  const { media, loading, refresh } = useDriveMedia(data.projectName, 'character')

  const addChar = () => onChange({ ...data, characters: [...chars, { id: genId('CHAR'), name: '', description: '', prompt: '', lastGeneratedPrompt: '', modelId: 'fal-ai/flux-pro/v1.1' }] })
  const updateChar = (idx, field, val) => {
    const u = [...chars]; u[idx] = { ...u[idx], [field]: val };
    onChange({ ...data, characters: u })
  }

  const handleGenerate = async (char) => {
    try {
      const { data: proj } = await supabase.from('projects').select('id').eq('name', data.projectName).single();
      if (proj) {
        await supabase.from('renderfarm_outputs').insert([{
          project_id: proj.id,
          task_id: char.id,
          file_name: `${char.name || 'char'}_${Date.now()}.png`,
          kind: 't2i',
          status: 'processing'
        }]);
        refresh();
      }

      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          project: { title: data.projectName }, 
          task: { id: char.id, prompt: char.prompt, modelId: char.modelId, kind: 't2i' } 
        })
      });
      if (res.ok) alert(`🚀 Generation started for ${char.name}`);
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="step-content fade-in">
      <div className="step-header">
        <div className="header-with-action">
          <h2>Character <span className="gradient-text">Production</span></h2>
          <div className="header-btns">
            <div className="master-model-zone">
              <span className="tiny-label">MASTER MODEL</span>
              <ModelPicker type="image" value={chars[0]?.modelId || 'fal-ai/flux-pro/v1.1'} onChange={(v) => {
                const u = chars.map(c => ({ ...c, modelId: v }))
                onChange({ ...data, characters: u })
              }} />
            </div>
            <button className={`btn-refresh ${loading ? 'spinning' : ''}`} onClick={refresh}>↻ Refresh Renders</button>
          </div>
        </div>
      </div>
      <div className="tasks-grid">
        {chars.map((c, idx) => (
          <EntityTaskCard 
            key={c.id} badge="CHAR" name={c.name} id={c.id} 
            data={{ ...c, usageCount: (data.shots || []).filter(s => s.relatedAssetIds?.includes(c.id)).length }} 
            driveMedia={media}
            onUpdate={(f, v) => updateChar(idx, f, v)}
            onGenerate={() => handleGenerate(c)}
            onSelectVersion={(v) => updateChar(idx, 'selectedVersionId', v.id)}
            selectedVersion={media.find(m => m.id === c.selectedVersionId)}
          />
        ))}
        <div className="add-task-placeholder glass" onClick={addChar}>+ Add New Character Unit</div>
      </div>
    </div>
  )
}

function StepProps({ data, onChange }) {
  const props = data.props || []
  const { media, loading, refresh } = useDriveMedia(data.projectName, 'prop')
  const addProp = () => onChange({ ...data, props: [...props, { id: genId('PROP'), name: '', description: '', prompt: '', lastGeneratedPrompt: '', modelId: 'fal-ai/flux-pro/v1.1' }] })
  const updateProp = (idx, field, val) => {
    const u = [...props]; u[idx] = { ...u[idx], [field]: val };
    onChange({ ...data, props: u })
  }

  const handleGenerate = async (prop) => {
    try {
      const { data: proj } = await supabase.from('projects').select('id').eq('name', data.projectName).single();
      if (proj) {
        await supabase.from('renderfarm_outputs').insert([{
          project_id: proj.id, task_id: prop.id, file_name: `${prop.name || 'prop'}_${Date.now()}.png`,
          kind: 't2i', status: 'processing'
        }]);
        refresh();
      }
      await fetch(N8N_WEBHOOK_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: { title: data.projectName }, task: { id: prop.id, prompt: prop.prompt, modelId: prop.modelId, kind: 't2i' } })
      });
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="step-content fade-in">
      <div className="step-header">
        <div className="header-with-action">
          <h2>Props & <span className="gradient-text">Objects</span></h2>
          <div className="header-btns">
             <div className="master-model-zone">
                <span className="tiny-label">MASTER MODEL</span>
                <ModelPicker type="image" value={props[0]?.modelId || 'fal-ai/flux-pro/v1.1'} onChange={(v) => {
                  const u = props.map(p => ({ ...p, modelId: v }))
                  onChange({ ...data, props: u })
                }} />
             </div>
             <button className={`btn-refresh ${loading ? 'spinning' : ''}`} onClick={refresh}>↻ Sync Variants</button>
          </div>
        </div>
      </div>
      <div className="tasks-grid">
        {props.map((p, idx) => (
          <EntityTaskCard key={p.id} badge="PROP" name={p.name} id={p.id} data={p} driveMedia={media}
            onUpdate={(f, v) => updateProp(idx, f, v)} onGenerate={() => handleGenerate(p)}
            onSelectVersion={(v) => updateProp(idx, 'selectedVersionId', v.id)}
            selectedVersion={media.find(m => m.id === p.selectedVersionId)}
          />
        ))}
        <div className="add-task-placeholder glass" onClick={addProp}>+ Add Prop Unit</div>
      </div>
    </div>
  )
}

function StepEnvironments({ data, onChange }) {
  const envs = data.environments || []
  const { media, loading, refresh } = useDriveMedia(data.projectName, 'location')
  const addEnv = () => onChange({ ...data, environments: [...envs, { id: genId('LOC'), name: '', scale: 'macro', description: '', prompt: '', lastGeneratedPrompt: '', modelId: 'fal-ai/flux-pro/v1.1' }] })
  const updateEnv = (idx, field, val) => {
    const u = [...envs]; u[idx] = { ...u[idx], [field]: val };
    onChange({ ...data, environments: u })
  }

  const handleGenerate = async (env) => {
    try {
      const { data: proj } = await supabase.from('projects').select('id').eq('name', data.projectName).single();
      if (proj) {
        await supabase.from('renderfarm_outputs').insert([{
          project_id: proj.id, task_id: env.id, file_name: `${env.name || 'loc'}_${Date.now()}.png`,
          kind: 't2i', status: 'processing'
        }]);
        refresh();
      }
      await fetch(N8N_WEBHOOK_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: { title: data.projectName }, task: { id: env.id, prompt: env.prompt, modelId: env.modelId, kind: 't2i' } })
      });
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="step-content fade-in">
      <div className="step-header">
        <div className="header-with-action">
          <h2>Locations & <span className="gradient-text">Landscapes</span></h2>
          <div className="header-btns">
             <div className="master-model-zone">
                <span className="tiny-label">MASTER MODEL</span>
                <ModelPicker type="image" value={envs[0]?.modelId || 'fal-ai/flux-pro/v1.1'} onChange={(v) => {
                  const u = envs.map(e => ({ ...e, modelId: v }))
                  onChange({ ...data, environments: u })
                }} />
             </div>
             <button className={`btn-refresh ${loading ? 'spinning' : ''}`} onClick={refresh}>↻ Sync Variants</button>
          </div>
        </div>
      </div>
      <div className="tasks-grid">
        {envs.map((e, idx) => (
          <EntityTaskCard 
            key={e.id} badge="LOC" name={e.name} id={e.id} 
            data={{ ...e, usageCount: (data.shots || []).filter(s => s.relatedAssetIds?.includes(e.id)).length }} 
            driveMedia={media}
            onUpdate={(f, v) => updateEnv(idx, f, v)}
            onGenerate={() => handleGenerate(e)}
            onSelectVersion={(v) => updateEnv(idx, 'selectedVersionId', v.id)}
            selectedVersion={media.find(m => m.id === e.selectedVersionId)}
          />
        ))}
        <div className="add-task-placeholder glass" onClick={addEnv}>+ Add Environment Unit</div>
      </div>
    </div>
  )
}

function StepShots({ data, onChange }) {
  const shots = data.shots || []
  const { media, loading, refresh } = useDriveMedia(data.projectName, 'shot')
  const addShot = () => onChange({ ...data, shots: [...shots, { id: `SHOT___${String(shots.length + 1).padStart(3, '0')}`, beat: '', duration: 5, shotSize: 'MS', cameraMove: 'micro_push', modelId: 'fal-ai/bytedance/seedance-2.0/image-to-video' }] })

  return (
    <div className="step-content fade-in">
      <div className="step-header">
        <div className="header-with-action">
          <h2>Shot Builder — <span className="gradient-text">Seedance 2.0</span></h2>
          <div className="header-btns">
            <ModelPicker type="video" value={shots[0]?.modelId} onChange={(v) => onChange({ ...data, shots: shots.map(s => ({ ...s, modelId: v })) })} />
            <button className={`btn-refresh ${loading ? 'spinning' : ''}`} onClick={refresh}>↻ Refresh View</button>
          </div>
        </div>
      </div>
      <div className="shots-list">
        {shots.map((s, idx) => (
          <div key={s.id} className="shot-row glass slide-in">
             <span className="entity-badge shot">{s.id}</span>
             <textarea className="input-field transparent" rows={1} value={s.beat} placeholder="What happens in this shot?" onChange={(e) => {
               const u = [...shots]; u[idx].beat = e.target.value; onChange({...data, shots: u})
             }} />
             <div className="shot-mini-specs">
               <ModelPicker type="video" value={s.modelId} onChange={(v) => {
                 const u = [...shots]; u[idx].modelId = v; onChange({...data, shots: u})
               }} />
             </div>
          </div>
        ))}
      </div>
      <button className="btn-add" onClick={addShot}>+ Add Shot</button>
    </div>
  )
}

function StepFreestyle({ data, onChange }) {
  const [params, setParams] = useState({ type: 'image', modelId: 'fal-ai/flux-pro/v1.1/ultra', prompt: '', references: [] })
  const [executing, setExecuting] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState(null)
  const { media: results, refresh: refreshResults } = useDriveMedia('FREESTYLE_LAB', 'freestyle')

  const handleExecute = async () => {
    setExecuting(true)
    const logId = `SB_${Date.now().toString().slice(-4)}`;
    try {
      const { data: proj } = await supabase.from('projects').select('id').eq('name', 'FREESTYLE_LAB').single();
      if (proj) {
        await supabase.from('renderfarm_outputs').insert([{
          project_id: proj.id, task_id: `TASK_${logId}`, file_name: `freestyle_${logId}.png`,
          kind: params.type === 'image' ? 't2i' : 'i2v', status: 'processing'
        }]);
        refreshResults();
      }

      await fetch(N8N_WEBHOOK_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: { title: 'FREESTYLE_LAB' }, task: { id: `TASK_${logId}`, prompt: params.prompt, modelId: params.modelId, references: params.references, kind: params.type === 'image' ? 't2i' : 'i2v', freestyle: true } })
      });
      setTimeout(refreshResults, 12000);
    } catch (e) { console.error(e) } finally { setExecuting(false) }
  }

  const [downloadingZip, setDownloadingZip] = useState(false);

  // Safe converter for Google Drive previews using external CDN proxy to bypass CORS/Hotlink Blocks
  const getDriveDisplayUrl = (url) => {
    if (!url) return '';
    if (url.includes('unsplash.com')) return url;
    const match = url.match(/id=([^&]+)/);
    if (match) {
      const gDriveUrl = `https://drive.google.com/uc?id=${match[1]}`;
      // Bypass Google's anti-hotlinking by passing through standard image proxy
      return `https://wsrv.nl/?url=${encodeURIComponent(gDriveUrl)}&output=webp`;
    }
    return url;
  };

  const handleBulkDownload = async () => {
    const readyItems = results.filter(r => r.status === 'ready' && r.url);
    if (!readyItems.length) return alert('No loaded results available to download.');
    
    setDownloadingZip(true);
    try {
      const { default: JSZip } = await import('jszip');
      const { saveAs } = await import('file-saver');
      const zip = new JSZip();
      
      const fetchPromises = readyItems.map(async (r, i) => {
         const match = r.url.match(/id=([^&]+)/);
         if (!match) return;
         const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(`https://drive.google.com/uc?id=${match[1]}`)}&output=webp`;
         const res = await fetch(proxyUrl);
         if (!res.ok) throw new Error('Fetch failed');
         const blob = await res.blob();
         const num = String(i + 1).padStart(2, '0');
         zip.file(`Freestyle_Asset_${num}.webp`, blob);
      });
      
      await Promise.all(fetchPromises);
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `Freestyle_Batch.zip`);
    } catch (e) {
      console.error(e);
      alert('Hubo un error aglomerando el ZIP. Puede que algunas imágenes pesen demasiado.');
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="step-content fade-in">
      <div className="step-header">
        <div className="header-with-action">
          <h2>Freestyle <span className="gradient-text">Laboratory</span></h2>
          <div className="action-group" style={{ display: 'flex', gap: '10px' }}>
             <button className="btn-mini-refresh" onClick={handleBulkDownload} disabled={downloadingZip}>
               {downloadingZip ? '⏳ Zipping...' : '📦 Download All (ZIP)'}
             </button>
             <button className="btn-mini-refresh" onClick={refreshResults}>↻ Refresh</button>
          </div>
        </div>
      </div>
      <div className="sandbox-grid-v2">
        <div className="sandbox-controls glass">
          <ModelPicker type={params.type} value={params.modelId} onChange={(v) => setParams({...params, modelId: v})} />
          <textarea className="input-prompt" rows={5} value={params.prompt} onChange={(e) => setParams({...params, prompt: e.target.value})} />
          <button className="btn-primary full-width" onClick={handleExecute} disabled={executing}>EXECUTE ALCHEMY</button>
        </div>
        <div className="sandbox-results glass">
           <div className="results-scroll-grid">
              {results.map(r => (
                <div key={r.id} className="result-card">
                   <div className="result-preview" onClick={() => { if(r.status === 'ready') setFullscreenImage(r) }} style={{ cursor: r.status === 'ready' ? 'pointer' : 'default'}}>
                     {r.status === 'processing' ? <div className="processing-overlay"><div className="spinner-sm"></div></div> : <img src={getDriveDisplayUrl(r.thumbnailLink)} alt="result" className="clickable-img" referrerPolicy="no-referrer" />}
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* FULLSCREEN MODAL */}
      {fullscreenImage && (
        <div className="lightbox-overlay fade-in" onClick={() => setFullscreenImage(null)}>
          <div className="lightbox-controls">
            <button className="btn-close-lightbox">✕ Close</button>
            <a href={fullscreenImage.webViewLink} target="_blank" rel="noreferrer" className="btn-download-lightbox" onClick={(e) => e.stopPropagation()}>
              ⬇ Download HQ
            </a>
          </div>
          <div className="lightbox-img-wrapper">
             <img src={getDriveDisplayUrl(fullscreenImage.thumbnailLink)} onClick={(e) => e.stopPropagation()} referrerPolicy="no-referrer" alt="fullscreen" />
          </div>
        </div>
      )}
    </div>
  )
}

function LogMonitor() {
  const [logs, setLogs] = useState([])
  useEffect(() => {
    const channel = supabase.channel('logs').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'renderfarm_logs' }, p => setLogs(v => [p.new, ...v].slice(0, 20))).subscribe()
    return () => supabase.removeChannel(channel)
  }, [])
  return (
    <div className="log-monitor-global glass open">
       <div className="log-header">SYSTEM_LAB_MONITOR :: {logs.length} SIGNALS</div>
       <div className="log-body">
         {logs.map((l, i) => <div key={i} className="log-entry">[{l.context}] {l.message}</div>)}
       </div>
    </div>
  )
}

function App() {
  const [step, setStep] = useState(0)
  const [projects, setProjects] = useState([])
  const [data, setData] = useState({ projectName: '', characters: [], props: [], environments: [], shots: [] })

  const loadProjects = useCallback(async () => {
    const { data: list } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    if (list) setProjects(list)
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  const STEPS = [
    { id: 'project', label: 'Setup', icon: '📁' },
    { id: 'characters', label: 'Chars', icon: '👤' },
    { id: 'props', label: 'Props', icon: '🔧' },
    { id: 'environments', label: 'Envs', icon: '🏙️' },
    { id: 'shots', label: 'Shots', icon: '🎬' },
    { id: 'freestyle', label: 'Sandbox', icon: '🧪' },
    { id: 'export', label: 'Export', icon: '🚀' }
  ]

  const views = [
    <StepProject data={data} projects={projects} onSelectProject={(p) => setData({...data, projectName: p.name})} onNewProject={async (n) => { await supabase.from('projects').insert([{ name: n }]); loadProjects() }} onChange={setData} />,
    <StepCharacters data={data} onChange={setData} />,
    <StepProps data={data} onChange={setData} />,
    <StepEnvironments data={data} onChange={setData} />,
    <StepShots data={data} onChange={setData} />,
    <StepFreestyle data={data} onChange={setData} />,
    <div className="step-content"><h2>Export</h2></div>
  ]

  return (
    <div className="app-shell">
      <header className="topbar glass"><h1 className="brand">AI <span className="gradient-text">AUTO GEN</span></h1></header>
      <div className="main-layout">
        <nav className="step-nav glass">
          {STEPS.map((s, idx) => <button key={s.id} className={`step-btn ${idx === step ? 'active' : ''}`} onClick={() => setStep(idx)}>{s.icon} {s.label}</button>)}
        </nav>
        <main className="content-area">{views[step]}</main>
      </div>
      <LogMonitor />
    </div>
  )
}

export default App
