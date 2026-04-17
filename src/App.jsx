import React, { useState, useCallback, useRef, useEffect } from 'react'
import './App.css'
import { supabase } from './supabase'
import Auth from './Auth'

// ─── Constants & Helpers ────────────────────────
const N8N_MEDIA_WEBHOOK = 'https://nsk404.app.n8n.cloud/webhook/media-discovery'
const N8N_WEBHOOK_URL = 'https://nsk404.app.n8n.cloud/webhook/track-and-generate'

// Safe converter for Google Drive previews using external CDN proxy to bypass CORS/Hotlink Blocks
const getDriveDisplayUrl = (url) => {
  if (!url) return '';
  // Si ya es una URL de Supabase o Unsplash, la servimos directa
  if (url.includes('supabase.co') || url.includes('unsplash.com')) return url;
  
  const match = url.match(/id=([^&]+)/);
  if (match) {
    const gDriveUrl = `https://drive.google.com/uc?id=${match[1]}`;
    return `https://wsrv.nl/?url=${encodeURIComponent(gDriveUrl)}&output=webp`;
  }
  return url;
};

const parseContract = (json) => {
  return {
    projectName: json.title || json.projectName || '',
    format: json.format || 'film_essay_montage',
    characters: (json.characters || []).map(c => ({ ...c, id: c.id || `CHAR_${Math.random().toString(36).slice(2, 6).toUpperCase()}` })),
    props: (json.props || []).map(p => ({ ...p, id: p.id || `PROP_${Math.random().toString(36).slice(2, 6).toUpperCase()}` })),
    environments: (json.environments || []).map(e => ({ ...e, id: e.id || `LOC_${Math.random().toString(36).slice(2, 6).toUpperCase()}` })),
    shots: (json.shots || []).map(s => ({ ...s, id: s.id || `SHOT_${Math.random().toString(36).slice(2, 6).toUpperCase()}` }))
  };
};

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

