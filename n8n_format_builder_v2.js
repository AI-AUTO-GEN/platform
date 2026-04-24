// ═══════════════════════════════════════════════════════════════
// n8n FORMAT BUILDER — Multi-Modality Router
// ═══════════════════════════════════════════════════════════════
// This Code node replaces the single-purpose Format Builder.
// It reads the task.kind + task.modelId from the webhook payload
// and constructs the correct FAL.AI API request body.
//
// PASTE THIS INTO: n8n → ULTIMATE_RENDERFARM_PIPELINE → Format Builder (Code Node)
// ═══════════════════════════════════════════════════════════════

const task = $input.item.json.task || $input.item.json;
const kind = task.kind || 't2i';
const modelId = task.modelId || 'fal-ai/flux-pro/v1.1-ultra';
const prompt = task.prompt || '';

// ─── MODALITY ROUTING TABLE ───
const MODALITY_MAP = {
  t2i:  { type: 'image',  needsRef: false },
  i2i:  { type: 'image',  needsRef: 'image' },
  t2v:  { type: 'video',  needsRef: false },
  i2v:  { type: 'video',  needsRef: 'image' },
  v2v:  { type: 'video',  needsRef: 'video' },
  tts:  { type: 'audio',  needsRef: false },
  t2a:  { type: 'audio',  needsRef: false },
  a2a:  { type: 'audio',  needsRef: 'audio' },
  i23d: { type: '3d',     needsRef: 'image' },
  t23d: { type: '3d',     needsRef: false },
  v2a:  { type: 'audio',  needsRef: 'video' },
  lip:  { type: 'video',  needsRef: 'video' },
};

const modality = MODALITY_MAP[kind] || MODALITY_MAP.t2i;

// ─── BUILD FAL.AI REQUEST BODY ───
let falBody = {};
const m = modelId.toLowerCase();

// === IMAGE GENERATION (t2i) ===
if (kind === 't2i') {
  falBody = { prompt };
  
  if (m.includes('flux')) {
    falBody.aspect_ratio = task.aspect_ratio || '16:9';
    if (m.includes('ultra')) falBody.raw = false;
  } else if (m.includes('recraft')) {
    falBody.size = task.size || '1820x1024';
  } else if (m.includes('ideogram')) {
    falBody.aspect_ratio = task.aspect_ratio || '16:9';
  } else if (m.includes('nano-banana') || m.includes('seedream') || m.includes('gpt-image')) {
    falBody.image_size = task.image_size || 'landscape_16_9';
  }
}

// === IMAGE EDITING (i2i) ===
else if (kind === 'i2i') {
  falBody = { prompt };
  
  if (task.ref_image) {
    falBody.image_url = task.ref_image;
  }
  if (task.ref_images && task.ref_images.length > 0) {
    // Multi-ref: use first as primary, rest as additional
    falBody.image_url = task.ref_images[0];
    if (task.ref_images.length > 1) {
      falBody.reference_images = task.ref_images.slice(1);
    }
  }
  if (m.includes('kontext')) {
    falBody.input_image_url = falBody.image_url;
    delete falBody.image_url;
  }
}

// === TEXT TO VIDEO (t2v) ===
else if (kind === 't2v') {
  falBody = { prompt };
  
  if (m.includes('kling')) {
    falBody.aspect_ratio = task.aspect_ratio || '16:9';
    falBody.duration = task.duration || '5';
  } else if (m.includes('seedance')) {
    falBody.resolution = task.resolution || '720p';
    falBody.duration = parseInt(task.duration) || 5;
  } else if (m.includes('veo3')) {
    falBody.aspect_ratio = task.aspect_ratio || '16:9';
  } else if (m.includes('sora')) {
    falBody.aspect_ratio = task.aspect_ratio || '16:9';
    falBody.duration = task.duration || '5s';
  } else if (m.includes('hunyuan')) {
    falBody.video_size = task.video_size || 'landscape_16_9';
    falBody.video_length = parseInt(task.video_length) || 129;
  } else if (m.includes('wan')) {
    falBody.resolution = task.resolution || '720p';
  } else if (m.includes('pixverse')) {
    falBody.resolution = task.resolution || '720p';
  }
}

