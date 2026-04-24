// ─── ModelPicker Component ────────────────────────
// Dual dropdown: company → model, driven by MODEL_REGISTRY

import { MODEL_REGISTRY } from '../config/modelRegistry'
import { MODALITIES } from '../config/constants'

export default function ModelPicker({ type, value, onChange }) {
  const regKey = MODALITIES[type]?.reg || type
  const categories = MODEL_REGISTRY[regKey] || MODEL_REGISTRY.image
  const currentCategory = categories.find(c => c.models.some(m => m.id === value)) || categories[0]
  
  if (!currentCategory || currentCategory.company === 'Loading...') {
    return <div className="model-picker-group"><select className="select-mini" disabled><option>Loading...</option></select></div>;
  }

  return (
    <div className="model-picker-group">
      <select className="select-mini company-sel" 
              value={currentCategory.company} 
              onChange={(e) => onChange(categories.find(c => c.company === e.target.value).models[0].id)}>
        {categories.map(c => <option key={c.company} value={c.company}>{c.company}</option>)}
      </select>
      <select className="select-mini model-sel accent" 
              value={value} 
              onChange={(e) => onChange(e.target.value)}>
        {currentCategory.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    </div>
  )
}
