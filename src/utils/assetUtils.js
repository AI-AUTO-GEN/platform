// ─── Asset & Media Utilities ────────────────────────
// Extracted from App.jsx — Drive URLs, downloads, deletions

import React from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { N8N_WEBHOOK_URL } from '../config/constants'

// Helper for native download
export const triggerNativeDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3600000); // FIX: 1 hour timeout instead of 15s
};

// Safe converter for Google Drive previews using wsrv.nl CDN proxy
export const getDriveDisplayUrl = (url) => {
  if (!url) return '';
  if (url.includes('supabase.co') || url.includes('unsplash.com')) return url;
  const idMatch = url.match(/id=([^&]+)/);
  if (idMatch) {
    const gDriveUrl = `https://drive.google.com/uc?id=${idMatch[1]}`;
    return `https://wsrv.nl/?url=${encodeURIComponent(gDriveUrl)}&output=webp`;
  }
  const fileMatch = url.match(/\/file\/d\/([^/]+)/);
  if (fileMatch) {
    const gDriveUrl = `https://drive.google.com/uc?id=${fileMatch[1]}`;
    return `https://wsrv.nl/?url=${encodeURIComponent(gDriveUrl)}&output=webp`;
  }
  return url;
};

// Download asset: prefer Drive HQ, fallback to Supabase thumbnail
export const downloadAsset = async (variant) => {
  try {
    const hqUrl = variant.webViewLink || variant.hq_url;
    const directUrl = variant.thumbnailLink || variant.url;
    const fileName = variant.name || variant.file_name || 'download';
    
    if (hqUrl && hqUrl.includes('drive.google.com')) {
      const m = hqUrl.match(/\/d\/([^/]+)/) || hqUrl.match(/id=([^&]+)/);
      if (m) {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `https://drive.google.com/uc?export=download&id=${m[1]}`;
        document.body.appendChild(iframe);
        setTimeout(() => document.body.removeChild(iframe), 3600000); // FIX: 1 hour timeout instead of 15s
        return;
      }
    }
    
    let fetchUrl = null;
    if (directUrl && directUrl.includes('supabase.co')) fetchUrl = directUrl;
    if (!fetchUrl) fetchUrl = directUrl || hqUrl;
    
    const res = await fetch(fetchUrl);
    const blob = await res.blob();
    triggerNativeDownload(blob, fileName);
  } catch (err) {
    console.error('Download failed, opening in tab:', err);
    window.open(variant.webViewLink || variant.thumbnailLink, '_blank');
  }
};

// Delete a single renderfarm output variant
export const deleteVariant = async (variant) => {
  if (!variant?.id) { console.warn('deleteVariant called with no id'); return false; }
  try {
    if (variant.thumbnailLink && variant.thumbnailLink.includes('supabase.co')) {
      const pathMatch = variant.thumbnailLink.match(/\/renders\/(.+?)(?:\?|$)/);
      if (pathMatch) await supabase.storage.from('renders').remove([decodeURIComponent(pathMatch[1])]);
    }
    if (variant.webViewLink && variant.webViewLink.includes('supabase.co') && variant.webViewLink !== variant.thumbnailLink) {
      const hqMatch = variant.webViewLink.match(/\/renders\/(.+?)(?:\?|$)/);
      if (hqMatch) await supabase.storage.from('renders').remove([decodeURIComponent(hqMatch[1])]);
    }
    if (variant.webViewLink && variant.webViewLink.includes('drive.google.com')) {
      const driveMatch = variant.webViewLink.match(/\/file\/d\/(.+?)\//) || variant.webViewLink.match(/id=(.+?)(?:&|$)/);
      if (driveMatch && driveMatch[1]) {
        // VULNERABILITY FIXED: Get the session token to authenticate the delete webhook to n8n
        const { data: { session } } = await supabase.auth.getSession();
        fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': session ? `Bearer ${session.access_token}` : ''
          },
          body: JSON.stringify({ action: 'delete_file', file_id: driveMatch[1], task_id: variant.task_id })
        }).catch(err => console.error('Drive delete webhook error:', err));
      }
    }
    // VULNERABILITY FIXED: Verify the user ID explicitly during deletion to prevent ID-guessing attacks
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error, data } = await supabase.from('renderfarm_outputs').delete().eq('id', variant.id).eq('profile_id', user.id).select();
    if (error) { toast.error('Failed to delete DB record: ' + error.message); return false; }
    if (!data || data.length === 0) { toast.error('Warning: Row not found or RLS prevented deletion.'); return false; }
    return true;
  } catch (err) {
    console.error('Failed to delete variant:', err);
    toast.error('Deletion error: ' + err.message);
    return false;
  }
};

