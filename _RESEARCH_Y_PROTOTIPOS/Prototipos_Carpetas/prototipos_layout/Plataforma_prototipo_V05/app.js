/* ═══════════════════════════════════════════
   V05 — Renderfarm Canvas Studio
   Stitch-inspired floating prompt + generation log
   ═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ── State ──
  const state = {
    shots: [
      { id: 1, title: 'Warehouse — Establishing', prompt: 'Wide shot of an abandoned warehouse at night, rain pouring, neon reflections on wet concrete', model: 'Flux Pro', res: '1080p', dur: '5s', ar: '16:9', status: 'done', cost: '$0.12' },
      { id: 2, title: 'Elena — Close-up Reveal', prompt: 'Elena turns toward camera, warm backlight, shallow depth of field, rain droplets on her face', model: 'Kling 2.0', res: '1080p', dur: '5s', ar: '16:9', status: 'done', cost: '$0.18' },
      { id: 3, title: 'Mike — Noir Silhouette', prompt: 'Mike enters from darkness, noir silhouette, cigarette smoke rising, single overhead light', model: 'Flux Pro', res: '1080p', dur: '8s', ar: '16:9', status: 'pending', cost: '—' },
      { id: 4, title: 'Chase — Alley Sequence', prompt: 'Handheld chase through narrow alley, wet ground reflections, adrenaline pacing, bokeh city lights', model: 'Minimax', res: '720p', dur: '8s', ar: '16:9', status: 'error', cost: '—' },
      { id: 5, title: 'City — Aerial Dusk', prompt: 'Wide aerial drone shot, city at golden hour transitioning to dusk, establishing shot for Act 2', model: 'Wan 2.1', res: '4K', dur: '10s', ar: '21:9', status: 'pending', cost: '—' },
    ],
    selectedShot: null,
    currentModel: 'Flux Pro',
    generating: false,
    zoom: 100,
    models: ['Flux Pro', 'Kling 2.0', 'Minimax', 'Wan 2.1', 'Runway Gen-4', 'Pika 2.2'],
    modelIndex: 0,
  };

  // ── Elements ──
  const $ = id => document.getElementById(id);
  const authScreen = $('auth-screen');
  const appShell = $('app-shell');
  const authBtn = $('auth-btn');
  const authMsg = $('auth-msg');
  const canvasShots = $('canvas-shots');
  const promptInput = $('prompt-input');
  const btnSend = $('btn-send');
  const ctxPanel = $('ctx-panel');
  const ctxClose = $('ctx-close');
  const genLog = $('gen-log');
  const genLogHeader = $('gen-log-header');
  const genLogBody = $('gen-log-body');
  const genLogDot = $('gen-log-dot');
  const genLogTitle = $('gen-log-title');
  const suggestPills = $('suggest-pills');
  const ctxSteps = $('ctx-steps');
  const ctxStepsVal = $('ctx-steps-val');
  const ctxCfg = $('ctx-cfg');
  const ctxCfgVal = $('ctx-cfg-val');
  const btnModel = $('btn-model');
  const modelLabel = $('model-label');
  const zoomVal = $('zoom-val');

  // ── Auth ──
  authBtn.addEventListener('click', () => {
    authMsg.textContent = '◈ Connecting to Studio...';
    authMsg.style.color = 'var(--amber)';
    setTimeout(() => {
      authScreen.style.display = 'none';
      appShell.style.display = 'grid';
      renderShots();
    }, 800);
  });

  // ── Render Shot Cards ──
  function renderShots() {
    canvasShots.innerHTML = '';
    state.shots.forEach(shot => {
      const card = document.createElement('div');
      card.className = `shot-card${state.selectedShot === shot.id ? ' selected' : ''}`;
      card.dataset.id = shot.id;

      const statusClass = `status-${shot.status}`;
      const statusLabel = shot.status === 'done' ? '✓ Done' : shot.status === 'pending' ? '◌ Pending' : '✕ Error';
      const gradients = {
        1: 'linear-gradient(135deg, #1a1a2e, #2d1b4e, #0f0f1a)',
        2: 'linear-gradient(135deg, #2e1a1a, #4e3b1b, #1a0f0f)',
        3: 'linear-gradient(135deg, #0f1a1a, #1b2e4e, #1a1a0f)',
        4: 'linear-gradient(135deg, #1a2e1a, #1b4e3b, #0f1a1a)',
        5: 'linear-gradient(135deg, #2e2e1a, #4e1b3b, #1a0f1a)',
      };

      card.innerHTML = `
        <div class="shot-preview" style="background:${gradients[shot.id] || gradients[1]}">
          <span class="shot-placeholder">▶</span>
          <div class="shot-overlay">
            <span class="shot-badge idx">#${shot.id}</span>
            <span class="shot-badge ${statusClass}">${statusLabel}</span>
          </div>
        </div>
        <div class="shot-body">
          <div class="shot-title">${shot.title}</div>
          <div class="shot-meta">
            <span>◈ ${shot.model}</span>
            <span>${shot.res}</span>
            <span>${shot.dur}</span>
            <span>${shot.cost}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => selectShot(shot.id));
      canvasShots.appendChild(card);
    });
  }

  // ── Select Shot → Open Contextual Panel ──
  function selectShot(id) {
    state.selectedShot = id;
    const shot = state.shots.find(s => s.id === id);
    if (!shot) return;

    // Update card selection
    document.querySelectorAll('.shot-card').forEach(c => {
      c.classList.toggle('selected', parseInt(c.dataset.id) === id);
    });

    // Fill context panel
    $('ctx-shot-title').textContent = `Shot #${shot.id} — ${shot.title}`;
    
    // Set active chips
    ctxPanel.querySelectorAll('.ctx-chip[data-model]').forEach(c => {
      c.classList.toggle('active', c.dataset.model === modelKeyFromName(shot.model));
    });
    ctxPanel.querySelectorAll('.ctx-chip[data-res]').forEach(c => {
      c.classList.toggle('active', c.dataset.res === shot.res);
    });
    ctxPanel.querySelectorAll('.ctx-chip[data-dur]').forEach(c => {
      c.classList.toggle('active', c.dataset.dur === shot.dur);
    });
    ctxPanel.querySelectorAll('.ctx-chip[data-ar]').forEach(c => {
      c.classList.toggle('active', c.dataset.ar === shot.ar);
    });

    // Show panel
    ctxPanel.classList.add('visible');

    // Also put prompt in the floating bar
    promptInput.value = shot.prompt;
    autoResizePrompt();
  }

  function modelKeyFromName(name) {
    const map = { 'Flux Pro': 'flux-pro', 'Kling 2.0': 'kling', 'Minimax': 'minimax', 'Wan 2.1': 'wan' };
    return map[name] || 'flux-pro';
  }

  // ── Close Context Panel ──
  ctxClose.addEventListener('click', () => {
    ctxPanel.classList.remove('visible');
    state.selectedShot = null;
    document.querySelectorAll('.shot-card').forEach(c => c.classList.remove('selected'));
  });

  // ── Context Panel Chips ──
  ctxPanel.addEventListener('click', e => {
    const chip = e.target.closest('.ctx-chip');
    if (!chip) return;
    const parent = chip.closest('.ctx-row');
    parent.querySelectorAll('.ctx-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });

  // ── Sliders ──
  ctxSteps.addEventListener('input', () => ctxStepsVal.textContent = ctxSteps.value);
  ctxCfg.addEventListener('input', () => ctxCfgVal.textContent = parseFloat(ctxCfg.value).toFixed(1));

  // ── Suggestion Pills ──
  suggestPills.addEventListener('click', e => {
    const pill = e.target.closest('.suggest-pill');
    if (!pill) return;
    promptInput.value = pill.dataset.prompt;
    promptInput.focus();
    autoResizePrompt();
  });

  // ── Prompt Auto-resize ──
  function autoResizePrompt() {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
  }
  promptInput.addEventListener('input', autoResizePrompt);

  // ── Model Selector (cycle) ──
  btnModel.addEventListener('click', () => {
    state.modelIndex = (state.modelIndex + 1) % state.models.length;
    state.currentModel = state.models[state.modelIndex];
    modelLabel.textContent = state.currentModel;
  });

  // ── Send / Generate ──
  btnSend.addEventListener('click', () => startGeneration());
  promptInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      startGeneration();
    }
  });

  function startGeneration() {
    const prompt = promptInput.value.trim();
    if (!prompt || state.generating) return;

    state.generating = true;

    // ── Update Generation Log ──
    genLogDot.classList.add('active');
    genLogTitle.textContent = 'Generating...';

    const steps = [
      { text: 'Prompt analyzed', delay: 300 },
      { text: 'Style tokens loaded', delay: 800 },
      { text: 'Character refs injected', delay: 1400 },
      { text: `Rendering via ${state.currentModel}...`, delay: 2000, active: true },
    ];

    // Clear old steps and add new
    genLogBody.innerHTML = '';
    steps.forEach((step, i) => {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = `log-step ${step.active ? 'active' : 'done'}`;
        el.innerHTML = `<span class="log-step-icon">${step.active ? '↻' : '✓'}</span><span>${step.text}</span>`;
        genLogBody.appendChild(el);
        genLogBody.scrollTop = genLogBody.scrollHeight;
      }, step.delay);
    });

    // Add progress bar
    setTimeout(() => {
      const bar = document.createElement('div');
      bar.className = 'log-progress';
      bar.innerHTML = '<div class="log-progress-fill" style="width:0%"></div>';
      genLogBody.appendChild(bar);

      let pct = 0;
      const fill = bar.querySelector('.log-progress-fill');
      const interval = setInterval(() => {
        pct += Math.random() * 12 + 3;
        if (pct >= 100) {
          pct = 100;
          clearInterval(interval);
          finishGeneration(prompt);
        }
        fill.style.width = pct + '%';
      }, 200);
    }, 2200);
  }

  function finishGeneration(prompt) {
    // Add final step
    const last = genLogBody.querySelector('.log-step.active');
    if (last) {
      last.className = 'log-step done';
      last.querySelector('.log-step-icon').textContent = '✓';
    }

    const finalStep = document.createElement('div');
    finalStep.className = 'log-step done';
    finalStep.innerHTML = '<span class="log-step-icon" style="color:var(--green)">✓</span><span style="color:var(--green)">Complete — ready for review</span>';
    genLogBody.appendChild(finalStep);
    genLogBody.scrollTop = genLogBody.scrollHeight;

    genLogDot.classList.remove('active');
    genLogTitle.textContent = 'Complete';
    state.generating = false;

    // Add new shot
    const newId = state.shots.length + 1;
    const words = prompt.split(' ').slice(0, 3).join(' ');
    state.shots.push({
      id: newId,
      title: words + '...',
      prompt: prompt,
      model: state.currentModel,
      res: '1080p',
      dur: '5s',
      ar: '16:9',
      status: 'done',
      cost: '$0.' + (Math.floor(Math.random() * 20) + 8),
    });

    renderShots();
    promptInput.value = '';
    autoResizePrompt();

    // Reset log after delay
    setTimeout(() => {
      genLogTitle.textContent = 'Ready';
    }, 3000);
  }

  // ── Generation Log Toggle ──
  genLogHeader.addEventListener('click', () => {
    genLog.classList.toggle('collapsed');
  });

  // ── Prompt Mode Toggle ──
  document.querySelectorAll('.prompt-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.prompt-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ── Rail Navigation ──
  document.querySelectorAll('.rail-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rail-btn[data-view]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ── Tool Strip ──
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool === 'zin') {
        state.zoom = Math.min(state.zoom + 10, 200);
        zoomVal.textContent = state.zoom + '%';
      } else if (tool === 'zout') {
        state.zoom = Math.max(state.zoom - 10, 50);
        zoomVal.textContent = state.zoom + '%';
      } else if (tool === 'add') {
        promptInput.focus();
        promptInput.value = '';
      } else if (tool === 'style') {
        const sc = $('style-card');
        sc.style.display = sc.style.display === 'none' ? 'block' : 'none';
      } else if (tool === 'regen' && state.selectedShot) {
        const shot = state.shots.find(s => s.id === state.selectedShot);
        if (shot) {
          promptInput.value = shot.prompt;
          autoResizePrompt();
          startGeneration();
        }
      }
    });
  });

  // ── Context Panel Generate ──
  $('ctx-generate').addEventListener('click', () => {
    if (state.selectedShot) {
      const shot = state.shots.find(s => s.id === state.selectedShot);
      if (shot) {
        promptInput.value = shot.prompt;
        autoResizePrompt();
        startGeneration();
      }
    }
  });

  // ── Context Panel Duplicate ──
  $('ctx-duplicate').addEventListener('click', () => {
    if (state.selectedShot) {
      const shot = state.shots.find(s => s.id === state.selectedShot);
      if (shot) {
        const newId = state.shots.length + 1;
        state.shots.push({ ...shot, id: newId, title: shot.title + ' (copy)', status: 'pending', cost: '—' });
        renderShots();
      }
    }
  });

  // ── Context Panel Delete ──
  $('ctx-delete').addEventListener('click', () => {
    if (state.selectedShot) {
      state.shots = state.shots.filter(s => s.id !== state.selectedShot);
      ctxPanel.classList.remove('visible');
      state.selectedShot = null;
      renderShots();
    }
  });

  // ── Context Panel Compare ──
  $('ctx-compare').addEventListener('click', () => {
    document.querySelectorAll('.rail-btn[data-view]').forEach(b => b.classList.remove('active'));
    document.querySelector('.rail-btn[data-view="compare"]').classList.add('active');
  });

  // ── @ mention detection ──
  promptInput.addEventListener('input', () => {
    const val = promptInput.value;
    const entities = $('prompt-entities');
    const mentions = val.match(/@\w+/g);
    if (mentions && mentions.length) {
      entities.style.display = 'flex';
      entities.innerHTML = mentions.map(m => 
        `<span class="prompt-entity inserted">${m}</span>`
      ).join('');
    } else {
      entities.style.display = 'none';
    }
  });

  // ── Keyboard Shortcut: Escape to close panel ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ctxPanel.classList.remove('visible');
      state.selectedShot = null;
      document.querySelectorAll('.shot-card').forEach(c => c.classList.remove('selected'));
    }
  });

});
