// ─── EnhanceButton Component ────────────────────────
// AI prompt enhancement dropdown with presets per entity type

import { useState, useRef, useEffect } from 'react'
import { ClipboardList, Clapperboard, Palette, Zap, User, Camera, Ruler, Home, Wrench, Sunrise, Star, Search, Globe, FileText, Flame, Moon, Sparkles, Tornado } from 'lucide-react'
import { enhancePrompt } from '../services/geminiService'

const ENHANCE_PRESETS = {
  character: [
    { id: 'sheet',     icon: <ClipboardList size={14} />, label: 'Character Sheet',     hint: 'Create a professional multi-angle character turnaround reference sheet. Include front, 3/4, side, and back views on a clean neutral background. Show consistent proportions, costume details, and distinguishing features across all angles. Label each view.' },
    { id: 'portrait',  icon: <Clapperboard size={14} />, label: 'Cinematic Portrait',  hint: 'Create a dramatic cinematic character portrait. Use volumetric lighting, shallow depth of field, and a moody atmosphere. Focus on the face and upper body with expressive emotion and rich texture detail.' },
    { id: 'concept',   icon: <Palette size={14} />, label: 'Concept Art',         hint: 'Create concept art in a painterly digital illustration style. Show the full character with dynamic pose, interesting silhouette, and clear design language. Include subtle environment context and mood lighting.' },
    { id: 'action',    icon: <Zap size={14} />, label: 'Action Pose',          hint: 'Create a dynamic action scene with the character in an energetic pose. Add motion blur, dramatic camera angle, impact effects, and cinematic energy. The character should feel alive and powerful.' },
    { id: 'headshot',  icon: <User size={14} />, label: 'Clean Headshot',       hint: 'Create a clean, professional headshot/bust shot on a solid or gradient background. Even studio lighting, sharp details, suitable for use as a reference avatar or identification image.' },
  ],
  prop: [
    { id: 'product',   icon: <Camera size={14} />, label: 'Product Shot',        hint: 'Create a clean, professional product photography shot. Place the object on a reflective dark surface with dramatic studio lighting, subtle rim light, and shallow depth of field. The object should look premium and desirable.' },
    { id: 'blueprint', icon: <Ruler size={14} />, label: 'Technical Blueprint', hint: 'Create a technical blueprint/schematic view of the object. Show top, front, and side orthographic views with dimension annotations on a dark navy grid background. Engineering drawing aesthetic.' },
    { id: 'context',   icon: <Home size={14} />, label: 'In Context',          hint: 'Show the object in its natural environment being used as intended. Natural lighting, realistic setting, lifestyle photography aesthetic. The object should feel integrated into a believable scene.' },
    { id: 'exploded',  icon: <Wrench size={14} />, label: 'Exploded View',       hint: 'Create an exploded diagram view showing the object\'s components and construction details. Clean white/dark background, parts floating in alignment, technical illustration style.' },
  ],
  environment: [
    { id: 'establish', icon: <Sunrise size={14} />, label: 'Establishing Shot',   hint: 'Create a wide cinematic establishing shot. Epic scale with dramatic golden-hour or blue-hour lighting. Use leading lines, atmospheric perspective, and a sense of grandeur. The environment should feel immersive and explorable.' },
    { id: 'matte',     icon: <Palette size={14} />, label: 'Matte Painting',      hint: 'Create a digital matte painting in the style of high-end VFX production. Painterly details, atmospheric depth, volumetric god rays, and sweeping scale. Suitable for use as a background plate in film production.' },
    { id: 'aerial',    icon: <Star size={14} />, label: 'Aerial/Drone View',   hint: 'Create a top-down or high-angle drone perspective of the environment. Show the full layout, geography, and spatial relationships. Include atmospheric haze for depth. Map-like overview with cinematic quality.' },
    { id: 'detail',    icon: <Search size={14} />, label: 'Detail Close-Up',     hint: 'Create a close-up macro detail shot of the environment\'s textures, materials, and small-scale features. Shallow depth of field, rich surface detail, ASMR-level tactile quality.' },
    { id: 'pano',      icon: <Globe size={14} />, label: 'Panoramic Vista',     hint: 'Create an ultra-wide panoramic landscape view (21:9 aspect ratio feeling). Sweeping horizon, multiple layers of depth, and dramatic sky. National Geographic quality.' },
  ],
  shot: [
    { id: 'cinematic', icon: <Clapperboard size={14} />, label: 'Cinematic Frame',     hint: 'Compose as a single film frame from a high-budget production. Apply the rule of thirds, use anamorphic lens characteristics (subtle flare, bokeh), cinematic color grading, and intentional negative space.' },
    { id: 'storyboard',icon: <FileText size={14} />, label: 'Storyboard Panel',    hint: 'Create a clean storyboard panel with clear composition showing character placement, camera angle indicators, and motion arrows. Grayscale or limited color palette, focus on staging and blocking.' },
    { id: 'dynamic',   icon: <Flame size={14} />, label: 'Dynamic Action',      hint: 'Create a high-energy action shot with dramatic camera angle (low angle, dutch tilt, or extreme close-up). Include motion blur, particle effects, and visual tension. Michael Bay meets Roger Deakins.' },
    { id: 'mood',      icon: <Moon size={14} />, label: 'Mood/Atmosphere',     hint: 'Focus entirely on mood, atmosphere, and emotional tone. Use color psychology, lighting contrast, and environmental storytelling. Minimalist composition that evokes a strong emotional response.' },
  ],
  freestyle: [
    { id: 'enhance',   icon: <Sparkles size={14} />, label: 'Smart Enhance',       hint: 'Enhance the prompt with professional-grade detail while preserving the original intent. Add composition, lighting, material, and atmosphere descriptors.' },
    { id: 'cinematic', icon: <Clapperboard size={14} />, label: 'Cinematic',           hint: 'Transform into a cinematic film frame. Add camera lens type, color grading style, lighting setup, and compositional technique.' },
    { id: 'artistic',  icon: <Palette size={14} />, label: 'Fine Art',            hint: 'Transform into fine art aesthetic. Reference specific art movements, techniques, master artists, and museum-quality presentation.' },
    { id: 'hyper',     icon: <Camera size={14} />, label: 'Hyperrealistic',      hint: 'Push toward maximum photorealism. Add camera body/lens spec, f-stop, ISO, lighting rig details, and post-processing workflow for believable reality.' },
    { id: 'abstract',  icon: <Tornado size={14} />, label: 'Abstract/Stylized',  hint: 'Transform into a highly stylized or abstract interpretation. Bold graphic design, surreal elements, experimental composition, and unexpected visual metaphors.' },
  ],
}

