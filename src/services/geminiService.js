// ─── Gemini AI Service ────────────────────────────
// Extracted from App.jsx — handles all LLM proxy calls

import { supabase } from '../supabase'
import { GEMINI_PROXY_URL } from '../config/constants'
import { getModelHint } from '../config/modelRegistry'

export const callGeminiProxy = async (prompt, temperature = 0.8, maxOutputTokens = 8000) => {
  const { data: { session } } = await supabase.auth.getSession()
  // VULNERABILITY FIXED: Removed insecure fallback to the public anon key.
  // The backend gemini-proxy now correctly expects a valid signed user JWT.
  if (!session?.access_token) {
    throw new Error('Authentication required: You must be logged in to use AI tools.')
  }
  const token = session.access_token

  const res = await fetch(GEMINI_PROXY_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ prompt, temperature, maxOutputTokens })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    
    // Parse Google's exact error details if available from the proxy
    let detailMsg = '';
    if (err.details) {
      try {
        const d = JSON.parse(err.details);
        detailMsg = d.error?.message || err.details;
      } catch (e) {
        detailMsg = err.details;
      }
    }
    
    throw new Error(detailMsg ? `Gemini Error: ${detailMsg}` : (err.error || `Gemini proxy error ${res.status}`))
  }
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.text || ''
}

export const geminiDirector = async (systemPrompt, userPrompt) => {
  return callGeminiProxy(`${systemPrompt}\n\n${userPrompt}`, 0.8, 8000)
}

export const enhancePrompt = async (currentPrompt, preset, modelId, modality = 't2i') => {
  const modelHint = getModelHint(modelId)
  const presetHint = preset?.hint || 'Enhance the prompt with professional detail.'
  const fullPrompt = `You are an expert AI prompt engineer specializing in generative AI.\n\nTARGET MODEL: ${modelHint}\n\nPRESET STYLE: ${presetHint}\n\nRules:\n- Output ONLY the enhanced prompt text, no explanations, no quotes, no labels\n- You MUST write a complete, grammatically correct paragraph (at least 30-50 words).\n- NEVER leave sentences unfinished or truncated.\n- Preserve the user's core subject/intent completely\n- Optimize prompt structure for the specific target model\n- Apply the preset style direction naturally\n- Add professional-grade visual/audio/3D descriptors appropriate to the medium\n- If the input is very short, creatively expand it following the preset direction\n- Never output markdown formatting, bullet points, or labels\n\nUser prompt:\n"${currentPrompt}"`

  let text = await callGeminiProxy(fullPrompt, 0.85, 2000)
  if (text) text = text.replace(/^"|"$/g, '').trim()
  return text || currentPrompt
}

export const generateScript = async (idea, language) => {
  const lang = language === 'es' ? 'Spanish' : 'English'
  return geminiDirector(
    `You are a world-class screenwriter. Write a complete, professional screenplay based on the user's input. Write entirely in ${lang}.\n\nRules:\n- Output a properly formatted screenplay with scene headings (INT./EXT.), action lines, character names, and dialogue\n- Include scene numbers\n- Keep it concise but complete (aim for 5-15 scenes depending on complexity)\n- If the user provides just a simple idea, expand it into a compelling narrative\n- If the user provides a full draft, refine and polish it professionally\n- DO NOT add any meta-commentary, explanations, or notes outside the screenplay itself\n- Output ONLY the screenplay text`,
    idea
  )
}

export const generateShotlist = async (script, language) => {
  const lang = language === 'es' ? 'Spanish' : 'English'
  const raw = await geminiDirector(
    `You are a professional film director creating a detailed shotlist from a screenplay. Write all descriptions in ${lang}.\n\nRules:\n- Break the script into individual camera shots\n- For each shot output a JSON object with these fields: shotNumber, type, description, action, dialogue (if any), camera (lens/movement notes), notes\n- Output ONLY a valid JSON array of shot objects, no markdown fencing, no explanation\n- Typical short films have 20-60 shots. Be thorough.\n- Each shot should be a single camera setup\n- Include transition notes between shots when relevant`,
    script
  )
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
    const parsed = JSON.parse(cleaned)
    return parsed.map((s, i) => ({
      id: `SL_${String(i + 1).padStart(3, '0')}`,
      shotNumber: s.shotNumber || i + 1,
      type: s.type || 'MEDIUM',
      description: s.description || '',
      action: s.action || '',
      dialogue: s.dialogue || '',
      camera: s.camera || '',
      notes: s.notes || '',
      approved: false,
      aiSuggestion: ''
    }))
  } catch (e) {
    console.error('Shotlist parse error:', e, raw)
    return [{ id: 'SL_001', shotNumber: 1, type: 'WIDE', description: 'Parse error — please regenerate', action: '', dialogue: '', camera: '', notes: raw.slice(0, 200), approved: false, aiSuggestion: '' }]
  }
}

export const extractEntities = async (script, language) => {
  const lang = language === 'es' ? 'Spanish' : 'English'
  const raw = await geminiDirector(
    `You are a film production analyst. Extract all characters, props, and environments from the screenplay. Write all names/descriptions in ${lang}.\n\nRules:\n- Output ONLY a valid JSON object with three arrays: "characters", "props", "environments"\n- Each item in every array must have "name" and "description" fields\n- Characters: named individuals or groups with speaking roles or significant screen time\n- Props: important physical objects that appear in the story\n- Environments: distinct locations or settings\n- Be thorough — don't miss any mentioned in the script\n- Output ONLY valid JSON, no markdown fencing, no explanation`,
    script
  )
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      characters: parsed.characters || [],
      props: parsed.props || [],
      environments: parsed.environments || [],
    }
  } catch (e) {
    console.error('Entity extraction parse error:', e, raw)
    return { characters: [], props: [], environments: [] }
  }
}

export const assistShot = async (script, shotlist, shotIndex, feedback, language) => {
  const lang = language === 'es' ? 'Spanish' : 'English'
  const shot = shotlist[shotIndex]
  const context = shotlist.map((s, i) => `[${s.id}] ${s.type}: ${s.description}`).join('\n')
  const raw = await geminiDirector(
    `You are a film director's AI assistant. A human director has feedback about a specific shot in their shotlist. Write in ${lang}.\n\nFULL SCREENPLAY (for context):\n${script.slice(0, 3000)}\n\nFULL SHOTLIST:\n${context}\n\nRules:\n- Output a revised version of the shot as a JSON object with fields: type, description, action, dialogue, camera, notes\n- Respond to the director's feedback intelligently\n- Keep consistency with the rest of the shotlist and screenplay\n- Output ONLY valid JSON, no markdown, no explanation`,
    `CURRENT SHOT [${shot.id}]:\nType: ${shot.type}\nDescription: ${shot.description}\nAction: ${shot.action}\nDialogue: ${shot.dialogue}\nCamera: ${shot.camera}\n\nDIRECTOR FEEDBACK: "${feedback}"`
  )
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
    return JSON.parse(cleaned)
  } catch (e) {
    return { description: raw.slice(0, 500) }
  }
}
