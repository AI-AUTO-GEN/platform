// P29/P30 FIX: Lazy-load the 229KB falPricingDB to reduce initial bundle size
let FAL_PRICING_DB = null;
async function getFalPricing() {
  if (!FAL_PRICING_DB) {
    try {
      const mod = await import('./falPricingDB');
      FAL_PRICING_DB = mod.FAL_PRICING_DB || {};
    } catch { FAL_PRICING_DB = {}; }
  }
  return FAL_PRICING_DB;
}
// Pre-warm: start loading the pricing DB immediately (non-blocking)
getFalPricing();

// ─── DYNAMIC REGISTRY (From Supabase ai_models table) ─────────
export const DYNAMIC_PRICING = {};

export function updateModelPricing(id, info) {
  DYNAMIC_PRICING[id] = info;
}
// ─── FALLBACK PRICING FOR KEY MODELS ────────────────────────
// These are the most-used models in our platform whose pricing pages
// didn't get scraped properly. Values confirmed from fal.ai docs April 2026.
const FALLBACK_PRICING = {
  'fal-ai/flux-pro/v1.1':            { base: 0.04,  type: 'megapixel',     desc: '$0.04/MP' },
  'fal-ai/flux-pro/v1.1-ultra':      { base: 0.06,  type: 'fixed',         desc: '$0.06/image (up to 4MP)' },
  'fal-ai/flux-pro/kontext':         { base: 0.05,  type: 'megapixel',     desc: '$0.05/MP' },
  'fal-ai/flux-pro/kontext/max':     { base: 0.10,  type: 'megapixel',     desc: '$0.10/MP' },
  'fal-ai/flux/dev':                 { base: 0.025, type: 'megapixel',     desc: '$0.025/MP (open weight)' },
  'fal-ai/flux/schnell':             { base: 0.003, type: 'megapixel',     desc: '$0.003/MP (fast)' },
  'fal-ai/flux-lora':                { base: 0.025, type: 'megapixel',     desc: '$0.025/MP with LoRA' },
  'fal-ai/flux-2':                   { base: 0.025, type: 'megapixel',     desc: '$0.025/MP' },
  'fal-ai/flux-1/schnell':           { base: 0.003, type: 'megapixel',     desc: '$0.003/MP' },
  'fal-ai/imagen4/preview':          { base: 0.04,  type: 'fixed',         desc: '$0.04/image (Google Imagen 4)' },
  'fal-ai/imagen4/preview/fast':     { base: 0.02,  type: 'fixed',         desc: '$0.02/image (Imagen 4 Fast)' },
  'fal-ai/imagen4/preview/ultra':    { base: 0.08,  type: 'fixed',         desc: '$0.08/image (Imagen 4 Ultra)' },
  'xai/grok-imagine-image':          { base: 0.02,  type: 'fixed',         desc: '$0.02/image' },
  'fal-ai/recraft/v4/text-to-image': { base: 0.04,  type: 'fixed',         desc: '$0.04/image' },
  'fal-ai/flux-pro/kontext/text-to-image': { base: 0.04, type: 'megapixel', desc: '$0.04/MP' },
  'fal-ai/flux-pro/kontext/max/multi':     { base: 0.10, type: 'megapixel', desc: '$0.10/MP' },
  'fal-ai/flux-2/turbo':             { base: 0.015, type: 'megapixel',     desc: '$0.015/MP' },
  'fal-ai/flux-2/flash':             { base: 0.01,  type: 'megapixel',     desc: '$0.01/MP' },
  'fal-ai/flux-kontext/dev':         { base: 0.025, type: 'megapixel',     desc: '$0.025/MP' },
};

/**
 * Converts the options array from getModelOptions() into a flat params object
 * using each option's default value.  
 * getModelOptions returns: [{key: 'aspect_ratio', default: '16:9', ...}, ...]
 * This produces:           { aspect_ratio: '16:9' }
 */
export function optionsToParams(optionsArray) {
  if (!Array.isArray(optionsArray)) return optionsArray || {};
  const params = {};
  for (const opt of optionsArray) {
    if (opt.key && opt.default !== undefined) {
      params[opt.key] = opt.default;
    }
  }
  return params;
}

/**
 * Calculates the estimated cost of a fal.ai generation before executing it.
 * @param {string} modelId - The fal-ai model endpoint string (e.g. "fal-ai/flux-pro/kontext").
 * @param {object|Array} params - Settings object OR the options array from getModelOptions().
 * @returns {number|null} The exact cost in dollars, or null if unknown.
 */
export function calculatePreviewCost(modelId, params = {}) {
  // Gracefully handle if someone passes the options array instead of a params object
  const safeParams = Array.isArray(params) ? optionsToParams(params) : (params || {});

  // Try the DYNAMIC_PRICING DB from Supabase first
  let modelInfo = DYNAMIC_PRICING[modelId];
  if (!modelInfo) {
    // Fallback to scraped DB (lazy-loaded, may be null on first call)
    modelInfo = FAL_PRICING_DB?.[modelId] || null;
  }
  if (!modelInfo || (modelInfo.type === 'unknown' && modelInfo.base === 0)) {
    modelInfo = FALLBACK_PRICING[modelId];
  }
  if (!modelInfo) return null;

  const { base, type } = modelInfo;

  if (type === 'fixed') {
    let cost = base;
    
    // Some fixed image models charge more for higher res scaling
    if (safeParams.image_size && typeof safeParams.image_size === 'string') {
      const sizeLower = safeParams.image_size.toLowerCase();
      if ((sizeLower.includes('2k') || sizeLower.includes('landscape_16_9_2k')) && modelInfo.multipliers?.['2k']) {
        cost *= modelInfo.multipliers['2k'];
      } else if ((sizeLower.includes('4k') || sizeLower.includes('landscape_16_9_4k')) && modelInfo.multipliers?.['4k']) {
        cost *= modelInfo.multipliers['4k'];
      }
    }
    
    const count = parseInt(safeParams.num_images || safeParams.n || 1, 10);
    return cost * count;
  }

  if (type === 'megapixel') {
    const w = parseInt(safeParams.width || 1024, 10);
    const h = parseInt(safeParams.height || 1024, 10);
    let megapixels = (w * h) / 1000000;
    
    if (megapixels < 1.0) megapixels = 1.0; // Most models clamp to 1MP minimum
    
    const count = parseInt(safeParams.num_images || safeParams.n || 1, 10);
    return base * megapixels * count;
  }

  if (type === 'duration_sec') {
    const duration = parseFloat(safeParams.duration || safeParams.video_length || safeParams.duration_seconds || 5.0);
    return base * duration;
  }

  if (type === 'compute_sec') {
    return base * 5.0; // 5 seconds average baseline
  }
  
  if (type === 'fixed_inferred') {
    return (base === 0 ? null : base);
  }

  if (type === 'tokens') {
    // Token-based models (GPT Image etc) — rough estimate
    return base === 0 ? 0.04 : base; // GPT Image ~$0.04 average
  }

  return base === 0 ? null : base;
}

/**
 * Convenience function to stringify cost for display.
 */
export function formatCost(cost) {
  if (cost === null || cost === undefined || isNaN(cost)) return "~$0.04";
  if (cost < 0.001) return `< $0.001`;
  return `$${cost.toFixed(3)}`;
}