function AlchemyProgress({ status, realProgress }) {
  const [percent, setPercent] = useState(0)
  
  useEffect(() => {
    if (status === 'processing' && !realProgress) {
      const interval = setInterval(() => {
        setPercent(prev => {
          if (prev < 92) return prev + Math.random() * 2;
          return prev;
        });
      }, 800);
      return () => clearInterval(interval);
    } else if (status === 'ready' && percent !== 100) {
      setPercent(100);
    } else if (status !== 'ready' && realProgress !== undefined && percent !== realProgress) {
      setPercent(realProgress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, realProgress])

  if ((status !== 'processing' && status !== 'ready' && !realProgress) || (status === 'ready' && percent === 100)) return null;

  return (
    <div className="alchemy-progress-ring">
      <div className="progress-value mono">{Math.floor(realProgress || percent)}%</div>
      <div className="progress-label tiny-label">TRANSFORMING REALITY</div>
    </div>
  )
}

function genId(prefix) {
  return `${prefix}___${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function useDriveMedia(projectNameOrId, category, session) {
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

      let query = supabase
        .from('renderfarm_outputs')
        .select('*')
        
      if (category === 'freestyle' && session?.user?.id) {
         query = query.eq('profile_id', session.user.id)
      } else {
         query = query.eq('project_id', pId)
      }

      const { data: outputs, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (outputs || []).map(o => ({
        id: o.id,
        name: o.file_name || o.task_id,
        webViewLink: o.hq_url || o.url || '#',
        thumbnailLink: o.thumbnail_url || o.url || '#',
        mimeType: o.kind?.includes('video') ? 'video/mp4' : 'image/png',
        status: o.status,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        progress: o.progress || 0,
        metadata: o.metadata || {}
      }));

      setMedia(formatted)
    } catch (err) {
      console.error('Failed to fetch media from Supabase:', err)
    } finally {
      setLoading(false)
    }
  }, [projectNameOrId, category, session])

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
      <div className="task-header-v2">
        <div className="header-top-row">
           <div className="id-badge-group">
              <span className={`entity-badge ${badge?.toLowerCase()}`}>{badge}</span>
              <span className="task-id-mono">{id}</span>
           </div>
           <button className={`btn-gen-circle ${hasChanges ? 'pulse-gold' : ''}`} onClick={() => onGenerate({ ...data, prompt })}>
              <span className="icon">⚡</span>
           </button>
        </div>
        <div className="header-tool-row">
           <ModelPicker type={badge === 'SHOT' ? 'video' : 'image'} value={data.modelId} onChange={(v) => onUpdate('modelId', v)} />
        </div>
      </div>

      <div className="render-preview-zone">
          {activeVariant ? (
            activeVariant.status === 'processing' ? (
              <div className="processing-placeholder">
                <AlchemyProgress status="processing" realProgress={activeVariant.progress} />
                <div className="spinner-center"></div>
              </div>
            ) : (
              <img src={getDriveDisplayUrl(activeVariant.thumbnailLink)} className="official-render" alt={name} />
            )
          ) : (
             <div className="empty-render">
                <span className="empty-state-text">NO RENDER ASSET FOUND</span>
             </div>
          )}
          
          <div className="variant-strip-v2">
            {variants.slice(0, 8).map(v => (
              <div key={v.id} className={`variant-mini-v2 ${v.id === activeVariant?.id ? 'active' : ''} ${v.status === 'processing' ? 'busy' : ''}`} onClick={() => onSelectVersion(v)}>
                {v.status === 'processing' ? <div className="spinner-xs"></div> : <img src={getDriveDisplayUrl(v.thumbnailLink)} alt="v" />}
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
          placeholder="Refine visual instructions..."
          onChange={(e) => {
            setPrompt(e.target.value);
            onUpdate('prompt', e.target.value);
          }}
        />
      </div>

      <div className="task-card-footer-v2">
        <div className="footer-left">
           <span className="file-name-tag">{name?.toUpperCase().replace(/\s+/g, '_') || id}.png</span>
           {data.usageCount > 0 && <span className="usage-count">In {data.usageCount} Shots</span>}
           {activeVariant?.status === 'ready' && activeVariant.updatedAt && (
             <span className="telemetry-tag">
               ⏱️ {Math.round((new Date(activeVariant.updatedAt) - new Date(activeVariant.createdAt)) / 1000)}s
             </span>
           )}
        </div>
        <div className={`sync-status ${hasChanges ? 'alert' : 'clean'}`}>
           {hasChanges ? '● Unsaved' : '✓ Synced'}
        </div>
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
        const timestamp = Date.now(); // eslint-disable-line react-hooks/purity
        await supabase.from('renderfarm_outputs').insert([{
          project_id: proj.id,
          task_id: char.id,
          file_name: `${char.name || 'char'}_${timestamp}.png`,
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
            <button className="btn-mini-refresh" onClick={async () => {
                const { default: JSZip } = await import('jszip');
                const { saveAs } = await import('file-saver');
                const zip = new JSZip();
                const ready = media.filter(m => m.status === 'ready');
                if(!ready.length) return alert('No ready assets to download.');
                for(let i=0; i<ready.length; i++) {
                   const res = await fetch(`https://wsrv.nl/?url=${encodeURIComponent(ready[i].webViewLink)}`);
                   const blob = await res.blob();
                   zip.file(`${ready[i].name || 'asset'}.webp`, blob);
                }
                const c = await zip.generateAsync({type:'blob'});
                saveAs(c, `Production_Batch_${data.projectName}.zip`);
            }}>📦 ZIP Production</button>
            <div className="master-model-zone">
              <span className="tiny-label">MASTER MODEL</span>
              <ModelPicker type="image" value={chars[0]?.modelId || 'fal-ai/flux-pro/v1.1'} onChange={(v) => {
                const u = chars.map(c => ({ ...c, modelId: v }))
                onChange({ ...data, characters: u })
              }} />
            </div>
            <button className={`btn-refresh ${loading ? 'spinning' : ''}`} onClick={refresh}>↻ Sync</button>
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
        const timestamp = Date.now(); // eslint-disable-line react-hooks/purity
        await supabase.from('renderfarm_outputs').insert([{
          project_id: proj.id, task_id: prop.id, file_name: `${prop.name || 'prop'}_${timestamp}.png`,
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
        const timestamp = Date.now(); // eslint-disable-line react-hooks/purity
        await supabase.from('renderfarm_outputs').insert([{
          project_id: proj.id, task_id: env.id, file_name: `${env.name || 'loc'}_${timestamp}.png`,
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
  const { loading, refresh } = useDriveMedia(data.projectName, 'shot')
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

function StepFreestyle({ data, onChange, session }) {
  const [, setExecuting] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState(null)
  const { media: results, loading, refresh: refreshResults } = useDriveMedia('FREESTYLE_LAB', 'freestyle', session)
  
  const experiments = data.freestyleExperiments || []

  const addExperiment = () => {
    const id = genId('EXP')
    onChange({ 
      ...data, 
      freestyleExperiments: [
        ...experiments, 
        { id, name: 'New Experiment', prompt: '', modelId: 'fal-ai/flux-pro/v1.1/ultra', mode: 't2i', ref_image: null, ref_video: null }
      ] 
    })
  }

  const updateExperiment = (idx, fieldOrUpdates, val) => {
    const u = [...experiments]
    if (typeof fieldOrUpdates === 'object') {
      u[idx] = { ...u[idx], ...fieldOrUpdates }
    } else {
      u[idx] = { ...u[idx], [fieldOrUpdates]: val }
    }
    onChange({ ...data, freestyleExperiments: u })
  }

  const handleFileUpload = async (file, onCompleteCallback) => {
     if(!file) return
     const ext = file.name.split('.').pop()
     const fileName = `refs/${session?.user?.id || 'anon'}_${Date.now()}.${ext}` // eslint-disable-line react-hooks/purity
     const { error } = await supabase.storage.from('assets').upload(fileName, file)
     if(error) { alert("Upload failed: " + error.message); return null; }
     
     const { data: publicData } = supabase.storage.from('assets').getPublicUrl(fileName)
     onCompleteCallback(publicData.publicUrl)
  }

  const handleExecute = async (exp) => {
    setExecuting(true)
    try {
      const { data: proj } = await supabase.from('projects').select('id').eq('name', 'FREESTYLE_LAB').single();
      if (!proj) return alert('FREESTYLE_LAB project not found in database.');

      const kindPayload = exp.mode === 't2i' ? 't2i' : exp.mode === 'i2i' ? 'i2i' : exp.mode === 'i2v' ? 'i2v' : 't2v';
      const outputExt = kindPayload.includes('v') ? 'mp4' : 'png';
      const timestamp = Date.now(); // eslint-disable-line react-hooks/purity

      await supabase.from('renderfarm_outputs').insert([{
        project_id: proj.id, 
        task_id: exp.id, 
        file_name: `${exp.name.toLowerCase().replace(/\\s+/g, '_')}_${timestamp}.${outputExt}`,
        kind: kindPayload, 
        status: 'processing',
        profile_id: session?.user?.id,
        metadata: { prompt: exp.prompt, modelId: exp.modelId, mode: exp.mode }
      }]);
      
      refreshResults();

      await fetch(N8N_WEBHOOK_URL, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          project: { title: 'FREESTYLE_LAB' }, 
          task: { 
            id: exp.id, 
            prompt: exp.prompt, 
            modelId: exp.modelId, 
            kind: kindPayload, 
            freestyle: true,
            user_id: session?.user?.id,
            ref_image: kindPayload === 'v2v' ? null : exp.ref_image,
            ref_video: kindPayload === 'v2v' ? exp.ref_image : null
          } 
        })
      });
      
      const idx = experiments.findIndex(e => e.id === exp.id)
      if (idx !== -1) updateExperiment(idx, 'lastGeneratedPrompt', exp.prompt)

    } catch (e) { 
      console.error(e) 
      alert('Error initiating alchemy: ' + e.message)
    } finally { 
      setExecuting(false) 
    }
  }

  return (
    <div className="step-content fade-in">
      <div className="step-header">
        <div className="header-with-action">
          <h2>Freestyle <span className="gradient-text">Laboratory</span></h2>
          <div className="action-group">
             <button className={`btn-refresh ${loading ? 'spinning' : ''}`} onClick={refreshResults}>↻ Refresh</button>
          </div>
        </div>
      </div>

      <div className="tasks-grid">
        {experiments.map((exp, idx) => {
          const variants = results?.filter(m => m.name.includes(exp.id)) || []
          const activeVariant = results?.find(m => m.id === exp.selectedVersionId) || variants[0]
          
          return (
          <div key={exp.id} className="entity-task-card glass slide-in">
            <div className="task-header-v2">
              <div className="header-top-row">
                 <div className="id-badge-group">
                    <span className="entity-badge exp">EXP</span>
                    <input type="text" className="tab-input-name" value={exp.name} onChange={e => updateExperiment(idx, 'name', e.target.value)} />
                 </div>
                 <button className="btn-gen-circle" onClick={() => handleExecute(exp)}>
                    <span className="icon">⚡</span>
                 </button>
              </div>
              <div className="header-tool-row">
                 <select className="select-mini" value={exp.mode} onChange={e => {
                    updateExperiment(idx, {
                      mode: e.target.value,
                      modelId: e.target.value.includes('v') ? 'fal-ai/kling-video/v3/pro/image-to-video' : 'fal-ai/flux-pro/v1.1/ultra'
                    });
                 }}>
                   <option value="t2i">Text to Image</option>
                   <option value="i2i">Image to Image</option>
                   <option value="t2v">Text to Video</option>
                   <option value="i2v">Image to Video (Frame)</option>
                   <option value="v2v">Video to Video</option>
                 </select>
                 <ModelPicker type={exp.mode?.includes('v') ? 'video' : 'image'} value={exp.modelId} onChange={(v) => updateExperiment(idx, 'modelId', v)} />
              </div>
            </div>

            <div className="render-preview-zone">
                {activeVariant ? (
                  activeVariant.status === 'processing' ? (
                    <div className="processing-placeholder">
                      <AlchemyProgress status="processing" realProgress={activeVariant.progress} />
                      <div className="spinner-center"></div>
                    </div>
                  ) : (
                    activeVariant.mimeType?.includes('video') 
                      ? <video src={getDriveDisplayUrl(activeVariant.webViewLink)} controls className="official-render" autoPlay loop muted />
                      : <img src={getDriveDisplayUrl(activeVariant.thumbnailLink)} className="official-render" alt={exp.name} onClick={() => setFullscreenImage(activeVariant)} />
                  )
                ) : (
                   <div className="empty-render"><span className="empty-state-text">NO RENDER ASSET FOUND</span></div>
                )}
            </div>

            <div className="task-body">
              <textarea 
                className="input-prompt" 
                rows={2} 
                value={exp.prompt} 
                placeholder="Describe generation..."
                onChange={e => updateExperiment(idx, 'prompt', e.target.value)}
              />
              {(['i2i', 'i2v', 'v2v'].includes(exp.mode)) && (
                 <div className="upload-ref-box">
                    <label className="tiny-label">{exp.mode === 'v2v' ? 'Reference Video' : 'Reference Image'}</label>
                    {exp.ref_image ? (
                        <div className="ref-preview">
                           {exp.ref_image.includes('.mp4') ? <video src={exp.ref_image} height={40} muted/> : <img src={exp.ref_image} height={40}/>}
                           <button onClick={()=>updateExperiment(idx, 'ref_image', null)}>x</button>
                        </div>
                    ) : (
                      <input type="file" accept={exp.mode === 'v2v' ? 'video/*' : 'image/*'} onChange={(e) => handleFileUpload(e.target.files[0], url => updateExperiment(idx, 'ref_image', url))} />
                    )}
                 </div>
              )}
            </div>
            
            <div className="task-card-footer-v2">
               <span className="telemetry-tag">{variants.length} Variants</span>
            </div>
          </div>
        )})}
        <div className="add-task-placeholder glass" onClick={addExperiment}>
          + Register New Freestyle Unit
        </div>
      </div>

      {fullscreenImage && (
        <div className="lightbox-overlay fade-in" onClick={() => setFullscreenImage(null)}>
          <div className="lightbox-img-wrapper">
             <img src={getDriveDisplayUrl(fullscreenImage.thumbnailLink)} onClick={(e) => e.stopPropagation()} alt="fullscreen" />
          </div>
        </div>
      )}
    </div>
  )
}


function QuotaWidget({ session }) {
  const [quotaUsed, setQuotaUsed] = useState(0)
  const MAX_QUOTA = 500 * 1024 * 1024; // 500 MB
  
  const fetchQuota = useCallback(async () => {
    if (!session?.user?.id) return
    const { data } = await supabase.rpc('get_user_quota', { p_user_id: session.user.id })
    if (data !== null) setQuotaUsed(Number(data))
  }, [session])

  useEffect(() => {
    fetchQuota(); // eslint-disable-line react-hooks/set-state-in-effect
    const iv = setInterval(fetchQuota, 30000);
    return () => clearInterval(iv);
  }, [fetchQuota])

  const handleClearData = async () => {
    if (window.confirm("You are about to delete ALL your generate files and history from Supabase. Make sure you have downloaded everything via the '📦 ZIP Production' button if needed. Proceed?")) {
      await supabase.rpc('delete_user_data')
      setQuotaUsed(0)
      window.location.reload()
    }
  }

  const percent = Math.min((quotaUsed / MAX_QUOTA) * 100, 100);
  const color = percent > 90 ? '#ff4040' : percent > 75 ? '#ffcc00' : 'var(--accent)';

  return (
    <div className="quota-widget" title={`${(quotaUsed/1024/1024).toFixed(1)} MB / 500 MB Used`}>
      <div className="quota-bar-bg">
         <div className="quota-bar-fill" style={{ width: `${percent}%`, backgroundColor: color }}></div>
      </div>
      {percent >= 90 && (
         <button className="btn-clear-alert" onClick={handleClearData}>Storage Full! Clear Data &rarr;</button>
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
  const [session, setSession] = useState(null)
  const [step, setStep] = useState(0)
  const [projects, setProjects] = useState([])
  const [data, setData] = useState({ projectName: '', characters: [], props: [], environments: [], shots: [], freestyleExperiments: [] })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProjects = useCallback(async () => {
    const { data: list } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    if (list) setProjects(list)
  }, [])

  useEffect(() => { 
    loadProjects() // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadProjects])

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
    <StepFreestyle data={data} onChange={setData} session={session} />,
    <div className="step-content"><h2>Export</h2></div>
  ]

  return (
    <div className="app-shell">
      <Auth session={session} />
      <header className="topbar glass">
         <h1 className="brand">AI <span className="gradient-text">AUTO GEN</span></h1>
         {session && (
           <div className="user-profile-widget">
             <QuotaWidget session={session} />
             <span className="tiny-label">{session.user.email}</span>
             <button className="logout-btn" onClick={() => supabase.auth.signOut()}>Logout</button>
           </div>
         )}
      </header>
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