// === IMAGE TO VIDEO (i2v) ===
else if (kind === 'i2v') {
  falBody = { prompt };
  
  // Set the image reference
  const imgRef = task.ref_image || (task.ref_images && task.ref_images[0]);
  if (imgRef) {
    falBody.image_url = imgRef;
  }
  
  if (m.includes('kling')) {
    falBody.aspect_ratio = task.aspect_ratio || '16:9';
    falBody.duration = task.duration || '5';
  } else if (m.includes('seedance')) {
    falBody.resolution = task.resolution || '720p';
    falBody.duration = parseInt(task.duration) || 5;
    // Multi-ref for seedance reference-to-video
    if (m.includes('reference') && task.ref_images && task.ref_images.length > 1) {
      falBody.reference_images = task.ref_images.map(url => ({ url }));
    }
  } else if (m.includes('veo3')) {
    falBody.aspect_ratio = task.aspect_ratio || '16:9';
  } else if (m.includes('sora')) {
    falBody.aspect_ratio = task.aspect_ratio || '16:9';
  } else if (m.includes('hailuo') || m.includes('minimax')) {
    falBody.resolution = task.resolution || '720p';
  } else if (m.includes('ltx')) {
    falBody.resolution = task.resolution || '720p';
  } else if (m.includes('hunyuan')) {
    falBody.video_size = task.video_size || 'landscape_16_9';
  } else if (m.includes('pixverse')) {
    falBody.resolution = task.resolution || '720p';
  } else if (m.includes('vidu')) {
    falBody.aspect_ratio = task.aspect_ratio || '16:9';
    falBody.duration = task.duration || '4s';
  }
}

// === VIDEO TO VIDEO (v2v) ===
else if (kind === 'v2v') {
  falBody = { prompt };
  if (task.ref_video) {
    falBody.video_url = task.ref_video;
  }
  // Sora remix
  if (m.includes('sora') && m.includes('remix')) {
    falBody.aspect_ratio = task.aspect_ratio || '16:9';
  }
}

// === TEXT TO SPEECH (tts) ===
else if (kind === 'tts') {
  falBody = { text: prompt };
  
  if (m.includes('elevenlabs')) {
    falBody.voice = task.voice || 'default';
  } else if (m.includes('minimax') || m.includes('speech')) {
    falBody.voice = task.voice || 'default';
  } else if (m.includes('chatterbox')) {
    // Chatterbox uses direct text input
  } else if (m.includes('gemini')) {
    falBody.voice = task.voice || 'default';
  } else if (m.includes('inworld')) {
    falBody.voice = task.voice || 'default';
  }
}

// === TEXT TO AUDIO / MUSIC (t2a) ===
else if (kind === 't2a') {
  if (m.includes('music') || m.includes('minimax-music')) {
    falBody = {
      prompt: prompt,   // lyrics or style description
      duration: parseInt(task.duration) || 30,
    };
  } else if (m.includes('beatoven')) {
    falBody = {
      prompt: prompt,
      duration: parseInt(task.duration) || 30,
    };
  }
}

// === AUDIO TO AUDIO / VOICE CLONE (a2a) ===
else if (kind === 'a2a') {
  falBody = { text: prompt };
  if (task.ref_audio) {
    falBody.audio_url = task.ref_audio;
  }
}

// === IMAGE TO 3D (i23d) ===
else if (kind === 'i23d') {
  falBody = {};
  if (task.ref_image) {
    falBody.image_url = task.ref_image;
  }
  falBody.output_format = task.format || 'glb';
}

// === TEXT TO 3D (t23d) ===
else if (kind === 't23d') {
  falBody = {
    prompt: prompt,
    output_format: task.format || 'glb',
  };
}

// === VIDEO TO AUDIO (v2a) ===
else if (kind === 'v2a') {
  falBody = {};
  if (task.ref_video) {
    falBody.video_url = task.ref_video;
  }
  if (prompt) falBody.prompt = prompt;
}

// === LIPSYNC (lip) ===
else if (kind === 'lip') {
  falBody = {};
  if (task.ref_video) {
    falBody.video_url = task.ref_video;
  }
  if (task.ref_audio) {
    falBody.audio_url = task.ref_audio;
  }
  // Some lipsync models accept text instead of audio
  if (!task.ref_audio && prompt) {
    falBody.text = prompt;
  }
}

// ─── OUTPUT FILE EXTENSION ───
const extMap = { image: 'png', video: 'mp4', audio: 'mp3', '3d': 'glb' };
const outputExt = extMap[modality.type] || 'png';

// ─── FINAL OUTPUT ───
return [{
  json: {
    modelId: modelId,
    falBody: falBody,
    kind: kind,
    outputType: modality.type,
    outputExt: outputExt,
    task_id: task.id,
    user_id: task.user_id,
    freestyle: task.freestyle || false,
    projectTitle: $input.item.json.project?.title || 'FREESTYLE_LAB',
  }
}];
