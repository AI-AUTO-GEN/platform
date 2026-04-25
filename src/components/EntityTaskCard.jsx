// ─── EntityTaskCard Component ────────────────────────
// Reusable card for characters, props, environments with prompt editing,
// model selection, render preview, fullscreen lightbox, and delete dialogs.

import { useState, useEffect } from 'react'
import { Zap, RefreshCw, CheckCircle, Save, XCircle, Trash2, Maximize2, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { createPortal } from 'react-dom'
import { getModelOptions } from '../config/modelRegistry'
import { getDriveDisplayUrl, downloadAsset } from '../utils/assetUtils'
import { calculatePreviewCost, formatCost, optionsToParams } from '../pricing/PricingEngine'
import EnhanceButton from './EnhanceButton'
import ModelPicker from './ModelPicker'
import AlchemyProgress from './AlchemyProgress'

export default function EntityTaskCard({ badge, name, id, data, onGenerate, onUpdate, driveMedia, selectedVersion, onSelectVersion, onDeleteEntity, onDiscardVariant }) {
  const [prompt, setPrompt] = useState(data.prompt || '')
  const [fullscreenImage, setFullscreenImage] = useState(null)
  const [confirmDeleteType, setConfirmDeleteType] = useState(null)
  const hasChanges = prompt !== data.lastGeneratedPrompt
  
  const variants = driveMedia?.filter(m => m.task_id === id) || []
  const activeVariant = selectedVersion || variants[0]

  const customOptions = getModelOptions(data.modelId)

  useEffect(() => {
    if (!fullscreenImage) return;
    const handleEsc = (e) => { if(e.key === 'Escape') setFullscreenImage(null); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [fullscreenImage]);

  return (
    <div className={`entity-task-card glass ${hasChanges ? 'modified' : ''} slide-in`}>
      <div className="task-header-v2">
        <div className="header-top-row">
           <div className="id-badge-group">
              <span className={`entity-badge ${badge?.toLowerCase()}`}>{badge}</span>
              <span className="task-id-mono">{id}</span>
           </div>
           
           <div style={{ marginLeft: 'auto', marginRight: '8px', display: 'flex', gap: '4px', alignItems: 'center' }}>
              {(activeVariant?.actual_cost != null) && (
                <div style={{ fontSize: '10px', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}><CheckCircle size={16} className="lucide-icon" /> {formatCost(activeVariant.actual_cost)}
                </div>
              )}
              {(!activeVariant || activeVariant?.actual_cost == null) && (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                   Est: {formatCost(calculatePreviewCost(data.modelId, { ...optionsToParams(customOptions), prompt }))}
                </div>
              )}
           </div>

           <button className={`btn-gen-circle ${hasChanges ? 'pulse-gold' : ''}`} onClick={() => onGenerate({ ...data, prompt })}>
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
                <button className="btn-retry" onClick={() => onGenerate({ ...data, prompt })}><RefreshCw size={16} className="lucide-icon" /> Retry</button>
              </div>
            ) : (
              <div className="preview-container">
                <img src={getDriveDisplayUrl(activeVariant.thumbnailLink)} className="official-render cursor-zoom" alt={name} onClick={() => setFullscreenImage(activeVariant)} />
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
              {onDiscardVariant && (
                <button className="btn-preview-action btn-preview-danger" onClick={(e) => { 
                  e.stopPropagation(); 
                  setConfirmDeleteType('variant');
                }} title="Discard this image"><Trash2 size={14} className="lucide-icon" /></button>
              )}
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
        <div className="prompt-wrapper">
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
          <EnhanceButton value={prompt} onChange={(v) => { setPrompt(v); onUpdate('prompt', v); }} modelId={data.modelId} entityType={badge?.toLowerCase() === 'char' ? 'character' : badge?.toLowerCase() === 'prop' ? 'prop' : 'environment'} modality="t2i" />
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
        <div className="footer-right-actions">
           {onDeleteEntity && (
             <button className="btn-delete-entity" onClick={(e) => { 
               e.stopPropagation();
               setConfirmDeleteType('entity');
             }} title="Delete entity and all generations">
               <Trash2 size={12} className="lucide-icon" /> Delete
             </button>
           )}
           <div className={`sync-status ${hasChanges ? 'alert' : 'clean'}`}>
              {hasChanges ? '● Unsaved' : '✓ Synced'}
           </div>
        </div>
      </div>
      
      {confirmDeleteType && createPortal(
        <div className="overlay" onClick={(e) => { e.stopPropagation(); setConfirmDeleteType(null); }}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-icon"><Trash2 size={16} className="lucide-icon" /></div>
            <h3 className="dialog-title">{confirmDeleteType === 'variant' ? 'Discard Image?' : 'Delete Entity?'}</h3>
            <p className="dialog-body">
              {confirmDeleteType === 'variant' 
                ? 'Discard this generated image? Your prompt and model settings will be preserved.' 
                : `Delete "${name || id}" and all its generations permanently? This cannot be undone.`}
            </p>
            <div className="dialog-actions-col">
              <div className="dialog-actions">
                <button className="btn ghost" onClick={() => setConfirmDeleteType(null)}>Cancel</button>
                <button className="btn danger" onClick={async () => {
                  const type = confirmDeleteType;
                  setConfirmDeleteType(null);
                  if (type === 'variant' && onDiscardVariant) {
                    try { await onDiscardVariant(activeVariant); } catch(err) { console.error(err); toast.error(err.message); }
                  } else if (type === 'entity' && onDeleteEntity) {
                    try { await onDeleteEntity(); } catch(err) { console.error(err); toast.error(err.message); }
                  }
                }}>
                  {confirmDeleteType === 'variant' ? 'Discard Image' : 'Delete Entity'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

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
                {fullscreenImage.name} • {data.modelId} • {fullscreenImage.metadata?.prompt?.slice(0,40)}...
             </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