export { ENHANCE_PRESETS }

export default function EnhanceButton({ value, onChange, modelId, entityType = 'freestyle', modality = 't2i' }) {
  const [loading, setLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)

  const presets = ENHANCE_PRESETS[entityType] || ENHANCE_PRESETS.freestyle

  useEffect(() => {
    const handleClickOutside = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false) }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const handlePreset = async (preset) => {
    setShowMenu(false)
    if (!value?.trim() || loading) return
    setLoading(true)
    try {
      const enhanced = await enhancePrompt(value, preset, modelId, modality)
      onChange(enhanced)
    } catch (err) {
      console.error('Enhance failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="enhance-container" ref={menuRef}>
      <button
        className={`btn-enhance ${loading ? 'enhancing' : ''}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!loading) setShowMenu(!showMenu) }}
        disabled={!value?.trim() || loading}
        title="Enhance prompt with AI"
      >
        {loading ? <span className="enhance-spinner">◌</span> : '✨'}
      </button>
      {showMenu && (
        <div className="enhance-menu">
          <div className="enhance-menu-title">AI Enhance — {entityType.toUpperCase()}</div>
          {presets.map(p => (
            <button key={p.id} className="enhance-preset-btn" onClick={() => handlePreset(p)}>
              <span className="preset-icon">{p.icon}</span>
              <span className="preset-label">{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
