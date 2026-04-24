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
    const res = await fetch(N8N_EXPORT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectName, section })
    });
    
    if (!res.ok) throw new Error('Export trigger failed');
    onStatus('Packaging files in Google Drive...');
    
    // N8N should update the Supabase 'projects' table with export_url
    // We will poll every 5 seconds for up to 10 minutes (120 attempts)
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const { data: p } = await supabase.from('projects').select('export_url').eq('name', projectName).single();
      
      if (p && p.export_url) {
        clearInterval(poll);
        // Clear the URL so it can be re-exported later without immediate trigger
        await supabase.from('projects').update({ export_url: null }).eq('name', projectName);
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
