// ─── useDriveMedia Hook ────────────────────────────
// Extracted from App.jsx — fetches and syncs media from renderfarm_outputs

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase'

export function useDriveMedia(projectNameOrId, category, session) {
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

      let query = supabase.from('renderfarm_outputs').select('*')
        
      if (category === 'freestyle' && session?.user?.id) {
         query = query.eq('profile_id', session.user.id)
      } else {
         query = query.eq('project_id', pId)
      }

      const { data: outputs, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const formatted = (outputs || []).map(o => ({
        id: o.id,
        task_id: o.task_id,
        name: o.file_name || o.task_id,
        webViewLink: o.hq_url || o.url || '#',
        thumbnailLink: o.thumbnail_url || o.url || '#',
        mimeType: o.kind?.includes('video') ? 'video/mp4' : 'image/png',
        status: o.status,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        progress: o.progress || 0,
        statusMessage: o.status_message,
        metadata: o.metadata || {},
        kind: o.kind,
        estimated_cost: o.estimated_cost,
        actual_cost: o.actual_cost,
        tokens_input: o.tokens_input,
        tokens_output: o.tokens_output,
        inference_time: o.inference_time,
        file_name: o.file_name
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
    
    const filter = session?.user?.id ? `profile_id=eq.${session.user.id}` : undefined;
    const channel = supabase.channel(`media_sync_${category}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'renderfarm_outputs', filter }, (payload) => {
        // VULNERABILITY FIXED: Instead of calling refresh() (which triggers a SELECT * N+1 DDOS), update only the modified row
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const o = payload.new;
          const formattedItem = {
            id: o.id, task_id: o.task_id, name: o.file_name || o.task_id,
            webViewLink: o.hq_url || o.url || '#', thumbnailLink: o.thumbnail_url || o.url || '#',
            mimeType: o.kind?.includes('video') ? 'video/mp4' : 'image/png',
            status: o.status, createdAt: o.created_at, updatedAt: o.updated_at,
            progress: o.progress || 0, statusMessage: o.status_message,
            metadata: o.metadata || {}, kind: o.kind, estimated_cost: o.estimated_cost,
            actual_cost: o.actual_cost, tokens_input: o.tokens_input,
            tokens_output: o.tokens_output, inference_time: o.inference_time, file_name: o.file_name
          };
          setMedia(prev => {
            const exists = prev.findIndex(m => m.id === o.id);
            if (exists >= 0) {
              const updated = [...prev];
              updated[exists] = formattedItem;
              return updated;
            }
            return [formattedItem, ...prev];
          });
        } else if (payload.eventType === 'DELETE') {
          setMedia(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh, category, session])
  
  return { media, loading, refresh }
}
