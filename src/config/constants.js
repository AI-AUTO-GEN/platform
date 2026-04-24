// ─── Constants & Configuration ────────────────────────
// Extracted from App.jsx monolith — central configuration

export const N8N_MEDIA_WEBHOOK = 'https://nsk404.app.n8n.cloud/webhook/media-discovery'
export const N8N_WEBHOOK_URL = 'https://nsk404.app.n8n.cloud/webhook/ai-renderfarm'
export const N8N_UPLOAD_WEBHOOK_URL = 'https://nsk404.app.n8n.cloud/webhook/drive-upload'
export const SUPABASE_URL = 'https://nangyrlyayskchsjqymn.supabase.co'
export const GEMINI_PROXY_URL = `${SUPABASE_URL}/functions/v1/gemini-proxy`

export const SHOT_SIZES = ['EWS', 'WS', 'MWS', 'MS', 'MCU', 'CU', 'ECU', 'INSERT']
export const CAMERA_MOVES = [
  'locked', 'micro_push', 'push_in_slow', 'travelling_lateral', 'stabilized_handheld',
  'handheld_micro_breath', 'orbit_soft', 'tilt_follow', 'slider_short_reveal',
  'rack_focus', 'follow_parallel', 'arc_short', 'gimbal_entry', 'drift_centered',
  'near_locked_drift', 'zoom_fast_micro_tilt', 'MATCHCUT_LOCKED', 'TOPDOWN_90_LOCKED'
]

export const SHOT_TYPES = ['WIDE','MEDIUM','CLOSE-UP','EXTREME CU','POV','AERIAL','TRACKING','OVER-THE-SHOULDER','TWO-SHOT','INSERT','DUTCH ANGLE','ESTABLISHING','DOLLY','CRANE','STEADICAM','HANDHELD']

// === MODALITY CONSTANTS ===
export const MODALITIES = {
  t2i:   { label: '🖼️ Text → Image',   input: 'text',  output: 'image', reg: 'image' },
  i2i:   { label: '🎨 Image → Image',  input: 'image', output: 'image', reg: 'i2i' },
  t2v:   { label: '🎬 Text → Video',   input: 'text',  output: 'video', reg: 'video_t2v' },
  i2v:   { label: '📸 Image → Video',  input: 'image', output: 'video', reg: 'video_i2v' },
  v2v:   { label: '🔄 Video → Video',  input: 'video', output: 'video', reg: 'v2v' },
  tts:   { label: '🗣️ Text → Speech',  input: 'text',  output: 'audio', reg: 'tts' },
  t2a:   { label: '🎵 Text → Audio',   input: 'text',  output: 'audio', reg: 't2a' },
  a2a:   { label: '🎙️ Audio → Audio',  input: 'audio', output: 'audio', reg: 'a2a' },
  i23d:  { label: '🧊 Image → 3D',     input: 'image', output: '3d',    reg: 'i23d' },
  t23d:  { label: '✏️ Text → 3D',      input: 'text',  output: '3d',    reg: 't23d' },
  v2a:   { label: '🔊 Video → Audio',  input: 'video', output: 'audio', reg: 'v2a' },
  lip:   { label: '👄 Lipsync',         input: 'video', output: 'video', reg: 'lipsync' },
}
