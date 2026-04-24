// ─── Model Registry & Schema Management ────────────
// Extracted from App.jsx — mutable runtime state for AI models

import { MODALITIES } from './constants'

// Runtime model registry — populated from Supabase ai_models on app load
export let MODEL_REGISTRY = {
  image: [{ company: 'Loading...', models: [{ id: 'loading', name: 'Loading models...' }] }],
  i2i: [{ company: 'Loading...', models: [{ id: 'loading', name: 'Loading models...' }] }],
  video_t2v: [{ company: 'Loading...', models: [{ id: 'loading', name: 'Loading models...' }] }],
  video_i2v: [{ company: 'Loading...', models: [{ id: 'loading', name: 'Loading models...' }] }],
  v2v: [{ company: 'Loading...', models: [{ id: 'loading', name: 'Loading models...' }] }],
  tts: [{ company: 'Loading...', models: [{ id: 'loading', name: 'Loading models...' }] }],
  t2a: [{ company: 'Loading...', models: [{ id: 'loading', name: 'Loading models...' }] }],
  a2a: [{ company: 'Loading...', models: [{ id: 'loading', name: 'Loading models...' }] }],
  i23d: [{ company: 'Loading...', models: [{ id: 'loading', name: 'Loading models...' }] }],
  t23d: [{ company: 'Loading...', models: [{ id: 'loading', name: 'Loading models...' }] }],
  v2a: [{ company: 'Loading...', models: [{ id: 'loading', name: 'Loading models...' }] }],
  lipsync: [{ company: 'Loading...', models: [{ id: 'loading', name: 'Loading models...' }] }],
  get video() { return [...(this.video_t2v||[]), ...(this.video_i2v||[])] }
};

// Runtime schema cache for per-model UI options
export let MODEL_SCHEMAS = {};

// Get UI options for a specific model (from schema or fallback heuristics)
export function getModelOptions(modelId) {
  if (!modelId) return [];
  if (MODEL_SCHEMAS[modelId] && Array.isArray(MODEL_SCHEMAS[modelId]) && MODEL_SCHEMAS[modelId].length > 0) {
     return MODEL_SCHEMAS[modelId];
  }
  const m = modelId.toLowerCase();
  // Image models
  if (m.includes('flux') || m.includes('luma')) {
     return [
       { key: 'aspect_ratio', label: 'Aspect Ratio', default: '16:9', options: ['16:9', '9:16', '1:1', '4:3', '3:4'] }
     ];
  }
  if (m.includes('recraft')) {
     return [
       { key: 'size', label: 'Size', default: '1820x1024', options: ['1820x1024', '1024x1024', '1024x1820'] }
     ];
  }
  if (m.includes('ideogram')) {
     return [
       { key: 'aspect_ratio', label: 'Aspect Ratio', default: '16:9', options: ['16:9', '9:16', '1:1', '4:5', '5:4'] }
     ];
  }
  if (m.includes('gpt-image') || m.includes('nano-banana') || m.includes('seedream')) {
     return [
       { key: 'image_size', label: 'Size', default: 'landscape_16_9', options: ['landscape_16_9', 'square_hd', 'portrait_4_3', 'landscape_4_3'] }
     ];
  }
  // Video models
  if (m.includes('kling')) {
     return [
       { key: 'aspect_ratio', label: 'Aspect Ratio', default: '16:9', options: ['16:9', '9:16', '1:1'] },
       { key: 'duration', label: 'Duration', default: '5', options: ['5', '10'] }
     ];
  }
  if (m.includes('seedance')) {
     return [
       { key: 'resolution', label: 'Resolution', default: '720p', options: ['720p', '1080p'] },
       { key: 'duration', label: 'Duration (s)', default: '5', options: ['5', '10'] }
     ];
  }
  if (m.includes('veo3')) {
     return [
       { key: 'aspect_ratio', label: 'Aspect Ratio', default: '16:9', options: ['16:9', '9:16', '1:1'] },
       { key: 'duration', label: 'Duration', default: '8s', options: ['5s', '8s'] }
     ];
  }
  if (m.includes('sora')) {
     return [
       { key: 'aspect_ratio', label: 'Aspect Ratio', default: '16:9', options: ['16:9', '9:16', '1:1'] },
       { key: 'duration', label: 'Duration', default: '5s', options: ['5s', '10s', '20s'] }
     ];
  }
  if (m.includes('pixverse')) {
     return [
       { key: 'resolution', label: 'Resolution', default: '720p', options: ['720p', '1080p'] }
     ];
  }
  if (m.includes('hailuo') || m.includes('minimax/hailuo')) {
     return [
       { key: 'resolution', label: 'Resolution', default: '720p', options: ['720p', '1080p'] }
     ];
  }
  if (m.includes('hunyuan')) {
     return [
       { key: 'video_size', label: 'Video Size', default: 'landscape_16_9', options: ['landscape_16_9', 'portrait_9_16', 'square'] },
       { key: 'video_length', label: 'Frames', default: '129', options: ['129', '65', '257'] }
     ];
  }
  if (m.includes('ltx') || m.includes('wan')) {
     return [
       { key: 'resolution', label: 'Resolution', default: '720p', options: ['720p', '1080p'] }
     ];
  }
  if (m.includes('vidu')) {
     return [
       { key: 'aspect_ratio', label: 'Aspect Ratio', default: '16:9', options: ['16:9', '9:16', '1:1'] },
       { key: 'duration', label: 'Duration', default: '4s', options: ['4s', '8s'] }
     ];
  }
  // Audio models
  if (m.includes('tts') || m.includes('speech') || m.includes('chatterbox') || m.includes('inworld')) {
     return [
       { key: 'voice', label: 'Voice', default: 'default', options: ['default', 'male_1', 'female_1', 'narrator'] }
     ];
  }
  if (m.includes('music') || m.includes('beatoven')) {
     return [
       { key: 'duration', label: 'Duration (s)', default: '30', options: ['15', '30', '60', '120'] }
     ];
  }
  // 3D models
  if (m.includes('3d') || m.includes('tripo') || m.includes('reconvia')) {
     return [
        { key: 'output_format', label: 'Output', default: 'glb', options: ['glb', 'obj', 'fbx'] }
     ];
  }
  // Lipsync
  if (m.includes('lipsync') || m.includes('omnihuman') || m.includes('aurora') || m.includes('heygen')) {
     return [];
  }
  return [];
}

