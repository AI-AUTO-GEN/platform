// ─── Director Panel ──────────────────────────────
// P41 FIX: Full UI for the Director Pipeline
// Connects generateScript, generateShotlist, extractEntities, assistShot

import React, { useState, useCallback } from 'react';
import { generateScript, generateShotlist, extractEntities, assistShot } from '../services/geminiService';

const STEPS = [
  { id: 'idea', label: '💡 Idea', desc: 'Your raw concept' },
  { id: 'script', label: '📜 Script', desc: 'AI screenplay' },
  { id: 'shotlist', label: '🎬 Shotlist', desc: 'Camera breakdown' },
  { id: 'entities', label: '🧩 Entities', desc: 'Characters, props, environments' },
];

export default function DirectorPanel({ onApplyToCanvas, language = 'en' }) {
  const [step, setStep] = useState('idea');
  const [idea, setIdea] = useState('');
  const [script, setScript] = useState('');
  const [shotlist, setShotlist] = useState([]);
  const [entities, setEntities] = useState({ characters: [], props: [], environments: [] });
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [error, setError] = useState('');
  const [editingShot, setEditingShot] = useState(null);
  const [feedback, setFeedback] = useState('');

  const handleGenerateScript = useCallback(async () => {
    if (!idea.trim()) return;
    setLoading(true);
    setLoadingLabel('Generating screenplay…');
    setError('');
    try {
      const result = await generateScript(idea, language);
      setScript(result);
      setStep('script');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
    setLoadingLabel('');
  }, [idea, language]);

  const handleGenerateShotlist = useCallback(async () => {
    if (!script.trim()) return;
    setLoading(true);
    setLoadingLabel('Breaking down into shots…');
    setError('');
    try {
      const result = await generateShotlist(script, language);
      setShotlist(result);
      setStep('shotlist');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
    setLoadingLabel('');
  }, [script, language]);

  const handleExtractEntities = useCallback(async () => {
    if (!script.trim()) return;
    setLoading(true);
    setLoadingLabel('Extracting characters, props & environments…');
    setError('');
    try {
      const result = await extractEntities(script, language);
      setEntities(result);
      setStep('entities');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
    setLoadingLabel('');
  }, [script, language]);

  const handleAssistShot = useCallback(async (shotIndex) => {
    if (!feedback.trim()) return;
    setLoading(true);
    setLoadingLabel(`Revising shot #${shotIndex + 1}…`);
    try {
      const revised = await assistShot(script, shotlist, shotIndex, feedback, language);
      setShotlist(prev => prev.map((s, i) => i === shotIndex ? { ...s, ...revised } : s));
      setEditingShot(null);
      setFeedback('');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
    setLoadingLabel('');
  }, [feedback, script, shotlist, language]);

  const handleApplyAll = useCallback(() => {
    if (!onApplyToCanvas) return;
    const shots = shotlist.map((s, i) => ({
      id: `SHOT_DIR_${String(i + 1).padStart(3, '0')}`,
      title: `Shot ${s.shotNumber || i + 1}: ${s.type}`,
      prompt: s.description || s.action || '',
      model: 'fal-ai/flux-pro/v1.1',
      modelId: 'fal-ai/flux-pro/v1.1',
      cat: 'image',
      status: 'pending',
      res: '1080p',
      ar: '16:9',
      cameraMove: s.camera || '',
      entities: [],
    }));
    onApplyToCanvas({
      characters: entities.characters?.map((c, i) => ({
        id: `CHR_DIR_${String(i + 1).padStart(3, '0')}`,
        name: c.name || c,
        prompt: c.description || c.visual || '',
        modelId: 'fal-ai/flux-pro/v1.1',
      })) || [],
      props: entities.props?.map((p, i) => ({
        id: `PRP_DIR_${String(i + 1).padStart(3, '0')}`,
        name: p.name || p,
        prompt: p.description || p.visual || '',
        modelId: 'fal-ai/flux-pro/v1.1',
      })) || [],
      environments: entities.environments?.map((e, i) => ({
        id: `ENV_DIR_${String(i + 1).padStart(3, '0')}`,
        name: e.name || e,
        prompt: e.description || e.visual || '',
        modelId: 'fal-ai/flux-pro/v1.1',
      })) || [],
      shots,
    });
  }, [shotlist, entities, onApplyToCanvas]);

  const stepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a10' }}>
      {/* Step Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '16px 20px', borderBottom: '1px solid #222236', background: '#0e0e14' }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            {i > 0 && <div style={{ width: '24px', height: '1px', background: i <= stepIndex ? '#7c5cff' : '#333348' }} />}
            <button
              onClick={() => setStep(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '8px', border: 'none',
                background: step === s.id ? 'rgba(124,92,255,.12)' : 'transparent',
                color: i <= stepIndex ? '#f0f0f5' : '#5a5a78',
                cursor: 'pointer', fontSize: '11px', fontWeight: step === s.id ? 700 : 500,
                transition: '.15s',
              }}
            >
              <span style={{ fontSize: '14px' }}>{s.label.split(' ')[0]}</span>
              <span>{s.label.split(' ').slice(1).join(' ')}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Loading Bar */}
      {loading && (
        <div style={{ padding: '0 20px' }}>
          <div style={{ height: '2px', background: '#222236', borderRadius: '1px', overflow: 'hidden', marginTop: '2px' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #7c5cff, #ff2d78, #7c5cff)', width: '40%', animation: 'shimmer 1.5s infinite', borderRadius: '1px' }} />
          </div>
          <div style={{ fontSize: '10px', color: '#7c5cff', padding: '6px 0', fontWeight: 600 }}>⟳ {loadingLabel}</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ margin: '0 20px', padding: '8px 12px', background: 'rgba(255,77,77,.08)', border: '1px solid rgba(255,77,77,.2)', borderRadius: '8px', fontSize: '11px', color: '#ff4d4d' }}>
          ✗ {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '12px' }}>✕</button>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* ═══ STEP: IDEA ═══ */}
        {step === 'idea' && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f0f0f5', marginBottom: '4px' }}>💡 Start with an Idea</h2>
            <p style={{ fontSize: '12px', color: '#5a5a78', marginBottom: '20px' }}>
              Describe your concept in 2-3 lines. The AI Director will transform it into a professional screenplay, break it into a detailed shotlist, and extract all characters, props, and environments.
            </p>
            <textarea
              rows={6}
              placeholder="A dystopian city where children discover a hidden garden growing in the ruins of an old library. They must protect it from corporate drones that are programmed to destroy all organic matter..."
              value={idea}
              onChange={e => setIdea(e.target.value)}
              style={{
                width: '100%', background: '#14141e', border: '1px solid #333348', borderRadius: '10px',
                padding: '14px 16px', color: '#f0f0f5', fontSize: '13px', fontFamily: "'Inter', system-ui, sans-serif",
                resize: 'vertical', outline: 'none', minHeight: '120px',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={handleGenerateScript}
                disabled={loading || !idea.trim()}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                  background: idea.trim() ? 'linear-gradient(135deg, #7c5cff, #6a4cef)' : '#222236',
                  color: idea.trim() ? '#fff' : '#5a5a78',
                  fontWeight: 700, fontSize: '13px', cursor: idea.trim() ? 'pointer' : 'default',
                  transition: '.2s', letterSpacing: '.5px',
                }}
              >
                {loading ? '⟳ Generating…' : '✦ Generate Screenplay'}
              </button>
            </div>
            <div style={{ fontSize: '10px', color: '#5a5a78', marginTop: '8px', textAlign: 'center' }}>
              Uses Gemini AI to create a professional screenplay structure
            </div>
          </div>
        )}

        {/* ═══ STEP: SCRIPT ═══ */}
        {step === 'script' && (
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#f0f0f5' }}>📜 Screenplay</h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setStep('idea')} style={smallBtnStyle}>← Back to Idea</button>
                <button onClick={handleGenerateScript} disabled={loading} style={{ ...smallBtnStyle, color: '#7c5cff' }}>↻ Regenerate</button>
              </div>
            </div>
            <textarea
              rows={20}
              value={script}
              onChange={e => setScript(e.target.value)}
              style={{
                width: '100%', background: '#14141e', border: '1px solid #333348', borderRadius: '10px',
                padding: '16px', color: '#f0f0f5', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace",
                resize: 'vertical', outline: 'none', lineHeight: '1.6',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={handleGenerateShotlist}
                disabled={loading || !script.trim()}
                style={{ ...primaryBtnStyle, flex: 1 }}
              >
                🎬 Break into Shotlist
              </button>
              <button
                onClick={handleExtractEntities}
                disabled={loading || !script.trim()}
                style={{ ...primaryBtnStyle, flex: 1, background: 'linear-gradient(135deg, #ff2d78, #d4207a)' }}
              >
                🧩 Extract Entities
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP: SHOTLIST ═══ */}
        {step === 'shotlist' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#f0f0f5' }}>🎬 Shotlist ({shotlist.length} shots)</h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setStep('script')} style={smallBtnStyle}>← Script</button>
                <button onClick={handleGenerateShotlist} disabled={loading} style={{ ...smallBtnStyle, color: '#7c5cff' }}>↻ Regenerate</button>
                <button onClick={() => { handleExtractEntities(); }} disabled={loading} style={{ ...smallBtnStyle, color: '#ff2d78' }}>🧩 Extract Entities</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {shotlist.map((shot, i) => (
                <div key={shot.id || i} style={{
                  display: 'flex', gap: '12px', padding: '12px 14px',
                  background: editingShot === i ? '#1a1a28' : '#14141e',
                  border: `1px solid ${editingShot === i ? '#7c5cff' : '#333348'}`,
                  borderRadius: '10px', transition: '.15s',
                }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(24,144,255,.1)', color: '#1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}>
                    {shot.shotNumber || i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(124,92,255,.1)', color: '#7c5cff', fontWeight: 700 }}>{shot.type}</span>
                      {shot.camera && <span style={{ fontSize: '9px', color: '#5a5a78' }}>📷 {shot.camera}</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#f0f0f5', lineHeight: '1.5' }}>{shot.description}</div>
                    {shot.action && <div style={{ fontSize: '10px', color: '#a0a0b8', marginTop: '4px' }}>⟡ {shot.action}</div>}
                    {shot.dialogue && <div style={{ fontSize: '10px', color: '#00d4ff', marginTop: '2px', fontStyle: 'italic' }}>"{shot.dialogue}"</div>}
                    {shot.notes && <div style={{ fontSize: '9px', color: '#5a5a78', marginTop: '2px' }}>📝 {shot.notes}</div>}

                    {editingShot === i && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                        <input
                          placeholder="Director feedback for this shot…"
                          value={feedback}
                          onChange={e => setFeedback(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAssistShot(i) }}
                          style={{ flex: 1, background: '#0e0e14', border: '1px solid #333348', borderRadius: '6px', padding: '6px 10px', color: '#f0f0f5', fontSize: '11px', outline: 'none' }}
                        />
                        <button onClick={() => handleAssistShot(i)} disabled={loading} style={{ ...smallBtnStyle, color: '#7c5cff' }}>Revise</button>
                        <button onClick={() => { setEditingShot(null); setFeedback(''); }} style={smallBtnStyle}>✕</button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                    <button onClick={() => { setEditingShot(editingShot === i ? null : i); setFeedback(''); }} style={{ ...smallBtnStyle, fontSize: '9px' }}>
                      {editingShot === i ? 'Close' : '✎ Assist'}
                    </button>
                    <span style={{
                      fontSize: '9px', padding: '2px 6px', borderRadius: '4px',
                      background: shot.approved ? 'rgba(78,203,113,.1)' : 'rgba(245,166,35,.1)',
                      color: shot.approved ? '#4ecb71' : '#f5a623',
                    }}>
                      {shot.approved ? '✓ OK' : '⏳'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ STEP: ENTITIES ═══ */}
        {step === 'entities' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#f0f0f5' }}>🧩 Extracted Entities</h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setStep('shotlist')} style={smallBtnStyle}>← Shotlist</button>
                <button onClick={handleExtractEntities} disabled={loading} style={{ ...smallBtnStyle, color: '#ff2d78' }}>↻ Re-extract</button>
              </div>
            </div>

            {[
              { key: 'characters', icon: '👤', color: '#ff4d4f', label: 'Characters' },
              { key: 'props', icon: '🔫', color: '#d4b106', label: 'Props' },
              { key: 'environments', icon: '🏙️', color: '#52c41a', label: 'Environments' },
            ].map(cat => (
              <div key={cat.key} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
                  {cat.icon} {cat.label} ({(entities[cat.key] || []).length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(entities[cat.key] || []).map((item, i) => (
                    <div key={i} style={{
                      padding: '8px 14px', background: '#14141e',
                      border: `1px solid ${cat.color}33`, borderRadius: '8px',
                      fontSize: '11px', color: '#f0f0f5',
                    }}>
                      <div style={{ fontWeight: 600 }}>{typeof item === 'string' ? item : item.name}</div>
                      {item.description && <div style={{ fontSize: '9px', color: '#5a5a78', marginTop: '2px' }}>{item.description}</div>}
                    </div>
                  ))}
                  {(entities[cat.key] || []).length === 0 && (
                    <div style={{ fontSize: '10px', color: '#5a5a78', fontStyle: 'italic' }}>No {cat.label.toLowerCase()} extracted</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      {(shotlist.length > 0 || Object.values(entities).some(a => a?.length > 0)) && (
        <div style={{
          padding: '12px 20px', borderTop: '1px solid #222236', background: '#0e0e14',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: '10px', color: '#5a5a78' }}>
            {shotlist.length} shots · {(entities.characters?.length || 0)} chars · {(entities.props?.length || 0)} props · {(entities.environments?.length || 0)} envs
          </div>
          <button
            onClick={handleApplyAll}
            style={{
              padding: '10px 24px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #7c5cff, #ff2d78)',
              color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
              transition: '.2s', letterSpacing: '.5px',
            }}
          >
            ⚡ Apply to Canvas
          </button>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}

const smallBtnStyle = {
  background: 'none', border: '1px solid #333348', borderRadius: '6px',
  padding: '4px 10px', fontSize: '10px', color: '#a0a0b8',
  cursor: 'pointer', transition: '.15s', fontFamily: 'inherit',
};

const primaryBtnStyle = {
  padding: '12px', borderRadius: '10px', border: 'none',
  background: 'linear-gradient(135deg, #7c5cff, #6a4cef)',
  color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
  transition: '.2s', letterSpacing: '.5px', fontFamily: 'inherit',
};