// Delete ALL variants for a given task_id
export const deleteAllVariantsForTask = async (taskId, mediaList) => {
  const variants = (mediaList || []).filter(m => m.task_id === taskId);
  let allSuccess = true;
  for (const v of variants) {
    const success = await deleteVariant(v);
    if (!success) allSuccess = false;
  }
  return allSuccess;
};

// Generate unique ID
export function genId(prefix) {
  return `${prefix}___${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

// Custom confirm via toast
export const customConfirm = (message, onConfirm) => {
  toast((t) => (
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
      React.createElement('span', { style: { fontSize: '14px', fontWeight: 500, color: '#fff' } }, message),
      React.createElement('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' } },
        React.createElement('button', { className: 'btn ghost', style: { padding: '4px 12px', fontSize: '12px', minHeight: 'auto' }, onClick: () => toast.dismiss(t.id) }, 'Cancel'),
        React.createElement('button', { className: 'btn danger', style: { padding: '4px 12px', fontSize: '12px', minHeight: 'auto' }, onClick: () => { toast.dismiss(t.id); onConfirm(); } }, 'Confirm')
      )
    )
  ), { duration: Infinity, style: { background: '#25262b', border: '1px solid #373A40' } });
};


// Parse B_CONTRACT JSON into app data shape
export const parseContract = (json) => {
  if (json.registry) {
    const chars = (json.registry.characters || []).map(c => ({
      id: c.asset_id || c.id || `CHAR_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      name: c.name || '', prompt: c.canonical_description || c.prompt || '', modelId: 'fal-ai/flux-pro/v1.1'
    }));
    const props = (json.registry.props || []).map(p => ({
      id: p.asset_id || p.id || `PROP_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      name: p.name || '', prompt: p.canonical_description || p.prompt || '', modelId: 'fal-ai/flux-pro/v1.1'
    }));
    const environments = (json.registry.locations || json.registry.environments || []).map(e => ({
      id: e.asset_id || e.id || `LOC_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      name: e.name || '', prompt: e.canonical_description || e.prompt || '', modelId: 'fal-ai/flux-pro/v1.1'
    }));
    let shots = [];
    if (json.must_show && json.must_show.length > 0) {
       shots = json.must_show.map((ms, index) => {
          const s_id = ms.ms_id ? ms.ms_id.replace('MS___', 'SHOT___') : `SHOT___${String(index + 1).padStart(3, '0')}`;
          let cameraMove = 'micro_push';
          if (json.action_specs) {
              const spec = json.action_specs.find(a => a.shot_id === s_id);
              if (spec && spec.deltas && spec.deltas.CAM) cameraMove = spec.deltas.CAM.split(';')[0];
          }
          const beatLower = (ms.description || '').toLowerCase();
          const relatedCharacters = chars.filter(c => c.name && beatLower.includes(c.name.toLowerCase())).map(c => c.id);
          const relatedProps = props.filter(p => p.name && beatLower.includes(p.name.toLowerCase())).map(p => p.id);
          const relatedEnvironments = environments.filter(e => e.name && beatLower.includes(e.name.toLowerCase())).map(e => e.id);
          // VULNERABILITY FIXED: Respect imported model/cat if present, do not forcibly overwrite with image model
          return { 
            id: s_id, 
            title: ms.description?.substring(0,40) || `Shot ${index+1}`,
            prompt: ms.description || '',
            beat: ms.description || '', 
            cameraMove, 
            shotSize: 'MS', 
            dur: ms.dur || '5s',
            res: ms.res || '1080p',
            ar: ms.ar || '16:9',
            model: ms.model || 'fal-ai/flux-pro/v1.1', 
            cat: ms.cat || 'image',
            status: 'pending',
            relatedCharacters, 
            relatedProps, 
            relatedEnvironments 
          }
       });
    }
    return { projectName: json.project?.title || json.title || '', format: json.project?.format || json.format || 'film_essay_montage', characters: chars, props, environments, shots };
  }
  return {
    projectName: json.title || json.projectName || '', format: json.format || 'film_essay_montage',
    characters: (json.characters || []).map(c => ({ ...c, id: c.id || `CHAR_${Math.random().toString(36).slice(2, 6).toUpperCase()}` })),
    props: (json.props || []).map(p => ({ ...p, id: p.id || `PROP_${Math.random().toString(36).slice(2, 6).toUpperCase()}` })),
    environments: (json.environments || []).map(e => ({ ...e, id: e.id || `LOC_${Math.random().toString(36).slice(2, 6).toUpperCase()}` })),
    shots: (json.shots || []).map(s => ({ ...s, id: s.id || `SHOT_${Math.random().toString(36).slice(2, 6).toUpperCase()}` }))
  };
};
