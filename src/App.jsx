import { ClipboardList, Clapperboard, Palette, Zap, User, Camera, Ruler, Home, Wrench, Sunrise, Star, Search, Globe, FileText, Flame, Moon, Sparkles, Tornado, RefreshCw, Music, X, CheckCircle, Save, XCircle, Theater, AlertTriangle, Rocket, Lightbulb, ScrollText, Trash2, Package, Folder, Building, Video, FlaskConical, Network, PenTool, Maximize2, Download } from 'lucide-react';
import React, { useState, useCallback, useRef, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { createPortal } from 'react-dom'
import './App.css'
import { supabase } from './supabase'
import Auth from './Auth'
import NodeCanvas from './NodeCanvas'
import StepExport from './StepExport'
import { triggerN8NExport } from './exportUtils'
import { calculatePreviewCost, formatCost, optionsToParams, updateModelPricing } from './pricing/PricingEngine'
import { WalletWidget } from './components/Wallet'

// â”€â”€â”€ Extracted Modules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { N8N_WEBHOOK_URL, N8N_UPLOAD_WEBHOOK_URL, N8N_MEDIA_WEBHOOK, SUPABASE_URL, GEMINI_PROXY_URL, MODALITIES, SHOT_SIZES, CAMERA_MOVES, SHOT_TYPES } from './config/constants'
import { MODEL_REGISTRY, MODEL_SCHEMAS, getModelOptions, getModelHint } from './config/modelRegistry'
import { callGeminiProxy, enhancePrompt, geminiDirector, generateScript as _generateScript, generateShotlist as _generateShotlist, assistShot as _assistShot } from './services/geminiService'
import { triggerNativeDownload, getDriveDisplayUrl, downloadAsset, deleteVariant, deleteAllVariantsForTask, genId, customConfirm, parseContract } from './utils/assetUtils'
import { useDriveMedia } from './hooks/useDriveMedia'
import { I18N } from './config/i18n'
import { EnhanceButton, ENHANCE_PRESETS, ModelPicker, AlchemyProgress, EntityTaskCard, QuotaWidget, LogMonitor } from './components'

// â”€â”€â”€ NOTE: triggerNativeDownload, customConfirm, N8N constants, GEMINI_PROXY_URL
// have been extracted to config/constants.js and utils/assetUtils.js
// and are imported above.

// All shared components (EnhanceButton, ModelPicker, AlchemyProgress, etc.) imported from ./components
// Re-exports for backward compatibility:
export { MODEL_REGISTRY, MODEL_SCHEMAS } from './config/modelRegistry'
export { getModelOptions } from './config/modelRegistry'

// EntityTaskCard imported from ./components/EntityTaskCard.jsx
function EntityShotCard({ data, projectData, onGenerate, onUpdate, onToggleRef, onAddQuickEntity, driveMedia, globalMedia, selectedVersion, onSelectVersion, onDeleteEntity, onDiscardVariant }) {
  const [fullscreenImage, setFullscreenImage] = useState(null)
  
  const variants = driveMedia?.filter(m => m.task_id === data.id) || []
  const activeVariant = selectedVersion || variants[0]

  const customOptions = getModelOptions(data.modelId)

  useEffect(() => {
    const handleEsc = (e) => { if(e.key === 'Escape') setFullscreenImage(null); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Resolve Dependencies
  const dependencies = [];
  const reqIds = [...(data.relatedCharacters || []), ...(data.relatedProps || []), ...(data.relatedEnvironments || [])];
  
  reqIds.forEach(reqId => {
    const depVariants = globalMedia.filter(m => m.task_id === reqId && m.status === 'ready');
    if (depVariants.length > 0) {
      dependencies.push({ id: reqId, status: 'ready', media: depVariants[0] });
    } else {
      dependencies.push({ id: reqId, status: 'missing', media: null });
    }
  });

  return (
    <div className={`entity-task-card glass slide-in`}>
      <div className="task-header-v2">
        <div className="header-top-row">
           <div className="id-badge-group">
              <span className={`entity-badge shot`}>SHOT</span>
              <span className="task-id-mono">{data.id}</span>
           </div>
           <button className={`btn-gen-circle`} onClick={() => onGenerate(data, dependencies)} disabled={dependencies.some(d => d.status === 'missing')}>
              <span className="icon"><Zap size={16} className="lucide-icon" /></span>
           </button>
        </div>
        <div className="header-tool-row">
           <ModelPicker type="image" value={data.modelId} onChange={(v) => onUpdate('modelId', v)} />
        </div>
      </div>

      <div className="render-preview-zone">
          {activeVariant ? (
            activeVariant.status === 'processing' ? (
              <div className="processing-placeholder">
                <AlchemyProgress status="processing" realProgress={activeVariant.progress} statusMessage={activeVariant.statusMessage} />
                <div className="spinner-center"></div>
              </div>
            ) : activeVariant.status === 'error' ? (
              <div className="processing-placeholder error-state">
                <AlchemyProgress status="error" statusMessage={activeVariant.statusMessage} />
                <button className="btn-retry" onClick={() => onGenerate(data)}><RefreshCw size={16} className="lucide-icon" /> Retry</button>
              </div>
            ) : (
                <div className="preview-container">
                {activeVariant.mimeType?.includes('video') ? (
                  <video src={getDriveDisplayUrl(activeVariant.webViewLink)} className="official-render cursor-zoom" autoPlay loop muted onClick={() => setFullscreenImage(activeVariant)} />
                ) : (
                  <img src={getDriveDisplayUrl(activeVariant.thumbnailLink)} className="official-render cursor-zoom" alt={data.id} onClick={() => setFullscreenImage(activeVariant)} />
                )}
              </div>
            )
          ) : (
             <div className="empty-render">
                <span className="empty-state-text">NO RENDER ASSET FOUND</span>
             </div>
          )}
          
          {activeVariant && activeVariant.status === 'ready' && (
            <div className="preview-actions">
              <button className="btn-preview-action" onClick={(e) => { e.stopPropagation(); setFullscreenImage(activeVariant); }} title="Fullscreen"><Maximize2 size={14} className="lucide-icon" /></button>
              <button className="btn-preview-action" onClick={(e) => { e.stopPropagation(); downloadAsset(activeVariant); }} title="Download"><Download size={14} className="lucide-icon" /></button>
              {onDiscardVariant && <button className="btn-preview-action btn-preview-danger" onClick={(e) => { e.stopPropagation(); customConfirm('Discard this image? Your settings will be preserved.', () => onDiscardVariant(activeVariant)); }} title="Discard this image"><Trash2 size={14} className="lucide-icon" /></button>}
            </div>
          )}

          <div className="variant-strip-v2">
            {variants.slice(0, 8).map(v => (
              <div key={v.id} className={`variant-mini-v2 ${v.id === activeVariant?.id ? 'active' : ''} ${v.status === 'processing' ? 'busy' : ''}`} onClick={() => onSelectVersion(v)}>
                {v.status === 'processing' ? <div className="spinner-xs"></div> : (v.mimeType?.includes('video') ? <div className="icon"><Clapperboard size={16} className="lucide-icon" /></div> : <img src={getDriveDisplayUrl(v.thumbnailLink)} alt="v" />)}
              </div>
            ))}
          </div>
      </div>

      <div className="task-body">
        <div className="prompt-wrapper">
          <textarea 
            className="input-prompt" 
            rows={3} 
            value={data.beat || ''} 
            placeholder="What happens in this shot?"
            onChange={(e) => onUpdate('beat', e.target.value)}
          />
          <EnhanceButton value={data.beat} onChange={(v) => onUpdate('beat', v)} modelId={data.modelId} entityType="shot" modality={data.kind || 'i2v'} />
        </div>
        {customOptions.length > 0 && (
          <div className="advanced-options-grid mt-4">
            {customOptions.map(opt => (
              <div key={opt.key} className="advanced-option-item">
                 <label className="tiny-label">{opt.label}</label>
                 <select 
                   className="select-mini"
                   value={data.settings?.[opt.key] || opt.default}
                   onChange={(e) => onUpdate('settings', { ...(data.settings || {}), [opt.key]: e.target.value })}
                 >
                   {opt.options.map(o => <option key={o} value={o}>{o}</option>)}
                 </select>
              </div>
            ))}
          </div>
        )}
        
        {/* Entity References Picker */}
        <div className="shot-refs-zone mt-4">
          <label className="tiny-label">ENTITY REFERENCES</label>
          <div className="ref-groups">
            <div className="ref-group">
              <span className="ref-group-label char"><Theater size={16} className="lucide-icon" /> Characters <button className="btn-tiny-add" onClick={() => onAddQuickEntity('characters')} title="Add new character">+</button></span>
              <div className="ref-pills">
                {projectData?.characters?.map(c => (
                  <button key={c.id} className={`ref-pill char ${(data.relatedCharacters || []).includes(c.id) ? 'active' : ''}`} onClick={() => onToggleRef('characters', c.id)} title={c.prompt?.slice(0, 60)}>{c.name || c.id}</button>
                ))}
              </div>
            </div>
            <div className="ref-group">
              <span className="ref-group-label prop"><PenTool size={16} className="lucide-icon" /> Props <button className="btn-tiny-add" onClick={() => onAddQuickEntity('props')} title="Add new prop">+</button></span>
              <div className="ref-pills">
                {projectData?.props?.map(p => (
                  <button key={p.id} className={`ref-pill prop ${(data.relatedProps || []).includes(p.id) ? 'active' : ''}`} onClick={() => onToggleRef('props', p.id)} title={p.prompt?.slice(0, 60)}>{p.name || p.id}</button>
                ))}
              </div>
            </div>
            <div className="ref-group">
              <span className="ref-group-label env"><Globe size={16} className="lucide-icon" /> Environments <button className="btn-tiny-add" onClick={() => onAddQuickEntity('environments')} title="Add new environment">+</button></span>
              <div className="ref-pills">
                {projectData?.environments?.map(e => (
                  <button key={e.id} className={`ref-pill env ${(data.relatedEnvironments || []).includes(e.id) ? 'active' : ''}`} onClick={() => onToggleRef('environments', e.id)} title={e.prompt?.slice(0, 60)}>{e.name || e.id}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {reqIds.length > 0 && (
          <div className="dependencies-zone mt-4">
             <div className="tiny-label mb-2">DEPENDENCIES</div>
             <div className="dependencies-grid">
               {dependencies.map(dep => (
                 <div key={dep.id} className={`dep-item ${dep.status}`}>
                   {dep.status === 'ready' && dep.media ? (
                     <img src={getDriveDisplayUrl(dep.media.thumbnailLink)} alt={dep.id} title={dep.id} />
                   ) : (
                     <div className="dep-missing" title={`Missing render for ${dep.id}`}><AlertTriangle size={16} className="lucide-icon" /></div>
                   )}
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>

      {fullscreenImage && createPortal(
        <div className="lightbox-overlay fade-in" onClick={() => setFullscreenImage(null)}>
          <div className="lightbox-img-wrapper" onClick={(e) => e.stopPropagation()}>
             <div className="lightbox-controls">
                <button onClick={() => downloadAsset(fullscreenImage)} title="Download original"><Save size={16} className="lucide-icon" /></button>
                <button onClick={() => setFullscreenImage(null)} title="Close"><XCircle size={16} className="lucide-icon" /></button>
             </div>
             {fullscreenImage.mimeType?.includes('video') 
               ? <video src={getDriveDisplayUrl(fullscreenImage.webViewLink || fullscreenImage.hq_url)} controls autoPlay loop />
               : <img src={getDriveDisplayUrl(fullscreenImage.thumbnailLink || fullscreenImage.hq_url || fullscreenImage.url)} alt="preview" />
             }
             <div className="lightbox-metadata">
                {data.id} â€¢ {data.modelId} â€¢ {data.beat?.slice(0,40)}...
             </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// â”€â”€â”€ I18N Labels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// I18N imported from ./config/i18n.js
// NOTE: geminiDirector, generateScript, generateShotlist, assistShot imported from services/geminiService.js
// Local aliases for backward compatibility within this file:
const generateScript = _generateScript
const generateShotlist = _generateShotlist
const assistShot = _assistShot

// â”€â”€â”€â”€â”€â”€â”€â”€ EntitySidebarInspector Component â”€â”€â”€â”€â”€â”€â”€â”€
function EntitySidebarInspector({ session, activeSidebarPanel, data, onChange, onClose }) {
  const { type, id } = activeSidebarPanel;
  const fType = type === 'characters' ? 'character' : type === 'props' ? 'prop' : 'environment';
  const { media, loading, refresh } = useDriveMedia(data.projectName, fType);

  const entity = data[type]?.find(e => e.id === id);
  if (!entity) return null;

  const handleUpdate = (field, value) => {
    const updatedList = (data[type] || []).map(e => e.id === id ? { ...e, [field]: value } : e);
    onChange({ ...data, [type]: updatedList });
  }

  const handleGenerate = async () => {
    try {
      const { data: proj } = await supabase.from('projects').select('id').eq('name', data.projectName).single();
      if (proj) {
        const timestamp = Date.now();
        const { data: inserted } = await supabase.from('renderfarm_outputs').insert([{
          project_id: proj.id,
          task_id: entity.id,
          file_name: `${(entity.name || fType).replace(/\s+/g, '_')}_${timestamp}.png`,
          kind: 't2i',
          status: 'processing',
          profile_id: session?.user?.id,
          metadata: { prompt: entity.prompt, modelId: entity.modelId, settings: entity.settings }
        }]).select('id').single();
        refresh();

        const rowId = inserted?.id;
        fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ 
            project: { title: data.projectName }, 
            task: { 
              id: entity.id, 
              row_id: rowId,
              prompt: entity.prompt, 
              modelId: entity.modelId || 'fal-ai/flux-pro/v1.1', 
              kind: 't2i', 
              settings: entity.settings || {}, 
              user_id: session?.user?.id, 
              ref_image: null, 
              ref_images: [] 
            } 
          })
        }).catch(err => console.error('Webhook dispatch error:', err));
      }
      refresh();
    } catch (err) {
      toast.error("Error generating image: " + err.message);
    }
  }

  const badge = type === 'characters' ? 'CHAR' : type === 'props' ? 'PROP' : 'LOC';

  return (
    <div className="entity-inspector slide-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
         <h3 style={{ fontSize: '14px', margin: 0, fontWeight: 600, color: 'var(--primary-accent)' }}>Reference Inspector</h3>
         <button className="btn-mini-add" onClick={onClose} style={{ width: '28px', height: '28px', padding: 0 }}><X size={16} className="lucide-icon" /></button>
      </div>
      <div style={{ transform: 'scale(0.95)', transformOrigin: 'top left', width: '105%', flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
          <EntityTaskCard 
            badge={badge} 
            name={entity.name} 
            id={entity.id} 
            data={entity} 
            driveMedia={media}
            onUpdate={handleUpdate}
            onGenerate={handleGenerate}
            onSelectVersion={(v) => handleUpdate('selectedVersionId', v.id)}
            selectedVersion={media.find(m => m.id === entity.selectedVersionId)}
          />
      </div>
    </div>
  )
}

// â”€â”€â”€ StepDirector Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StepDirector({ data, onChange, onPushToProduction, session }) {
  const pipeline = data.pipeline || { language: 'en', phase: 'idea', idea: '', script: '', scriptApproved: false, shotlist: [] }
  const t = I18N[pipeline.language] || I18N.en

  const updatePipeline = (updates) => {
    onChange({ ...data, pipeline: { ...pipeline, ...updates } })
  }

  const [loading, setLoading] = useState(false)
  const [editingScript, setEditingScript] = useState(false)
  const [assistIdx, setAssistIdx] = useState(null)
  const [assistText, setAssistText] = useState('')
  const [assistLoading, setAssistLoading] = useState(false)
  const [addEntityModal, setAddEntityModal] = useState(null) // { idx, type }
  const [activeSidebarPanel, setActiveSidebarPanel] = useState('versions')

  const exportScriptTxt = () => {
    const blob = new Blob([pipeline.script], { type: "text/plain;charset=utf-8" });
    triggerNativeDownload(blob, `${data.projectName?.replace(/\s+/g, '_') || 'Project'}_Screenplay.txt`);
  };

  const exportShotlistCsv = () => {
    // ... logic unchanged ...
    const headers = ['Shot', 'Type', 'Description', 'Action', 'Dialogue', 'Camera', 'Notes'];
    const rows = pipeline.shotlist.map(s => [
        s.shotNumber,
        s.type,
        `"${(s.description||'').replace(/"/g, '""')}"`,
        `"${(s.action||'').replace(/"/g, '""')}"`,
        `"${(s.dialogue||'').replace(/"/g, '""')}"`,
        `"${(s.camera||'').replace(/"/g, '""')}"`,
        `"${(s.notes||'').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    triggerNativeDownload(blob, `${data.projectName?.replace(/\s+/g, '_') || 'Project'}_Shotlist.csv`);
  };

  const saveSnapshot = () => {
    const name = window.prompt("Enter a name for this snapshot (e.g., 'Draft 1'):", `Version ${new Date().toLocaleTimeString()}`);
    if (!name) return;
    const newSnap = { id: `SNAP_${Date.now()}`, name, date: new Date().toISOString(), pipelineData: JSON.parse(JSON.stringify(pipeline)) };
    const snaps = data.directorSnapshots || [];
    onChange({ ...data, directorSnapshots: [newSnap, ...snaps] });
  };

  const loadSnapshot = (snap) => {
    customConfirm(`Load snapshot "${snap.name}"? Your current unsaved progress will be replaced.`, () => { updatePipeline(snap.pipelineData); });
  };

  const deleteSnapshot = (id) => {
    customConfirm("Delete this snapshot?", () => { onChange({ ...data, directorSnapshots: (data.directorSnapshots || []).filter(s => s.id !== id) }); });
  };

  const phaseIdx = pipeline.phase === 'idea' ? 0 : pipeline.phase === 'script' ? 1 : 2
  const phases = [
    { key: 'idea', label: t.phaseIdea, icon: <Lightbulb size={14} /> },
    { key: 'script', label: t.phaseScript, icon: <ScrollText size={14} /> },
    { key: 'shotlist', label: t.phaseShotlist, icon: <Clapperboard size={14} /> },
  ]

  const handleGenerateScript = async () => {
    if (!pipeline.idea.trim()) return
    setLoading(true)
    try {
      const script = await generateScript(pipeline.idea, pipeline.language)
      updatePipeline({ script, phase: 'script', scriptApproved: false })
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const handleGenerateShotlist = async () => {
    if (!pipeline.script.trim()) return
    setLoading(true)
    try {
      const shotlist = await generateShotlist(pipeline.script, pipeline.language)
      updatePipeline({ shotlist, phase: 'shotlist', scriptApproved: true })
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const handleAiAssist = async (idx) => {
    if (!assistText.trim()) return
    setAssistLoading(true)
    try {
      const suggestion = await assistShot(pipeline.script, pipeline.shotlist, idx, assistText, pipeline.language)
      const updated = [...pipeline.shotlist]
      updated[idx] = { ...updated[idx], ...suggestion, id: updated[idx].id, shotNumber: updated[idx].shotNumber, approved: false, aiSuggestion: assistText }
      updatePipeline({ shotlist: updated })
      setAssistIdx(null)
      setAssistText('')
    } catch (e) { toast.error(e.message) }
    finally { setAssistLoading(false) }
  }

  const updateShot = (idx, field, value) => {
    const updated = [...pipeline.shotlist]
    updated[idx] = { ...updated[idx], [field]: value }
    updatePipeline({ shotlist: updated })
  }

  const toggleApproveShot = (idx) => {
    const updated = [...pipeline.shotlist]
    updated[idx] = { ...updated[idx], approved: !updated[idx].approved }
    updatePipeline({ shotlist: updated })
  }

  const approveAllShots = () => {
    const allApproved = pipeline.shotlist.every(s => s.approved)
    const updated = pipeline.shotlist.map(s => ({ ...s, approved: !allApproved }))
    updatePipeline({ shotlist: updated })
  }

  const toggleShotRef = (idx, refType, entityId) => {
    const updated = [...pipeline.shotlist]
    const shot = { ...updated[idx] }
    const refs = { ...(shot.refs || { characters: [], props: [], environments: [] }) }
    const list = refs[refType] || []
    if (list.includes(entityId)) {
      refs[refType] = list.filter(id => id !== entityId)
    } else {
      refs[refType] = [...list, entityId]
    }
    shot.refs = refs
    updated[idx] = shot
    updatePipeline({ shotlist: updated })
  }

  const addQuickEntityFromShotlist = (idx, refType) => {
    const singleType = refType === 'characters' ? 'character' : refType === 'props' ? 'prop' : 'environment';
    const name = window.prompt(`Enter name for new ${singleType}:`);
    if (!name || !name.trim()) return;
    
    let prefix = refType === 'characters' ? 'CHAR' : refType === 'props' ? 'PROP' : 'ENV';
    const newId = `${prefix}_${Date.now()}`;
    const newEntity = { id: newId, name: name.trim(), description: '', prompt: '', modelId: 'fal-ai/flux-pro/v1.1' };
    
    const updatedShotlist = [...pipeline.shotlist];
    const shot = { ...updatedShotlist[idx] };
    const refs = { ...(shot.refs || { characters: [], props: [], environments: [] }) };
    refs[refType] = [...(refs[refType] || []), newId];
    shot.refs = refs;
    updatedShotlist[idx] = shot;

    const newPipe = { ...pipeline, shotlist: updatedShotlist };
    updatePipeline({ shotlist: updatedShotlist });
    
    // update global data explicitly
    onChange({ 
      ...data, 
      [refType]: [...(data[refType] || []), newEntity],
      pipeline: newPipe 
    });
  }

  const addShot = () => {
    const num = pipeline.shotlist.length + 1
    const newShot = { id: `SL_${String(num).padStart(3, '0')}`, shotNumber: num, type: 'MEDIUM', description: '', action: '', dialogue: '', camera: '', notes: '', approved: false, aiSuggestion: '' }
    updatePipeline({ shotlist: [...pipeline.shotlist, newShot] })
  }

  const removeShot = (idx) => {
    const updated = pipeline.shotlist.filter((_, i) => i !== idx)
    updatePipeline({ shotlist: updated })
  }

  const approvedCount = pipeline.shotlist.filter(s => s.approved).length
  const totalShots = pipeline.shotlist.length

  const handlePushToProduction = () => {
    customConfirm(t.pushConfirm, () => {
      // Convert approved shotlist to production shots with entity references
      const productionShots = pipeline.shotlist.filter(s => s.approved).map(s => {
      const refs = s.refs || { characters: [], props: [], environments: [] }
      // Build a rich prompt that includes entity names as context
      const charNames = (refs.characters || []).map(id => {
        const c = (data.characters || []).find(ch => ch.id === id)
        return c ? c.name : id
      }).filter(Boolean)
      const propNames = (refs.props || []).map(id => {
        const p = (data.props || []).find(pr => pr.id === id)
        return p ? p.name : id
      }).filter(Boolean)
      const envNames = (refs.environments || []).map(id => {
        const e = (data.environments || []).find(en => en.id === id)
        return e ? e.name : id
      }).filter(Boolean)
      let contextLine = ''
      if (charNames.length) contextLine += `Characters: ${charNames.join(', ')}. `
      if (propNames.length) contextLine += `Props: ${propNames.join(', ')}. `
      if (envNames.length) contextLine += `Environment: ${envNames.join(', ')}. `

      return {
        id: `SHOT_${s.id}`,
        beat: `[${s.type}] ${s.description}${s.action ? '\nAction: ' + s.action : ''}${s.dialogue ? '\nDialogue: ' + s.dialogue : ''}${contextLine ? '\nContext: ' + contextLine : ''}`,
        camera: s.camera,
        notes: s.notes,
        modelId: 'fal-ai/flux-pro/v1.1',
        kind: 't2i',
        relatedCharacters: refs.characters || [],
        relatedProps: refs.props || [],
        relatedEnvironments: refs.environments || [],
        relatedNodes: [...(refs.characters || []), ...(refs.props || []), ...(refs.environments || [])],
        settings: {}
      }
    })
    const existingShots = data.shots || []
    onChange({ ...data, shots: [...existingShots, ...productionShots] })
    if (onPushToProduction) onPushToProduction()
    })
  }

  return (
    <div className="step-content fade-in" style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      <div className="director-main" style={{ flex: 1, minWidth: 0 }}>
        <div className="step-header">
          <div className="header-with-action">
          <h2>{t.directorTitle} <span className="gradient-text">{t.directorHighlight}</span></h2>
          <div className="header-btns">
            <div className="director-lang-picker">
              <span className="tiny-label">{t.langLabel}</span>
              <select className="select-mini" value={pipeline.language} onChange={(e) => updatePipeline({ language: e.target.value })}>
                <option value="en">ðŸ‡¬ðŸ‡§ English</option>
                <option value="es">ðŸ‡ªðŸ‡¸ EspaÃ±ol</option>
              </select>
            </div>
          </div>
        </div>
        <p className="step-subtitle">{t.directorSub}</p>
      </div>

      {/* Phase Progress Bar */}
      <div className="director-phases glass">
        {phases.map((p, i) => {
          const isReachable = i === 0 || (i === 1 && pipeline.script?.trim()) || (i === 2 && pipeline.shotlist?.length > 0) || i <= phaseIdx;
          return (
            <button key={p.key} className={`director-phase-btn ${i === phaseIdx ? 'active' : ''} ${i < phaseIdx ? 'completed' : ''}`}
              onClick={() => { if (isReachable) updatePipeline({ phase: p.key }) }}
              style={{ opacity: isReachable ? 1 : 0.4, cursor: isReachable ? 'pointer' : 'not-allowed' }}>
              <span className="phase-icon">{i < phaseIdx ? 'âœ“' : p.icon}</span>
              <span className="phase-label">{p.label}</span>
            </button>
          )
        })}
        <div className="phase-progress-track">
          <div className="phase-progress-fill" style={{ width: `${(phaseIdx / 2) * 100}%` }}></div>
        </div>
      </div>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€ PHASE 1: IDEA â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {pipeline.phase === 'idea' && (
        <div className="director-panel glass fade-in">
          <textarea
            className="director-textarea"
            rows={12}
            value={pipeline.idea}
            placeholder={t.ideaPlaceholder}
            onChange={(e) => updatePipeline({ idea: e.target.value })}
          />
          <div className="director-actions">
            <button className="btn-director-primary" disabled={!pipeline.idea.trim() || loading} onClick={handleGenerateScript}>
              {loading ? <><span className="enhance-spinner">âŸ³</span> {t.generatingScript}</> : t.generateScript}
            </button>
          </div>
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€ PHASE 2: SCREENPLAY â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {pipeline.phase === 'script' && (
        <div className="director-panel glass fade-in">
          <div className="director-nav-back">
            <button className="btn-ghost" onClick={() => updatePipeline({ phase: 'idea' })}>{t.backToIdea}</button>
          </div>
          <div className="script-header">
            <span className="entity-badge">{t.scriptLabel}</span>
            <button className="btn-mini-refresh" onClick={() => setEditingScript(!editingScript)}>
              {editingScript ? 'ðŸ‘ï¸ Preview' : `âœï¸ ${t.editScript}`}
            </button>
          </div>
          {editingScript ? (
            <textarea
              className="director-textarea script-edit"
              rows={20}
              value={pipeline.script}
              onChange={(e) => updatePipeline({ script: e.target.value })}
            />
          ) : (
            <div className="screenplay-display">
              {pipeline.script.split('\n').map((line, i) => {
                const trimmed = line.trim()
                const isSceneHeading = /^(INT\.|EXT\.|INT\/EXT\.)/.test(trimmed.toUpperCase())
                const isCharName = /^[A-ZÃÃ‰ÃÃ“ÃšÃ‘\s]{2,}$/.test(trimmed) && trimmed.length < 30
                const isParenthetical = /^\(.*\)$/.test(trimmed)
                const isTransition = /^(FADE|CUT|DISSOLVE|SMASH|MATCH)/.test(trimmed.toUpperCase())
                return (
                  <div key={i} className={`script-line ${isSceneHeading ? 'scene-heading' : ''} ${isCharName ? 'char-name' : ''} ${isParenthetical ? 'parenthetical' : ''} ${isTransition ? 'transition' : ''} ${!trimmed ? 'empty-line' : ''}`}>
                    {line || '\u00A0'}
                  </div>
                )
              })}
            </div>
          )}
          <div className="director-actions">
            <button className="btn-director-secondary" onClick={handleGenerateScript} disabled={loading}>
              â†» {pipeline.language === 'es' ? 'Regenerar' : 'Regenerate'}
            </button>
            <button className="btn-director-primary" disabled={!pipeline.script.trim() || loading} onClick={handleGenerateShotlist}>
              {loading ? <><span className="enhance-spinner">âŸ³</span> {pipeline.language === 'es' ? 'Generando shotlist...' : 'Generating shotlist...'}</> : t.approveScript}
            </button>
          </div>
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€ PHASE 3: SHOTLIST â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {pipeline.phase === 'shotlist' && (
        <div className="director-panel glass fade-in">
          <div className="director-nav-back">
            <button className="btn-ghost" onClick={() => updatePipeline({ phase: 'script' })}>{t.backToScript}</button>
          </div>
          <div className="shotlist-header">
            <h3>{t.shotlistTitle} <span className="gradient-text">{t.shotlistHighlight}</span></h3>
            <div className="shotlist-stats">
              <button className="btn-mini-export" onClick={exportShotlistCsv} title="Export as CSV">â¬‡ Export CSV</button>
              <button className="btn-approve-all" onClick={approveAllShots}>
                {pipeline.shotlist.every(s => s.approved) ? t.unapproveAll : t.approveAll}
              </button>
              <span className={`stat-badge ${approvedCount === totalShots ? 'all-approved' : ''}`}>
                {approvedCount === totalShots ? `âœ“ ${t.allShotsApproved}` : `${totalShots - approvedCount} ${t.pendingShots}`}
              </span>
              <span className="stat-count">{approvedCount}/{totalShots}</span>
            </div>
          </div>

          <div className="shotlist-grid">
            {pipeline.shotlist.map((shot, idx) => (
              <div key={shot.id} className={`shot-card glass ${shot.approved ? 'approved' : ''}`}>
                <div className="shot-card-header">
                  <span className="shot-number">#{shot.shotNumber}</span>
                  <span className="shot-id">{shot.id}</span>
                  <select className="select-mini shot-type-select" value={shot.type} onChange={(e) => updateShot(idx, 'type', e.target.value)}>
                    {SHOT_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <div className="shot-card-actions">
                    <button className={`btn-approve ${shot.approved ? 'active' : ''}`} onClick={() => toggleApproveShot(idx)} title={t.approveShot}>
                      {shot.approved ? 'âœ“' : 'â—‹'}
                    </button>
                    <button className="btn-ai-assist" onClick={() => { setAssistIdx(assistIdx === idx ? null : idx); setAssistText('') }} title={t.aiAssist}><Sparkles size={16} className="lucide-icon" /></button>
                    <button className="btn-shot-remove" onClick={() => removeShot(idx)} title={t.removeShot}>Ã—</button>
                  </div>
                </div>

                <div className="shot-card-body">
                  <div className="shot-field">
                    <label className="tiny-label">{t.shotDesc}</label>
                    <textarea className="shot-textarea" rows={2} value={shot.description} onChange={(e) => updateShot(idx, 'description', e.target.value)} />
                  </div>
                  <div className="shot-field-row">
                    <div className="shot-field flex-1">
                      <label className="tiny-label">{t.shotAction}</label>
                      <textarea className="shot-textarea" rows={2} value={shot.action} onChange={(e) => updateShot(idx, 'action', e.target.value)} />
                    </div>
                    <div className="shot-field flex-1">
                      <label className="tiny-label">{t.shotDialogue}</label>
                      <textarea className="shot-textarea" rows={2} value={shot.dialogue} onChange={(e) => updateShot(idx, 'dialogue', e.target.value)} />
                    </div>
                  </div>
                  <div className="shot-field-row">
                    <div className="shot-field flex-1">
                      <label className="tiny-label">{t.shotCamera}</label>
                      <input className="shot-input" value={shot.camera} onChange={(e) => updateShot(idx, 'camera', e.target.value)} />
                    </div>
                    <div className="shot-field flex-1">
                      <label className="tiny-label">{t.shotNotes}</label>
                      <input className="shot-input" value={shot.notes} onChange={(e) => updateShot(idx, 'notes', e.target.value)} />
                    </div>
                  </div>

                  {/* <Flame size={16} className="lucide-icon" /> Entity References Picker */}
                  <div className="shot-refs-zone">
                    <label className="tiny-label">{t.entityRefs}</label>
                    <div className="ref-groups">
                      <div className="ref-group">
                        <span className="ref-group-label char"><Theater size={16} className="lucide-icon" /> {t.refChars} <button className="btn-tiny-add" onClick={() => addQuickEntityFromShotlist(idx, 'characters')} title="Add new character">+</button></span>
                        <div className="ref-pills">
                          {data.characters?.map(c => (
                            <button
                              key={c.id}
                              className={`ref-pill char ${(shot.refs?.characters || []).includes(c.id) ? 'active' : ''}`}
                              onClick={() => { toggleShotRef(idx, 'characters', c.id); setActiveSidebarPanel({ type: 'characters', id: c.id }); }}
                              title={c.prompt?.slice(0, 60)}
                            >
                              {c.name || c.id}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="ref-group">
                        <span className="ref-group-label prop"><PenTool size={16} className="lucide-icon" /> {t.refProps} <button className="btn-tiny-add" onClick={() => addQuickEntityFromShotlist(idx, 'props')} title="Add new prop">+</button></span>
                        <div className="ref-pills">
                          {data.props?.map(p => (
                            <button
                              key={p.id}
                              className={`ref-pill prop ${(shot.refs?.props || []).includes(p.id) ? 'active' : ''}`}
                              onClick={() => { toggleShotRef(idx, 'props', p.id); setActiveSidebarPanel({ type: 'props', id: p.id }); }}
                              title={p.prompt?.slice(0, 60)}
                            >
                              {p.name || p.id}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="ref-group">
                        <span className="ref-group-label env"><Globe size={16} className="lucide-icon" /> {t.refEnvs} <button className="btn-tiny-add" onClick={() => addQuickEntityFromShotlist(idx, 'environments')} title="Add new environment">+</button></span>
                        <div className="ref-pills">
                          {data.environments?.map(e => (
                            <button
                              key={e.id}
                              className={`ref-pill env ${(shot.refs?.environments || []).includes(e.id) ? 'active' : ''}`}
                              onClick={() => { toggleShotRef(idx, 'environments', e.id); setActiveSidebarPanel({ type: 'environments', id: e.id }); }}
                              title={e.prompt?.slice(0, 60)}
                            >
                              {e.name || e.id}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Assist Panel */}
                {assistIdx === idx && (
                  <div className="ai-assist-panel fade-in">
                    <textarea
                      className="ai-assist-input"
                      rows={2}
                      placeholder={t.aiPlaceholder}
                      value={assistText}
                      onChange={(e) => setAssistText(e.target.value)}
                    />
                    <button className="btn-ai-send" disabled={assistLoading || !assistText.trim()} onClick={() => handleAiAssist(idx)}>
                      {assistLoading ? <span className="enhance-spinner">âŸ³</span> : 'â†’'}
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div className="add-task-placeholder glass" onClick={addShot}>{t.addShot}</div>
          </div>

          <div className="director-actions">
            <button className="btn-director-secondary" onClick={handleGenerateShotlist} disabled={loading}>
              {loading ? <span className="enhance-spinner">âŸ³</span> : 'â†»'} {t.regenerateShotlist}
            </button>
            <button className="btn-director-primary push-btn" disabled={approvedCount === 0} onClick={handlePushToProduction} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span>{t.pushProduction}</span>
              <span style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>
                Est: {formatCost(pipeline.shotlist.filter(s => s.approved).reduce((acc, s) => acc + (calculatePreviewCost('fal-ai/flux-pro/v1.1', { prompt: s.description }) || 0), 0))}
              </span>
            </button>
          </div>
        </div>
      )}
      </div>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€ SAVED VERSIONS / ENTITY INSPECTOR SIDEBAR â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="director-sidebar glass" style={{ width: '300px', flexShrink: 0, position: 'sticky', top: '24px', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
        {activeSidebarPanel === 'versions' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', margin: 0, fontWeight: 600 }}>Saved Versions</h3>
              <button className="btn-mini-add" onClick={saveSnapshot} title="Save current pipeline state" style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {data.directorSnapshots?.length > 0 ? data.directorSnapshots.map(snap => (
            <div key={snap.id} className="snapshot-card glass" style={{ padding: '12px', cursor: 'pointer', position: 'relative', transition: 'all 0.2s', border: '1px solid rgba(255,255,255,0.05)' }} onClick={() => loadSnapshot(snap)} onPointerEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'} onPointerLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}>
               <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', paddingRight: '20px' }}>{snap.name}</div>
               <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(snap.date).toLocaleString()}</div>
               <div style={{ fontSize: '11px', marginTop: '6px', color: 'var(--primary-accent)' }}>
                 {snap.pipelineData.phase.toUpperCase()} â€¢ {snap.pipelineData.shotlist?.length || 0} shots
               </div>
               <button className="btn-shot-remove" style={{ position: 'absolute', top: '8px', right: '8px', width: '20px', height: '20px', padding: 0 }} onClick={(e) => { e.stopPropagation(); deleteSnapshot(snap.id) }} title="Delete">Ã—</button>
            </div>
          )) : <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No saved versions yet. Click '+' to save your progress.</div>}
            </div>
          </>
        ) : (
          <EntitySidebarInspector 
            session={session} 
            activeSidebarPanel={activeSidebarPanel} 
            data={data} 
            onChange={onChange} 
            onClose={() => setActiveSidebarPanel('versions')} 
          />
        )}
      </div>
    </div>
  )
}

function StepProject({ data, projects, loadingProjects, onSelectProject, onDeleteProject, onNewProject, onChange, isSaving }) {
  const fileRef = useRef()
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [newProjectModal, setNewProjectModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')

  const handleImportContract = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const contract = JSON.parse(ev.target.result)
        const imported = parseContract(contract)
        onChange({ ...data, ...imported, _importedFileName: file.name })
      } catch (err) { toast.error('Error parsing JSON: ' + err.message) }
    }
    reader.readAsText(file)
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm || !onDeleteProject) return
    setIsDeleting(true)
    await onDeleteProject(deleteConfirm)
    setIsDeleting(false)
    setDeleteConfirm(null)
  }

  const handleCreateProjectSubmit = async () => {
    if (!newProjectName.trim()) return
    setNewProjectModal(false)
    await onNewProject(newProjectName.trim())
    setNewProjectName('')
  }

  const handleDownloadFirst = async () => {
    if (!deleteConfirm) return
    setIsDownloading(true)
    // We need to load the project's full data first
    try {
      const { data: fullProj } = await supabase.from('projects').select('*').eq('id', deleteConfirm.id).single()
      if (fullProj) {
        const contract = fullProj.contract || {}
        const projData = {
          projectName: fullProj.name,
          format: contract.format || '',
          characters: contract.characters || [],
          props: contract.props || [],
          environments: contract.environments || [],
          shots: contract.shots || [],
          videos: contract.videos || [],
          freestyleExperiments: contract.freestyleExperiments || [],
          pipeline: contract.pipeline || {}
        }
        // Export functionality has been migrated to StepExport and N8N
      }
    } catch (e) {
      toast.error('Download failed: ' + e.message)
    }
    setIsDownloading(false)
  }

  return (
    <div className="step-content fade-in">
      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm && createPortal(
        <div className="overlay" onClick={() => !isDeleting && !isDownloading && setDeleteConfirm(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-icon"><Trash2 size={16} className="lucide-icon" /></div>
            <h3 className="dialog-title">Delete Project</h3>
            <p className="dialog-body">Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>?</p>
            <p className="dialog-warn">This will permanently remove the project and all its generated assets. This action cannot be undone.</p>
            <div className="dialog-actions-col">
              <button className="btn" onClick={handleDownloadFirst} disabled={isDeleting || isDownloading}>
                {isDownloading ? 'â³ Downloading...' : 'ðŸ“¦ Download ZIP First'}
              </button>
              <div className="dialog-actions">
                <button className="btn ghost" onClick={() => setDeleteConfirm(null)} disabled={isDeleting || isDownloading}>Cancel</button>
                <button className="btn danger" onClick={handleConfirmDelete} disabled={isDeleting || isDownloading}>
                  {isDeleting ? 'Deleting...' : 'ðŸ—‘ï¸ Delete Project'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom New Project Modal */}
      {newProjectModal && createPortal(
        <div className="overlay" onClick={() => setNewProjectModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-icon"><Clapperboard size={16} className="lucide-icon" /></div>
            <h3 className="dialog-title">New Cinematic Project</h3>
            <p className="dialog-body" style={{marginBottom: '1rem'}}>Enter a title for your new AI production.</p>
            <input 
              type="text" 
              className="input" 
              placeholder="e.g. THE NEON HEIST" 
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateProjectSubmit()}
              autoFocus
              style={{marginBottom: '1.5rem'}}
            />
            <div className="dialog-actions">
              <button className="btn ghost" onClick={() => setNewProjectModal(false)}>Cancel</button>
              <button className="btn primary" onClick={handleCreateProjectSubmit} disabled={!newProjectName.trim()}><Rocket size={16} className="lucide-icon" /> Create Project
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="step-header">
        <h2>Project <span className="gradient-text">Selector</span></h2>
        <p>Choose an existing production or start a new cinematic project.</p>
        <div className={`sync-status-global ${isSaving ? 'saving' : 'synced'}`}>
          {isSaving ? 'â— Autosaving...' : 'âœ“ Database Synced'}
        </div>
      </div>

      <div className="project-selector-zone glass">
        {loadingProjects ? (
          <div className="loading-spinner-box"><div className="spinner-sm"></div> Loading Production Registry...</div>
        ) : (
          <div className="projects-grid">
            {projects.map(p => (
              <div key={p.id} className={`project-pill ${data.projectName === p.name ? 'active' : ''}`} onClick={() => onSelectProject(p)}>
                <span className="pill-icon"><Clapperboard size={16} className="lucide-icon" /></span>
                <span className="pill-name">{p.name}</span>
                {onDeleteProject && (
                  <button className="pill-delete" onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setDeleteConfirm(p);
                  }} title={'Delete ' + p.name}><X size={16} className="lucide-icon" /></button>
                )}
              </div>
            ))}
            <div className="project-pill add-new" onClick={() => setNewProjectModal(true)}>
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
            <div className="upload-done"><span className="icon"><CheckCircle size={16} className="lucide-icon" /></span><span>{data._importedFileName} â€” loaded</span></div>
          ) : (
            <><span className="icon"><Package size={16} className="lucide-icon" /></span><span>Click to import B_CONTRACT (.json)</span></>
          )}
        </div>
      </div>

      <div className="form-grid-2 mt-16">
        <div className="form-group">
          <label>Project Title</label>
          <input type="text" className="input" placeholder="e.g. LA PUJA" readOnly
            value={data.projectName || ''} />
        </div>
        <div className="form-group">
          <label>Format</label>
          <select className="input" value={data.format || 'film_essay_montage'} onChange={(e) => onChange({ ...data, format: e.target.value })}>
            <option value="film_essay_montage">Film Essay Montage</option>
            <option value="narrative_short">Narrative Short</option>
          </select>
        </div>
      </div>
    </div>
  )
}

function StepCharacters({ data, onChange, session }) {
  const chars = data.characters || []
  const { media, loading, refresh } = useDriveMedia(data.projectName, 'character')
  const [exportStatus, setExportStatus] = useState(null)

  const addChar = () => onChange({ ...data, characters: [...chars, { id: genId('CHAR'), name: '', description: '', prompt: '', lastGeneratedPrompt: '', modelId: 'fal-ai/flux-pro/v1.1' }] })
  const updateChar = (idx, field, val) => {
    const u = [...chars]; u[idx] = { ...u[idx], [field]: val };
    onChange({ ...data, characters: u })
  }

  const handleGenerate = async (char) => {
    try {
      const { data: proj } = await supabase.from('projects').select('id').eq('name', data.projectName).single();
      if (proj) {
        const timestamp = Date.now();
        const { data: inserted } = await supabase.from('renderfarm_outputs').insert([{
          project_id: proj.id,
          task_id: char.id,
          file_name: `${(char.name || 'char').replace(/\\s+/g, '_')}_${timestamp}.png`,
          kind: 't2i',
          status: 'processing',
          profile_id: session?.user?.id,
          metadata: { prompt: char.prompt, modelId: char.modelId, settings: char.settings }
        }]).select('id').single();
        refresh();

        const rowId = inserted?.id;
        fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ 
            project: { title: data.projectName }, 
            task: { id: char.id, row_id: rowId, prompt: char.prompt, modelId: char.modelId, kind: 't2i', settings: char.settings || {}, user_id: session?.user?.id, ref_image: null, ref_images: [] } 
          })
        }).catch(err => console.error('Webhook dispatch error:', err));
      }
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="step-content fade-in">
      <div className="step-header">
        <div className="header-with-action">
          <h2>Character <span className="gradient-text">Production</span></h2>
          <div className="header-btns">
            <button className="btn-mini-refresh" disabled={exportStatus !== null} onClick={() => {
                if(!data.projectName) return toast.error('No project name set.');
                triggerN8NExport(data.projectName, '_CHAR', 
                  (msg) => setExportStatus(msg), 
                  (url) => {
                    setExportStatus(null);
                    if(url) {
                       const a = document.createElement('a');
                       a.href = url;
                       a.target = '_blank';
                       a.click();
                    }
                  }
                );
            }}><Package size={16} className={`lucide-icon ${exportStatus ? 'spinning' : ''}`} /> {exportStatus || 'ZIP Production'}</button>
            <div className="master-model-zone">
              <span className="tiny-label">MASTER MODEL</span>
              <ModelPicker type="image" value={chars[0]?.modelId || 'fal-ai/flux-pro/v1.1'} onChange={(v) => {
                const u = chars.map(c => ({ ...c, modelId: v }))
                onChange({ ...data, characters: u })
              }} />
            </div>
            <button className="btn-director-primary" onClick={() => chars.forEach(c => handleGenerate(c))}><Zap size={16} className="lucide-icon" /> Generate All ({formatCost(chars.reduce((acc, c) => acc + (calculatePreviewCost(c.modelId || 'fal-ai/flux-pro/v1.1', { ...optionsToParams(getModelOptions(c.modelId)), prompt: c.prompt }) || 0), 0))})
            </button>
            <button className={`btn-refresh ${loading ? 'spinning' : ''}`} onClick={refresh}>â†» Sync</button>
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
            onDeleteEntity={async () => { await deleteAllVariantsForTask(c.id, media); const u = [...chars]; u.splice(idx, 1); onChange({ ...data, characters: u }); refresh(); }}
            onDiscardVariant={async (v) => { await deleteVariant(v); refresh(); }}
          />
        ))}
        <div className="add-task-placeholder glass" onClick={addChar}>+ Add New Character Unit</div>
      </div>
    </div>
  )
}

function StepProps({ data, onChange, session }) {
  const props = data.props || []
  const { media, loading, refresh } = useDriveMedia(data.projectName, 'prop', session)
  const addProp = () => onChange({ ...data, props: [...props, { id: genId('PROP'), name: '', description: '', prompt: '', lastGeneratedPrompt: '', modelId: 'fal-ai/flux-pro/v1.1' }] })
  const updateProp = (idx, field, val) => {
    const u = [...props]; u[idx] = { ...u[idx], [field]: val };
    onChange({ ...data, props: u })
  }

  const handleGenerate = async (prop) => {
    try {
      const { data: proj } = await supabase.from('projects').select('id').eq('name', data.projectName).single();
      if (proj) {
        const timestamp = Date.now();
        const { data: inserted } = await supabase.from('renderfarm_outputs').insert([{
          project_id: proj.id, task_id: prop.id, file_name: `${prop.name.replace(/\\s+/g, '_') || 'prop'}_${timestamp}.png`,
          kind: 't2i', status: 'processing', profile_id: session?.user?.id,
          metadata: { prompt: prop.prompt, modelId: prop.modelId, settings: prop.settings }
        }]).select('id').single();
        refresh();

        const rowId = inserted?.id;
        fetch(N8N_WEBHOOK_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ project: { title: data.projectName }, task: { id: prop.id, row_id: rowId, prompt: prop.prompt, modelId: prop.modelId, kind: 't2i', settings: prop.settings || {}, user_id: session?.user?.id, ref_image: null, ref_images: [] } })
        }).catch(err => console.error('Webhook dispatch error:', err));
      }
    } catch (e) { toast.error(e.message) }
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
             <button className="btn-director-primary" onClick={() => props.forEach(p => handleGenerate(p))}><Zap size={16} className="lucide-icon" /> Generate All ({formatCost(props.reduce((acc, p) => acc + (calculatePreviewCost(p.modelId || 'fal-ai/flux-pro/v1.1', { ...optionsToParams(getModelOptions(p.modelId)), prompt: p.prompt }) || 0), 0))})
             </button>
             <button className={`btn-refresh ${loading ? 'spinning' : ''}`} onClick={refresh}>â†» Sync</button>
          </div>
        </div>
      </div>
      <div className="tasks-grid">
        {props.map((p, idx) => (
          <EntityTaskCard key={p.id} badge="PROP" name={p.name} id={p.id} data={p} driveMedia={media}
            onUpdate={(f, v) => updateProp(idx, f, v)} onGenerate={() => handleGenerate(p)}
            onSelectVersion={(v) => updateProp(idx, 'selectedVersionId', v.id)}
            selectedVersion={media.find(m => m.id === p.selectedVersionId)}
            onDeleteEntity={async () => { await deleteAllVariantsForTask(p.id, media); const u = [...props]; u.splice(idx, 1); onChange({ ...data, props: u }); refresh(); }}
            onDiscardVariant={async (v) => { await deleteVariant(v); refresh(); }}
          />
        ))}
        <div className="add-task-placeholder glass" onClick={addProp}>+ Add Prop Unit</div>
      </div>
    </div>
  )
}

function StepEnvironments({ data, onChange, session }) {
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
        const timestamp = Date.now();
        const { data: inserted } = await supabase.from('renderfarm_outputs').insert([{
          project_id: proj.id, task_id: env.id, file_name: `${(env.name || 'loc').replace(/\\s+/g, '_')}_${timestamp}.png`,
          kind: 't2i', status: 'processing', profile_id: session?.user?.id,
          metadata: { prompt: env.prompt, modelId: env.modelId, settings: env.settings }
        }]).select('id').single();
        refresh();

        const rowId = inserted?.id;
        fetch(N8N_WEBHOOK_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ project: { title: data.projectName }, task: { id: env.id, row_id: rowId, prompt: env.prompt, modelId: env.modelId, kind: 't2i', settings: env.settings || {}, user_id: session?.user?.id, ref_image: null, ref_images: [] } })
        }).catch(err => console.error('Webhook dispatch error:', err));
      }
    } catch (e) { toast.error(e.message) }
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
             <button className="btn-director-primary" onClick={() => envs.forEach(e => handleGenerate(e))}><Zap size={16} className="lucide-icon" /> Generate All ({formatCost(envs.reduce((acc, e) => acc + (calculatePreviewCost(e.modelId || 'fal-ai/flux-pro/v1.1', { ...optionsToParams(getModelOptions(e.modelId)), prompt: e.prompt }) || 0), 0))})
             </button>
             <button className={`btn-refresh ${loading ? 'spinning' : ''}`} onClick={refresh}>â†» Sync</button>
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
            onDeleteEntity={async () => { await deleteAllVariantsForTask(e.id, media); const u = [...envs]; u.splice(idx, 1); onChange({ ...data, environments: u }); refresh(); }}
            onDiscardVariant={async (v) => { await deleteVariant(v); refresh(); }}
          />
        ))}
        <div className="add-task-placeholder glass" onClick={addEnv}>+ Add Environment Unit</div>
      </div>
    </div>
  )
}

function StepShots({ data, onChange, session }) {
  const [activeShotIdx, setActiveShotIdx] = useState(0);
  const shots = data.shots || []
  const { media, loading, refresh } = useDriveMedia(data.projectName, 'shot', session)
  const addShot = () => onChange({ ...data, shots: [...shots, { id: `SHOT___${String(shots.length + 1).padStart(3, '0')}`, beat: '', duration: 5, shotSize: 'MS', cameraMove: 'micro_push', modelId: 'fal-ai/flux-pro/v1.1-ultra' }] })

  const updateShot = (idx, field, val) => {
    const u = [...shots]; u[idx] = { ...u[idx], [field]: val };
    onChange({ ...data, shots: u })
  }

  const extractGdriveId = (url) => {
    if (!url) return null;
    const match = url.match(/id=([^&]+)/) || url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  const toggleProductionRef = (shotId, refType, entityId) => {
    const shotIdx = shots.findIndex(s => s.id === shotId);
    if (shotIdx === -1) return;
    const shot = { ...shots[shotIdx] };
    const propName = refType === 'characters' ? 'relatedCharacters' : refType === 'props' ? 'relatedProps' : 'relatedEnvironments';
    const list = shot[propName] || [];
    let updatedList;
    if (list.includes(entityId)) {
       updatedList = list.filter(id => id !== entityId);
    } else {
       updatedList = [...list, entityId];
    }
    updateShot(shotIdx, propName, updatedList);
  };

  const addQuickEntityFromProduction = (shotId, refType) => {
    const singleType = refType === 'characters' ? 'Character' : refType === 'props' ? 'Prop' : 'Environment';
    const name = window.prompt(`Enter name for new ${singleType}:`);
    if(!name || !name.trim()) return;

    let prefix = refType === 'characters' ? 'CHAR' : refType === 'props' ? 'PROP' : 'ENV';
    const newId = `${prefix}_${Date.now()}`;
    const newEntity = { id: newId, name: name.trim(), description: '', prompt: '', modelId: 'fal-ai/flux-pro/v1.1' };
    
    const shotIdx = shots.findIndex(s => s.id === shotId);
    const propName = refType === 'characters' ? 'relatedCharacters' : refType === 'props' ? 'relatedProps' : 'relatedEnvironments';
    const shot = { ...shots[shotIdx] };
    shot[propName] = [...(shot[propName] || []), newId];
    
    const u = [...shots]; u[shotIdx] = shot;

    onChange({ 
      ...data, 
      [refType]: [...(data[refType] || []), newEntity],
      shots: u 
    });
  };

  const handleGenerate = async (shot, dependencies) => {
    try {
      const { data: proj } = await supabase.from('projects').select('id').eq('name', data.projectName).single();
      if (proj) {
        const timestamp = Date.now();
        const { data: inserted } = await supabase.from('renderfarm_outputs').insert([{
          project_id: proj.id, task_id: shot.id, file_name: `${shot.id}_${timestamp}.png`,
          kind: 'i2i', status: 'processing', profile_id: session?.user?.id,
          metadata: { prompt: shot.beat, modelId: shot.modelId, settings: shot.settings }
        }]).select('id').single();
        refresh();

        const rowId = inserted?.id;

        // Collect ALL connected references as image URLs
        const ref_urls = dependencies.map(dep => {
          if (!dep.media) return null;
          if (dep.media.url && !dep.media.url.includes('drive.google')) return dep.media.url;
          const id = extractGdriveId(dep.media?.webViewLink);
          return id ? `https://drive.google.com/uc?export=download&id=${id}` : dep.media?.webViewLink;
        }).filter(Boolean);

        fetch(N8N_WEBHOOK_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ 
             project: { title: data.projectName }, 
             task: { 
               id: shot.id, 
               row_id: rowId,
               prompt: shot.beat, 
               modelId: shot.modelId, 
               kind: ref_urls.length > 0 ? 'i2i' : 't2i', 
               settings: shot.settings || {}, 
               user_id: session?.user?.id, 
               ref_image: ref_urls[0] || null,
               ref_images: ref_urls
             } 
          })
        }).catch(err => console.error('Webhook dispatch error:', err));
      }
    } catch (e) { toast.error(e.message) }
  }

  const activeShot = shots[activeShotIdx];

  return (
    <div className="step-content fade-in split-view-workspace">
      <div className="step-header">
        <div className="header-with-action">
          <h2>Shot Builder â€” <span className="gradient-text">Composition Engine</span></h2>
          <div className="header-btns">
            <ModelPicker type="image" value={shots[0]?.modelId} onChange={(v) => onChange({ ...data, shots: shots.map(s => ({ ...s, modelId: v })) })} />
            <button className={`btn-refresh ${loading ? 'spinning' : ''}`} onClick={refresh}>â†» Refresh View</button>
          </div>
        </div>
      </div>
      
      <div className="shot-navigator-strip">
        <div className="strip-scroll">
          {shots.map((s, idx) => (
             <button 
               key={s.id} 
               className={`shot-nav-btn glass ${idx === activeShotIdx ? 'active' : ''}`} 
               onClick={() => setActiveShotIdx(idx)}
             >
               <span className="shot-nav-number">#{idx + 1}</span>
               <span className="shot-nav-id">{s.id.replace('SHOT___', '')}</span>
             </button>
          ))}
          <button className="shot-nav-add glass" onClick={() => { addShot(); setActiveShotIdx(shots.length); }}>+ Add Shot</button>
        </div>
      </div>

      <div className="workspace-main-area">
        {activeShot ? (
           <EntityShotCard 
             key={activeShot.id} 
             data={activeShot} 
             projectData={data}
             driveMedia={media} 
             globalMedia={media} 
             onUpdate={(f, v) => updateShot(activeShotIdx, f, v)}
             onGenerate={handleGenerate}
             onSelectVersion={(v) => updateShot(activeShotIdx, 'selectedVersionId', v.id)}
             selectedVersion={media.find(m => m.id === activeShot.selectedVersionId)}
             onToggleRef={(type, entityId) => toggleProductionRef(activeShot.id, type, entityId)}
             onAddQuickEntity={(type) => addQuickEntityFromProduction(activeShot.id, type)}
             onDeleteEntity={async () => { await deleteAllVariantsForTask(activeShot.id, media); const u = [...shots]; u.splice(activeShotIdx, 1); onChange({ ...data, shots: u }); setActiveShotIdx(Math.max(0, activeShotIdx - 1)); refresh(); }}
             onDiscardVariant={async (v) => { await deleteVariant(v); refresh(); }}
           />
        ) : (
           <div className="empty-workspace glass">
              <p>No shots available.</p>
              <button className="btn-director-primary push-btn" onClick={addShot}>Create First Shot</button>
           </div>
        )}
      </div>
    </div>
  )
}

function StepFreestyle({ data, onChange, session }) {
  const [, setExecuting] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState(null)
  const { media: results, loading, refresh: refreshResults } = useDriveMedia('FREESTYLE_LAB', 'freestyle', session)
  
  useEffect(() => {
    const handleEsc = (e) => { if(e.key === 'Escape') setFullscreenImage(null); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);
  
  const experiments = data.freestyleExperiments || []

  const getDefaultModelForMode = (mode) => {
    const regKey = MODALITIES[mode]?.reg || 'image'
    const cats = MODEL_REGISTRY[regKey] || MODEL_REGISTRY.image
    return cats[0]?.models[0]?.id || 'fal-ai/flux-pro/v1.1-ultra'
  }

  const addExperiment = () => {
    const id = genId('EXP')
    onChange({ 
      ...data, 
      freestyleExperiments: [
        ...experiments, 
        { id, name: 'New Experiment', prompt: '', modelId: 'fal-ai/flux-pro/v1.1-ultra', mode: 't2i', ref_image: null, ref_video: null, ref_audio: null }
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
     
     const formData = new FormData()
     formData.append('file', file)
     formData.append('projectName', data.projectName || 'Unassigned')
     formData.append('userId', session?.user?.id || 'anon')

     try {
       const res = await fetch(N8N_UPLOAD_WEBHOOK_URL, {
         method: 'POST',
         body: formData
       })
       
       if (!res.ok) throw new Error(`Upload webhook failed with status ${res.status}`)
       
       const result = await res.json()
       onCompleteCallback(result) // returns { url: "supabase...", hq_url: "drive..." }
     } catch (e) {
       toast.error("Upload failed: " + e.message)
     }
  }

  const handleExecute = async (exp) => {
    setExecuting(true)
    try {
      const { data: proj } = await supabase.from('projects').select('id').eq('name', 'FREESTYLE_LAB').single();
      if (!proj) return toast.error('FREESTYLE_LAB project not found in database.');

      const mod = MODALITIES[exp.mode] || MODALITIES.t2i;
      const kindPayload = exp.mode;
      const outputExt = mod.output === 'video' ? 'mp4' : mod.output === 'audio' ? 'mp3' : mod.output === '3d' ? 'glb' : 'png';
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

      fetch(N8N_WEBHOOK_URL, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ 
          project: { title: 'FREESTYLE_LAB' }, 
          task: { 
            id: exp.id, 
            prompt: exp.prompt, 
            modelId: exp.modelId, 
            kind: kindPayload, 
            freestyle: true,
            user_id: session?.user?.id,
            ref_image: exp.hq_url || (mod.input === 'image' ? exp.ref_image : null),
            ref_video: exp.hq_url || ((mod.input === 'video' || exp.mode === 'lip') ? exp.ref_image : null),
            ref_audio: exp.hq_audio || ((mod.input === 'audio' || exp.mode === 'lip') ? exp.ref_audio : null),
          } 
        })
      }).catch(err => console.error('Webhook dispatch error:', err));
      
      const idx = experiments.findIndex(e => e.id === exp.id)
      if (idx !== -1) updateExperiment(idx, 'lastGeneratedPrompt', exp.prompt)

    } catch (e) { 
      console.error(e) 
      toast.error('Error initiating alchemy: ' + e.message)
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
             <button className={`btn-refresh ${loading ? 'spinning' : ''}`} onClick={refreshResults}>â†» Refresh</button>
          </div>
        </div>
      </div>

      <div className="tasks-grid">
        {experiments.map((exp, idx) => {
          const variants = results?.filter(m => m.task_id === exp.id) || []
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
                    <span className="icon"><Zap size={16} className="lucide-icon" /></span>
                 </button>
              </div>
              <div className="header-tool-row">
                 <select className="select-mini" value={exp.mode} onChange={e => {
                    const newMode = e.target.value;
                    updateExperiment(idx, {
                      mode: newMode,
                      modelId: getDefaultModelForMode(newMode)
                    });
                 }}>
                   {Object.entries(MODALITIES).map(([k, v]) => (
                     <option key={k} value={k}>{v.label}</option>
                   ))}
                 </select>
                 <ModelPicker type={exp.mode} value={exp.modelId} onChange={(v) => updateExperiment(idx, 'modelId', v)} />
              </div>
            </div>

            <div className="render-preview-zone">
                {activeVariant ? (
                  activeVariant.status === 'processing' ? (
                    <div className="processing-placeholder">
                      <AlchemyProgress status="processing" realProgress={activeVariant.progress} statusMessage={activeVariant.statusMessage} />
                      <div className="spinner-center"></div>
                    </div>
                  ) : activeVariant.status === 'error' ? (
                    <div className="processing-placeholder error-state">
                      <AlchemyProgress status="error" statusMessage={activeVariant.statusMessage} />
                      <button className="btn-retry" onClick={() => handleFreestyleGenerate(experiments.findIndex(e => e.id === activeVariant.task_id?.split('___')[0] + '___' + activeVariant.task_id?.split('___')[1]))}><RefreshCw size={16} className="lucide-icon" /> Retry</button>
                    </div>
                  ) : (() => {
                    const mime = activeVariant.mimeType || '';
                    const fname = activeVariant.file_name || activeVariant.name || '';
                    const isVideo = mime.includes('video') || fname.endsWith('.mp4') || fname.endsWith('.webm');
                    const isAudio = mime.includes('audio') || fname.endsWith('.mp3') || fname.endsWith('.wav');
                    const is3D = fname.endsWith('.glb') || fname.endsWith('.obj') || fname.endsWith('.fbx');

                    if (isAudio) return (
                      <div className="preview-container preview-audio">
                        <div className="audio-viz-card">
                          <div className="audio-viz-icon"><Music size={16} className="lucide-icon" /></div>
                          <div className="audio-viz-bars">
                            {[...Array(20)].map((_, i) => <div key={i} className="audio-bar" style={{ animationDelay: `${i * 0.08}s` }}></div>)}
                          </div>
                          <audio src={getDriveDisplayUrl(activeVariant.webViewLink || activeVariant.thumbnailLink)} controls className="audio-player-full" />
                          <span className="audio-file-name">{fname}</span>
                        </div>
                      </div>
                    );

                    if (is3D) return (
                      <div className="preview-container preview-3d">
                        <div className="model3d-card">
                          <div className="cube-spinner">
                            <div className="cube-face front"></div>
                            <div className="cube-face back"></div>
                            <div className="cube-face left"></div>
                            <div className="cube-face right"></div>
                            <div className="cube-face top"></div>
                            <div className="cube-face bottom"></div>
                          </div>
                          <span className="model3d-label">{fname}</span>
                        </div>
                      </div>
                    );

                    if (isVideo) return (
                      <div className="preview-container">
                        <video src={getDriveDisplayUrl(activeVariant.webViewLink || activeVariant.thumbnailLink)} controls className="official-render cursor-zoom" autoPlay loop muted onClick={() => setFullscreenImage(activeVariant)} />
                      </div>
                    );

                    // Default: image
                    return (
                      <div className="preview-container">
                        <img src={getDriveDisplayUrl(activeVariant.thumbnailLink)} className="official-render cursor-zoom" alt={exp.name} onClick={() => setFullscreenImage(activeVariant)} />
                      </div>
                    );
                  })()
                ) : (
                   <div className="empty-render"><span className="empty-state-text">NO RENDER ASSET FOUND</span></div>
                )}
                
                {activeVariant && activeVariant.status === 'ready' && (() => {
                  const dlUrl = activeVariant.webViewLink || activeVariant.thumbnailLink;
                  const mime = activeVariant.mimeType || '';
                  const fname = activeVariant.file_name || activeVariant.name || '';
                  const isAudio = mime.includes('audio') || fname.endsWith('.mp3') || fname.endsWith('.wav');
                  const is3D = fname.endsWith('.glb') || fname.endsWith('.obj') || fname.endsWith('.fbx');
                  return (
                    <div className="preview-actions">
                      {!isAudio && !is3D && (
                        <button className="btn-preview-action" onClick={(e) => { e.stopPropagation(); setFullscreenImage(activeVariant); }} title="Fullscreen"><Maximize2 size={14} className="lucide-icon" /></button>
                      )}
                      <button className="btn-preview-action" onClick={(e) => { e.stopPropagation(); downloadAsset(activeVariant); }} title="Download"><Download size={14} className="lucide-icon" /></button>
                      <button className="btn-preview-action btn-preview-danger" onClick={(e) => { e.stopPropagation(); customConfirm('Discard this output? Your settings will be preserved.', () => { deleteVariant(activeVariant).then(() => refreshResults()); }); }} title="Discard this output"><Trash2 size={14} className="lucide-icon" /></button>
                    </div>
                  );
                })()}
            </div>

            <div className="task-body">
              <div className="prompt-wrapper">
                <textarea 
                  className="input-prompt" 
                  rows={2} 
                  value={exp.prompt} 
                  placeholder="Describe generation..."
                  onChange={e => updateExperiment(idx, 'prompt', e.target.value)}
                />
                <EnhanceButton value={exp.prompt} onChange={(v) => updateExperiment(idx, 'prompt', v)} modelId={exp.modelId} entityType="freestyle" modality={exp.mode || 't2i'} />
              </div>
              {(() => {
                const mod = MODALITIES[exp.mode];
                if (!mod || mod.input === 'text') return null;
                
                // Lipsync needs BOTH video + audio
                if (exp.mode === 'lip') return (
                  <>
                    <div className="upload-ref-box">
                      <label className="tiny-label">Reference Video</label>
                      {exp.ref_image ? (
                        <div className="ref-preview">
                          <video src={exp.ref_image} height={40} muted/>
                          <button onClick={()=>updateExperiment(idx, 'ref_image', null)}>x</button>
                        </div>
                      ) : (
                        <input type="file" accept="video/*" onChange={(e) => handleFileUpload(e.target.files[0], res => updateExperiment(idx, { ref_image: res.url || res, hq_url: res.hq_url }))} />
                      )}
                    </div>
                    <div className="upload-ref-box">
                      <label className="tiny-label">Audio / Dialogue</label>
                      {exp.ref_audio ? (
                        <div className="ref-preview">
                          <audio src={exp.ref_audio} controls style={{height:32}}/>
                          <button onClick={()=>updateExperiment(idx, 'ref_audio', null)}>x</button>
                        </div>
                      ) : (
                        <input type="file" accept="audio/*" onChange={(e) => handleFileUpload(e.target.files[0], res => updateExperiment(idx, { ref_audio: res.url || res, hq_url: res.hq_url }))} />
                      )}
                    </div>
                  </>
                );

                // Standard single-input for other modalities
                const inputType = mod.input;
                const acceptMap = { image: 'image/*', video: 'video/*', audio: 'audio/*' };
                const labelMap = { image: 'Reference Image', video: 'Reference Video', audio: 'Reference Audio' };
                const fieldKey = inputType === 'audio' ? 'ref_audio' : 'ref_image';
                const refVal = exp[fieldKey];
                return (
                  <div className="upload-ref-box">
                    <label className="tiny-label">{labelMap[inputType]}</label>
                    {refVal ? (
                      <div className="ref-preview">
                        {inputType === 'video' ? <video src={refVal} height={40} muted/> : inputType === 'audio' ? <audio src={refVal} controls style={{height:32}}/> : <img src={refVal} height={40}/>}
                        <button onClick={()=>updateExperiment(idx, fieldKey, null)}>x</button>
                      </div>
                    ) : (
                      <input type="file" accept={acceptMap[inputType]} onChange={(e) => handleFileUpload(e.target.files[0], res => updateExperiment(idx, { [fieldKey]: res.url || res, hq_url: res.hq_url }))} />
                    )}
                  </div>
                );
              })()}
            </div>
            
            <div className="task-card-footer-v2">
               <span className="telemetry-tag">{variants.length} Variants</span>
               <div className="footer-right-actions">
                  <button className="btn-delete-entity" onClick={async () => { customConfirm(`Delete experiment "${exp.name}" and all its outputs?`, async () => { await deleteAllVariantsForTask(exp.id, results); const u = [...experiments]; u.splice(idx, 1); onChange({ ...data, freestyleExperiments: u }); refreshResults(); }); }} title="Delete experiment">
                    <Trash2 size={12} className="lucide-icon" /> Delete
                  </button>
               </div>
            </div>
          </div>
        )})}
        <div className="add-task-placeholder glass" onClick={addExperiment}>
          + Register New Freestyle Unit
        </div>
      </div>

      {fullscreenImage && createPortal(
        <div className="lightbox-overlay fade-in" onClick={() => setFullscreenImage(null)}>
          <div className="lightbox-img-wrapper" onClick={(e) => e.stopPropagation()}>
             <div className="lightbox-controls">
                <button onClick={() => downloadAsset(fullscreenImage)} title="Download original"><Save size={16} className="lucide-icon" /></button>
                <button onClick={() => setFullscreenImage(null)} title="Close"><XCircle size={16} className="lucide-icon" /></button>
             </div>
             {fullscreenImage.mimeType?.includes('video') 
               ? <video src={getDriveDisplayUrl(fullscreenImage.webViewLink || fullscreenImage.hq_url)} controls autoPlay loop />
               : <img src={getDriveDisplayUrl(fullscreenImage.thumbnailLink || fullscreenImage.hq_url || fullscreenImage.url)} alt="preview" />
             }
             <div className="lightbox-metadata">
                {fullscreenImage.name} â€¢ {fullscreenImage.metadata?.prompt?.slice(0,40)}...
             </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}


// QuotaWidget imported from ./components/QuotaWidget.jsx
// LogMonitor imported from ./components/LogMonitor.jsx
function StepCanvas({ data, onChange, session }) {
  const { media } = useDriveMedia(data.projectName, null, session);
  
  const handleGenerateNode = async (node) => {
    try {
      const typeLabel = node.data.typeLabel;
      const rawData = node.data.rawData;
      const promptText = rawData.prompt || rawData.beat || '';
      
      let kindPayload = typeLabel === 'Video' ? 'i2v' : 't2i';
      // Shots are IMAGES composed from refs. If they have refs, it's i2i, otherwise t2i.
      if (typeLabel === 'Shot') {
        const deps = [...(rawData.relatedNodes || []), ...(rawData.relatedCharacters || []), ...(rawData.relatedProps || []), ...(rawData.relatedEnvironments || [])];
        kindPayload = deps.length > 0 ? 'i2i' : 't2i';
      }
      
      const extractLocalGdriveId = (url) => {
        if (!url) return null;
        if (url.includes('supabase.co') || url.includes('unsplash.com')) return url;
        const match = url.match(/id=([^&]+)/);
        return match ? match[1] : null;
      };
      
      const deps = [
        ...(rawData.relatedNodes || []), 
        ...(rawData.relatedCharacters || []), 
        ...(rawData.relatedProps || []), 
        ...(rawData.relatedEnvironments || []), 
        ...(rawData.relatedShots || []), 
        ...(rawData.relatedVideos || [])
      ];
      
      const allItems = [...(data.characters||[]), ...(data.props||[]), ...(data.environments||[]), ...(data.shots||[]), ...(data.videos||[])];
      const refs = allItems.filter(item => deps.includes(item.id));
      const ref_urls = refs.map(dep => {
        const m = media.find(md => md.task_id === dep.id && md.status === 'ready');
        const id = extractLocalGdriveId(m?.webViewLink);
        return id ? `https://drive.google.com/uc?export=download&id=${id}` : m?.webViewLink;
      }).filter(u => u);
      
      let primary_ref = ref_urls.length > 0 ? ref_urls[0] : null;
      let primary_video_ref = (typeLabel === 'Video') ? primary_ref : null;
      // For Shots: send ALL reference images
      const all_ref_images = (typeLabel === 'Shot') ? ref_urls : [];
      
      let pId = null;
      if (data.projectName) {
        const { data: proj } = await supabase.from('projects').select('id').eq('name', data.projectName).single();
        if (proj) pId = proj.id;
      }

      const { data: inserted, error: insertErr } = await supabase.from('renderfarm_outputs').insert([{
        task_id: node.id,
        project_id: pId,
        kind: kindPayload,
        status: 'processing',
        profile_id: session?.user?.id,
        file_name: `${node.id}_${Date.now()}.${typeLabel === 'Video' ? 'mp4' : 'png'}`,
        metadata: { mode: kindPayload, prompt: promptText, modelId: node.data.modelId, settings: rawData.settings }
      }]).select('id').single();
      if (insertErr) { console.error('INSERT failed:', insertErr); toast.error('Failed to queue task: ' + insertErr.message); return; }

      const rowId = inserted?.id;
      fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ 
          project: { title: data.projectName }, 
          task: { 
             id: node.id, 
             row_id: rowId,
             prompt: promptText, 
             modelId: node.data.modelId, 
             kind: kindPayload, 
             settings: rawData.settings || {}, 
             user_id: session?.user?.id,
             ref_image: primary_ref,
             ref_images: all_ref_images.length > 0 ? all_ref_images : undefined,
             ref_video: primary_video_ref
          } 
        })
      }).catch(err => console.error('Webhook dispatch error:', err));
      // Success removed, UI will update via supabase changes
    } catch (e) { toast.error(e.message) }
  };

  return (
    <div className="step-content no-gap">
      <NodeCanvas data={data} media={media} onChange={onChange} onGenerateNode={handleGenerateNode} />
    </div>
  );
}

import useGlobalTactile from './hooks/useGlobalTactile';

function App() {
  useGlobalTactile();
  const [session, setSession] = useState(null)
  const [step, setStep] = useState(0)
  const [, setModelsLoaded] = useState(false);

  useEffect(() => {
    supabase.from('ai_models').select('*').eq('is_active', true).then(({ data, error }) => {
      if (!error && data && data.length > 0) {
        const newReg = { image: [], i2i: [], video_t2v: [], video_i2v: [], v2v: [], tts: [], t2a: [], a2a: [], i23d: [], t23d: [], v2a: [], lipsync: [] };
        data.forEach(m => {
          if (m.variables_schema) MODEL_SCHEMAS[m.id] = typeof m.variables_schema === 'string' ? JSON.parse(m.variables_schema) : m.variables_schema;
          if (m.pricing_base !== undefined && m.pricing_base !== null && m.pricing_type) {
            updateModelPricing(m.id, {
              base: parseFloat(m.pricing_base),
              type: m.pricing_type,
              multipliers: m.pricing_multipliers ? (typeof m.pricing_multipliers === 'string' ? JSON.parse(m.pricing_multipliers) : m.pricing_multipliers) : undefined
            });
          }
          let key = m.category === 'text-to-image' ? 'image' : 
                    m.category === 'image-to-image' ? 'i2i' :
                    m.category === 'text-to-video' ? 'video_t2v' :
                    m.category === 'image-to-video' ? 'video_i2v' :
                    m.category === 'video-to-video' ? 'v2v' :
                    m.category === 'text-to-speech' ? 'tts' :
                    m.category === 'text-to-audio' ? 't2a' :
                    m.category === 'audio-to-audio' ? 'a2a' :
                    m.category === 'image-to-3d' ? 'i23d' :
                    m.category === 'text-to-3d' ? 't23d' :
                    m.category === 'video-to-audio' ? 'v2a' :
                    m.category === 'lipsync' ? 'lipsync' : 'image';
          let inferredCompany = m.provider;
          if (m.provider === 'fal-ai' && m.id.startsWith('fal-ai/')) {
             const parts = m.id.split('/');
             if (parts.length > 1) {
                const prefix = parts[1].toLowerCase();
                if (prefix.includes('flux')) inferredCompany = 'Black Forest Labs';
                else if (prefix.includes('kling')) inferredCompany = 'Kuaishou';
                else if (prefix.includes('luma')) inferredCompany = 'Luma AI';
                else if (prefix.includes('runway')) inferredCompany = 'Runway';
                else if (prefix.includes('minimax')) inferredCompany = 'Minimax';
                else if (prefix.includes('bytedance')) inferredCompany = 'Bytedance';
                else if (prefix.includes('hunyuan')) inferredCompany = 'Tencent';
                else if (prefix.includes('ltx')) inferredCompany = 'Lightricks';
                else if (prefix.includes('playgrou')) inferredCompany = 'Playground';
                else if (prefix.includes('bria')) inferredCompany = 'Bria';
                else if (prefix.includes('qwen')) inferredCompany = 'Alibaba';
                else inferredCompany = prefix.charAt(0).toUpperCase() + prefix.slice(1);
             }
          } else if (m.id.startsWith('bria/')) {
             inferredCompany = 'Bria';
          } else if (m.id.startsWith('sonauto/')) {
             inferredCompany = 'Sonauto';
          }
          
          let group = newReg[key].find(g => g.company === inferredCompany);
          if (!group) { group = { company: inferredCompany, models: [] }; newReg[key].push(group); }
          group.models.push({ id: m.id, name: m.title });
        });
        Object.keys(newReg).forEach(k => { MODEL_REGISTRY[k] = newReg[k]; });
        setModelsLoaded(true);
      }
    });
  }, []);
  const [projects, setProjects] = useState([])
  const [data, setData] = useState({ projectName: '', format: 'film_essay_montage', characters: [], props: [], environments: [], shots: [], videos: [], freestyleExperiments: [], pipeline: { language: 'en', phase: 'idea', idea: '', script: '', scriptApproved: false, shotlist: [] } })
  const [isSaving, setIsSaving] = useState(false)

  const ignoreNextSave = useRef(false);
  const syncChannel = useRef(null);

  useEffect(() => {
    syncChannel.current = new BroadcastChannel('renderfarm_sync');
    const handler = (e) => {
      if (e.data.type === 'SYNC' && e.data.projectName === data.projectName) {
        ignoreNextSave.current = true;
        setData(prev => ({ ...prev, ...e.data.contract }));
      }
    };
    syncChannel.current.addEventListener('message', handler);
    return () => {
      syncChannel.current.removeEventListener('message', handler);
      syncChannel.current.close();
    }
  }, [data.projectName]);

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
    if (!session) return
    const { data: list } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    if (list) setProjects(list)
  }, [session])

  useEffect(() => { 
    loadProjects()
  }, [loadProjects])

  // Handle Project Selection & Data Loading
  const handleSelectProject = useCallback(async (proj) => {
    if (!proj) return
    const { data: fullProj } = await supabase.from('projects').select('*').eq('id', proj.id).single()
    if (fullProj) {
      const contract = fullProj.contract || {}
      setData({
        projectName: fullProj.name,
        format: contract.format || 'film_essay_montage',
        characters: contract.characters || [],
        props: contract.props || [],
        environments: contract.environments || [],
        shots: contract.shots || [],
        videos: contract.videos || [],
        freestyleExperiments: contract.freestyleExperiments || [],
        pipeline: contract.pipeline || { language: 'en', phase: 'idea', idea: '', script: '', scriptApproved: false, shotlist: [] }
      })
    }
  }, [])

  // Auto-select latest project on load to prevent data loss
  useEffect(() => {
    if (projects.length > 0 && !data.projectName) {
      handleSelectProject(projects[0])
    }
  }, [projects, data.projectName, handleSelectProject])

  // Auto-save logic
  useEffect(() => {
    if (!data.projectName || !session) return
    const timer = setTimeout(async () => {
      if (ignoreNextSave.current) {
        ignoreNextSave.current = false;
        return;
      }
      setIsSaving(true)
      const contractData = {
        format: data.format,
        characters: data.characters,
        props: data.props,
        environments: data.environments,
        shots: data.shots,
        videos: data.videos,
        freestyleExperiments: data.freestyleExperiments,
        pipeline: data.pipeline
      };
      try {
        await supabase.from('projects')
          .update({ contract: contractData })
          .eq('name', data.projectName)
          
        syncChannel.current?.postMessage({ type: 'SYNC', projectName: data.projectName, contract: contractData });
      } catch (e) {
        console.error('Failed to auto-save:', e)
      } finally {
        setIsSaving(false)
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [data, session])
  const STEPS = [
    { id: 'project', label: 'Setup', icon: <Folder size={14} /> },
    { id: 'director', label: 'Director', icon: <Clapperboard size={14} /> },
    { id: 'characters', label: 'Chars', icon: <User size={14} /> },
    { id: 'props', label: 'Props', icon: <Wrench size={14} /> },
    { id: 'environments', label: 'Envs', icon: <Building size={14} /> },
    { id: 'shots', label: 'Shots', icon: <Video size={14} /> },
    { id: 'freestyle', label: 'Sandbox', icon: <FlaskConical size={14} /> },
    { id: 'canvas', label: 'Nodes', icon: <Network size={14} /> },
    { id: 'export', label: 'Export', icon: <Rocket size={14} /> }
  ]

  const handleDeleteProject = useCallback(async (proj) => {
    // CASCADE FK handles renderfarm_outputs cleanup automatically
    const { error } = await supabase.from('projects').delete().eq('id', proj.id);
    if (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete project: ' + error.message);
      return;
    }
    // If we just deleted the active project, clear selection
    if (data.projectName === proj.name) {
      setData(prev => ({ ...prev, projectName: '' }));
    }
    loadProjects();
  }, [data.projectName, loadProjects]);

  const views = [
    <StepProject data={data} projects={projects} isSaving={isSaving} onSelectProject={handleSelectProject} onDeleteProject={handleDeleteProject} onNewProject={async (n) => { 
      const { data: newProj, error } = await supabase.from('projects').insert([{ name: n, profile_id: session?.user?.id }]); 
      if (error) {
        console.error('Failed to create project:', error);
        toast.error('Failed to create project: ' + error.message);
      }
      loadProjects(); 
    }} onChange={setData} />,
    <StepDirector data={data} onChange={setData} onPushToProduction={() => setStep(5)} session={session} />,
    <StepCharacters data={data} onChange={setData} session={session} />,
    <StepProps data={data} onChange={setData} session={session} />,
    <StepEnvironments data={data} onChange={setData} session={session} />,
    <StepShots data={data} onChange={setData} session={session} />,
    <StepFreestyle data={data} onChange={setData} session={session} />,
    <StepCanvas data={data} onChange={setData} session={session} />,
    <StepExport data={data} session={session} />
  ]

  return (
    <div className="app-shell">
      <Auth session={session} />
      {session && (
        <>
          <header className="topbar">
            <h1 className="brand">AI <span className="gradient-text">AUTO GEN</span></h1>
            <div className="user-profile-widget">
              <WalletWidget session={session} />
              <QuotaWidget session={session} />
              <span className="tiny-label">{session.user.email}</span>
              <button className="logout-btn" onClick={() => supabase.auth.signOut()}>Logout</button>
            </div>
          </header>
          <div className="main-layout">
            <nav className="step-nav">
              {data.projectName && (
                <div className="nav-project-badge" onClick={() => setStep(0)} title="Go to Project Setup">
                  <span className="npb-icon"><Clapperboard size={16} className="lucide-icon" /></span>
                  <span className="npb-name">{data.projectName}</span>
                  {isSaving && <span className="npb-saving">â—</span>}
                </div>
              )}
              {STEPS.map((s, idx) => <button key={s.id} className={`step-btn ${idx === step ? 'active' : ''}`} onClick={() => setStep(idx)}>{s.icon} {s.label}</button>)}
              <LogMonitor />
            </nav>
            <main className={`content-area ${STEPS[step].id === 'canvas' ? 'full-width' : ''}`}>{views[step]}</main>
          </div>
        </>
      )}
    </div>
  )
}
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('React Error Boundary:', error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: '#ff6b6b', fontFamily: 'monospace', background: '#0a0a0f', minHeight: '100vh' }}>
          <h1><AlertTriangle size={16} className="lucide-icon" /> Application Error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#ccc' }}>{this.state.error?.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#888', fontSize: '0.8rem' }}>{this.state.error?.stack}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '10px 20px', background: '#5865F2', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

function AppWithBoundary() {
  return <ErrorBoundary><App /></ErrorBoundary>
}

export default AppWithBoundary