// Model-specific prompt optimization hints for the AI enhancer
export const getModelHint = (modelId) => {
  const m = (modelId || '').toLowerCase()
  if (m.includes('flux') && m.includes('ultra')) return 'FLUX 1.1 Pro Ultra — prefers natural-language prompts, supports raw mode. Strong with photorealistic and artistic styles. Avoid tag-based syntax.'
  if (m.includes('flux') && m.includes('pro'))   return 'FLUX 1.1 Pro — natural language prompts work best. Great at following complex scene descriptions. Avoid comma-separated tags.'
  if (m.includes('flux') && m.includes('dev'))   return 'FLUX Dev — open-weight model, handles both natural language and structured prompts. Good for experimental styles.'
  if (m.includes('recraft'))    return 'Recraft V3 — excels at vector/design aesthetics, brand imagery, and clean graphic design. Use descriptive design language.'
  if (m.includes('ideogram'))   return 'Ideogram V3 — excellent text rendering in images. Great for posters, logos, signs. Mention text content explicitly.'
  if (m.includes('gpt-image'))  return 'GPT Image (DALL-E) — natural language, conversational prompt style. Describe scenes as you would to a human artist.'
  if (m.includes('seedream'))   return 'Seedream 3.0 — ByteDance model, strong with Asian aesthetic and anime styles. Works with both natural language and structured prompts.'
  if (m.includes('imagen'))     return 'Google Imagen 4 — excels at photorealism and text rendering. Use clear, direct descriptions.'
  if (m.includes('kling'))      return 'Kling — strong with character animation and cinematic video. Describe motion, transitions, and camera work explicitly.'
  if (m.includes('veo'))        return 'Veo 3 by Google DeepMind — state-of-the-art video gen. Describe cinematic scenes with camera movements, focus on storytelling.'
  if (m.includes('sora'))       return 'Sora — OpenAI video model. Natural language, describe scenes cinematically. Mention camera angles, transitions, and temporal progression.'
  if (m.includes('seedance'))   return 'Seedance — ByteDance dance/motion video model. Describe choreography, body movements, and musical synchronization.'
  if (m.includes('hunyuan'))    return 'HunyuanVideo — Tencent model. Works with direct scene descriptions. Mention video style, pacing, and visual transitions.'
  if (m.includes('minimax'))    return 'MiniMax/Hailuo — strong at character-driven video with consistent faces. Describe character actions and emotional beats.'
  if (m.includes('wan'))        return 'Wan by Alibaba — handles diverse video styles. Clear, structured descriptions with scene breakdowns work best.'
  if (m.includes('elevenlabs')) return 'ElevenLabs TTS — focus on emotional delivery, pacing, emphasis. Use SSML-compatible phrasing.'
  if (m.includes('trellis') || m.includes('hunyuan3d')) return '3D generation model — describe geometry, scale, material properties (metallic, rough, emissive), and intended use.'
  return 'AI generation model — use clear, descriptive natural language.'
}
