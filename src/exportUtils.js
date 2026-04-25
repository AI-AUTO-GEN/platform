import { supabase } from './supabase'

export const N8N_EXPORT_WEBHOOK_URL = 'https://nsk404.app.n8n.cloud/webhook/export-project'

/**
 * Triggers N8N to generate a ZIP for a specific section of the project.
 * @param {string} projectName 
 * @param {string} section - e.g., '_PROJECT', '_CHAR', '_VIDEOS'
 * @param {function} onStatus - callback to update UI status
 * @param {function} onComplete - callback when ZIP url is ready (null on failure)
 */
export async function triggerN8NExport(projectName, section, onStatus, onComplete) {
  if (!projectName) return;
  
  onStatus(`Requesting ${section.replace('_', '')} export from N8N...`);
  
  try {
    // VULNERABILITY FIXED: Retrieve user session to securely authenticate the export webhook
    const { data: { session } } = await supabase.auth.getSession();
    
    const res = await fetch(N8N_EXPORT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': session ? `Bearer ${session.access_token}` : ''
      },
      body: JSON.stringify({ projectName, section })
    });
    
    if (!res.ok) throw new Error('Export trigger failed');
    onStatus('Packaging files in Google Drive...');
    
    // N8N should update the Supabase 'projects' table with export_url
    // We will poll every 5 seconds for up to 10 minutes (120 attempts)
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      // FIX: Used .limit(1) and selected the first element instead of .single() which crashes on multiple projects with same name
      const { data: pData } = await supabase.from('projects').select('id, export_url').eq('name', projectName).limit(1);
      const p = pData && pData.length > 0 ? pData[0] : null;
      
      if (p && p.export_url) {
        clearInterval(poll);
        // Clear the URL so it can be re-exported later without immediate trigger, using ID instead of name
        await supabase.from('projects').update({ export_url: null }).eq('id', p.id);
        onComplete(p.export_url);
      } else if (attempts > 120) {
        clearInterval(poll);
        onStatus('Timeout: Export took too long.');
        onComplete(null);
      }
    }, 5000);
    
  } catch (e) {
    console.error('Export failed:', e);
    onStatus(`Error: ${e.message}`);
    onComplete(null);
  }
}
