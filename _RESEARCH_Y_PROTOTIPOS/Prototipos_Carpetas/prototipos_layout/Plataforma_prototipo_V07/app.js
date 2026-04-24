/* ═══ V07 — Full-Spectrum Renderfarm Prototype ═══ */
(function(){
'use strict';

// ─── STATE ──────────────────────────────────────────
const state = {
  user: null,
  shots: [],
  selectedShot: null,
  mode: 'shot',
  view: 'canvas',
  generating: false,
  sessionCost: 0,
  queue: []
};

// ─── DEMO DATA ──────────────────────────────────────
const DEMO_SHOTS = [
  { id:'s1', title:'Warehouse establishing', prompt:'Warehouse establishing shot, rain, night, neon reflections on wet asphalt', model:'Flux Pro', cat:'image', status:'done', res:'1080p', dur:'—', ar:'16:9', cost:0.065, entities:['Mike'] },
  { id:'s2', title:'Elena close-up reveal', prompt:'Elena close-up reveal, warm backlight, shallow DOF, mysterious expression', model:'Kling 3.0', cat:'video', status:'done', res:'1080p', dur:'5s', ar:'16:9', cost:0.12, entities:['Elena'] },
  { id:'s3', title:'Chase sequence', prompt:'Chase sequence through alley, handheld, wet reflections, neon signs', model:'Wan 2.1', cat:'video', status:'pending', res:'720p', dur:'8s', ar:'16:9', cost:0.08, entities:['Mike','Elena'] },
  { id:'s4', title:'Mike noir silhouette', prompt:'Mike noir silhouette, cigarette smoke, overhead light, film grain', model:'Flux Pro', cat:'image', status:'error', res:'1080p', dur:'—', ar:'16:9', cost:0.065, entities:['Mike'] },
  { id:'s5', title:'City aerial dusk', prompt:'Wide aerial, city at dusk, golden hour establishing, volumetric haze', model:'Veo 3', cat:'video', status:'pending', res:'4K', dur:'5s', ar:'21:9', cost:0.35, entities:[] },
];

const STATUS_COLORS = { done:'var(--ok)', pending:'var(--warn)', error:'var(--err)', generating:'var(--cyan)' };
const CAT_ICONS = { image:'🖼', video:'🎬', audio:'🎵', '3d':'🧊', lipsync:'💋' };

// ─── AUTH ────────────────────────────────────────────
const authScreen = document.getElementById('auth');
const appEl = document.getElementById('app');
document.getElementById('a-go').onclick = () => {
  const u = document.getElementById('a-user').value.trim();
  if(!u){ document.getElementById('a-msg').textContent = 'Enter your email'; return; }
  state.user = u;
  authScreen.style.display = 'none';
  appEl.style.display = 'grid';
  document.getElementById('t-avatar').textContent = u[0].toUpperCase();
  init();
};
document.getElementById('a-key').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('a-go').click(); });
document.getElementById('a-user').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('a-key').focus(); });

// ─── INIT ───────────────────────────────────────────
function init(){
  state.shots = JSON.parse(JSON.stringify(DEMO_SHOTS));
  renderShots();
  setupRail();
  setupPrompt();
  setupInspector();
  setupGlog();
  setupShare();
  setupPipeline();
}

// ─── RENDER SHOTS ───────────────────────────────────
function renderShots(){
  const c = document.getElementById('shots');
  c.innerHTML = '';
  state.shots.forEach((s,i) => {
    const el = document.createElement('div');
    el.className = 'shot' + (s.id === state.selectedShot ? ' selected' : '');
    const gradients = [
      'linear-gradient(135deg,#1a1a3e,#0d0d1a)',
      'linear-gradient(135deg,#2a1528,#0d0d1a)',
      'linear-gradient(135deg,#0d1f2a,#0d0d1a)',
      'linear-gradient(135deg,#2a1a0d,#0d0d1a)',
      'linear-gradient(135deg,#1a2a1a,#0d0d1a)'
    ];
    el.innerHTML = `
      <div class="shot-thumb" style="background:${gradients[i%5]}">
        <span class="shot-status" style="background:${STATUS_COLORS[s.status]}"></span>
        <span class="shot-badge">${CAT_ICONS[s.cat]||''} #${i+1}</span>
        <span class="shot-model-badge">${s.model}</span>
      </div>
      <div class="shot-body">
        <div class="shot-title">${s.title}</div>
        <div class="shot-meta">
          <span>${s.res}</span>
          <span>${s.ar}</span>
          ${s.dur!=='—'?`<span>${s.dur}</span>`:''}
          <span>$${s.cost.toFixed(3)}</span>
        </div>
        ${s.entities.length?`<div class="shot-ents">${s.entities.map(e=>`<span class="shot-ent">@${e}</span>`).join('')}</div>`:''}
      </div>`;
    el.onclick = () => selectShot(s.id);
    c.appendChild(el);
  });
}

function selectShot(id){
  state.selectedShot = id;
  renderShots();
  openInspector(id);
  updatePipeline(id);
}

// ─── INSPECTOR ──────────────────────────────────────
function setupInspector(){
  document.getElementById('i-close').onclick = () => {
    document.getElementById('inspector').classList.remove('open');
    state.selectedShot = null;
    renderShots();
  };
  document.getElementById('i-steps').oninput = e => document.getElementById('i-steps-v').textContent = e.target.value;
  document.getElementById('i-cfg').oninput = e => document.getElementById('i-cfg-v').textContent = parseFloat(e.target.value).toFixed(1);

  // Chip selectors
  document.querySelectorAll('#inspector .chips').forEach(group => {
    group.querySelectorAll('.chip').forEach(chip => {
      chip.onclick = () => {
        group.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
        chip.classList.add('on');
      };
    });
  });

  document.getElementById('i-gen').onclick = () => generate();
  document.getElementById('i-comp').onclick = () => switchView('compare');
  document.getElementById('i-approve').onclick = () => {
    const s = state.shots.find(x=>x.id===state.selectedShot);
    if(s){ s.status='done'; renderShots(); updateDockStats(); }
  };
}

function openInspector(id){
  const s = state.shots.find(x=>x.id===id);
  if(!s) return;
  const insp = document.getElementById('inspector');
  insp.classList.add('open');
  document.getElementById('i-title').textContent = `Shot #${state.shots.indexOf(s)+1} — ${s.title}`;
  document.getElementById('i-prompt').value = s.prompt;
  document.getElementById('i-gen').textContent = `⚡ Generate — $${s.cost.toFixed(3)}`;

  // Set category chip
  document.querySelectorAll('#i-cats .chip').forEach(c => {
    c.classList.toggle('on', c.dataset.k === s.cat);
  });
}

// ─── GENERATION ─────────────────────────────────────
function generate(){
  if(state.generating) return;
  state.generating = true;
  const s = state.shots.find(x=>x.id===state.selectedShot);
  if(s) s.status = 'generating';
  renderShots();

  // Queue UI
  const dot = document.getElementById('q-dot');
  const label = document.getElementById('q-label');
  const fill = document.getElementById('q-fill');
  dot.style.display = 'block';
  label.textContent = `Generating ${s?s.title:''}…`;

  addLog('run','⟳',`Sending to ${s?s.model:'model'}…`);
  updatePipelineStep(2);

  let pct = 0;
  const iv = setInterval(()=>{
    pct += Math.random()*12;
    if(pct>=100){
      pct=100;
      clearInterval(iv);
      fill.style.width='100%';
      setTimeout(()=>{
        state.generating=false;
        if(s) s.status='done';
        dot.style.display='none';
        label.textContent='No active jobs';
        fill.style.width='0%';
        renderShots();
        updateDockStats();
        addLog('ok','✓',`${s?s.title:''} rendered`);
        state.sessionCost += s?s.cost:0;
        document.getElementById('d-cost').textContent = `Session: $${state.sessionCost.toFixed(2)}`;
        updatePipelineStep(3);
      },400);
    }
    fill.style.width=pct+'%';
  },200);
}

// ─── GLOG ───────────────────────────────────────────
function setupGlog(){
  document.getElementById('glog-h').onclick = () => document.getElementById('glog').classList.toggle('collapsed');
}
function addLog(type, icon, msg){
  const b = document.getElementById('glog-b');
  const d = document.createElement('div');
  d.className = 'gstep '+type;
  d.innerHTML = `<span class="gstep-i">${icon}</span><span>${msg}</span>`;
  b.appendChild(d);
  b.scrollTop = b.scrollHeight;
  if(type==='run'){
    document.getElementById('glog-dot').style.background='var(--warn)';
    document.getElementById('glog-lbl').textContent='Processing…';
  } else if(type==='ok'){
    document.getElementById('glog-dot').style.background='var(--ok)';
    document.getElementById('glog-lbl').textContent='Ready';
  }
}

// ─── RAIL ───────────────────────────────────────────
function setupRail(){
  document.querySelectorAll('.rail-btn[data-v]').forEach(btn => {
    btn.onclick = () => switchView(btn.dataset.v);
  });
  document.querySelectorAll('.rail-btn[data-a]').forEach(btn => {
    btn.onclick = () => {
      if(btn.dataset.a==='settings' || btn.dataset.a==='help' || btn.dataset.a==='script' || btn.dataset.a==='nodes' || btn.dataset.a==='sandbox'){
        const ap = document.getElementById('assets-panel');
        if(btn.dataset.a==='script'){
          // Toggle assets panel for now
          const show = ap.style.display === 'none';
          ap.style.display = show ? 'block' : 'none';
        }
      }
    };
  });
  // Assets button
  document.querySelector('.rail-btn[data-v="assets"]').onclick = () => {
    const ap = document.getElementById('assets-panel');
    const show = ap.style.display === 'none';
    ap.style.display = show ? 'block' : 'none';
    document.querySelectorAll('.rail-btn').forEach(b=>b.classList.remove('active'));
    if(show) document.querySelector('.rail-btn[data-v="assets"]').classList.add('active');
    else document.querySelector('.rail-btn[data-v="canvas"]').classList.add('active');
  };
  // Asset tabs
  document.querySelectorAll('.ap-tab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('.ap-tab').forEach(x=>x.classList.remove('on'));
      t.classList.add('on');
    };
  });
}

function switchView(v){
  state.view = v;
  document.querySelectorAll('.rail-btn[data-v]').forEach(b => b.classList.toggle('active', b.dataset.v===v));

  const shots = document.getElementById('shots');
  const comp = document.getElementById('comp-view');
  const pills = document.getElementById('pills');
  const pcard = document.getElementById('pcard');

  if(v==='compare'){
    shots.style.display='none';
    pills.style.display='none';
    pcard.style.display='none';
    comp.classList.add('open');
    renderComparison();
  } else if(v==='canvas'){
    shots.style.display='flex';
    pills.style.display='flex';
    pcard.style.display='block';
    comp.classList.remove('open');
  } else if(v==='timeline'){
    shots.style.display='flex';
    pills.style.display='none';
    pcard.style.display='none';
    comp.classList.remove('open');
  }
}

function renderComparison(){
  const comp = document.getElementById('comp-view');
  const models = ['Flux Pro','Kling 3.0','Wan 2.1','Veo 3','Minimax','Sora','Imagen 4','Seedance'];
  comp.innerHTML = models.map((m,i) => `
    <div class="comp-card">
      <div class="comp-thumb">Variation ${i+1}</div>
      <div class="comp-info">
        <span class="comp-model">${m}</span>
        <span class="comp-cost">$${(Math.random()*0.3+0.03).toFixed(3)}</span>
      </div>
    </div>`).join('');
}

// ─── PROMPT ─────────────────────────────────────────
function setupPrompt(){
  const txt = document.getElementById('p-txt');
  txt.addEventListener('input', () => {
    txt.style.height = 'auto';
    txt.style.height = Math.min(txt.scrollHeight, 120) + 'px';
    // Check for @mentions
    checkEntityMentions(txt.value);
  });

  // Mode buttons
  document.querySelectorAll('.p-mode-b').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.p-mode-b').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      state.mode = b.dataset.m;
    };
  });

  // Pills
  document.querySelectorAll('.pill').forEach(p => {
    p.onclick = () => {
      txt.value = p.dataset.p;
      txt.dispatchEvent(new Event('input'));
    };
  });

  // Send
  document.getElementById('p-send').onclick = () => {
    if(!txt.value.trim()) return;
    // Create a new shot from prompt
    const newShot = {
      id: 's'+(state.shots.length+1),
      title: txt.value.substring(0,40),
      prompt: txt.value,
      model: document.getElementById('p-model-lbl').textContent,
      cat: state.mode==='audio'?'audio':state.mode==='3d'?'3d':'image',
      status: 'pending',
      res: '1080p', dur: state.mode==='shot'||state.mode==='sandbox'?'5s':'—',
      ar: '16:9',
      cost: 0.065,
      entities: extractEntities(txt.value)
    };
    state.shots.push(newShot);
    renderShots();
    txt.value = '';
    txt.style.height = 'auto';
    updateDockStats();
    addLog('ok','✓',`Shot #${state.shots.length} created`);
  };

  // Enhance button
  document.querySelector('.p-tool[title="Enhance with AI"]').onclick = () => {
    if(!txt.value.trim()) return;
    txt.value = txt.value + ', cinematic lighting, 8K resolution, shallow depth of field, volumetric fog, film grain, anamorphic lens flare';
    addLog('ok','✦','Prompt enhanced');
  };
}

function extractEntities(text){
  const ents = [];
  const matches = text.match(/@\w+/g);
  if(matches) matches.forEach(m => ents.push(m.replace('@','')));
  return ents;
}

function checkEntityMentions(text){
  const ents = document.getElementById('p-ents');
  const found = extractEntities(text);
  if(found.length){
    ents.style.display='flex';
    ents.innerHTML = found.map(e=>`<span class="shot-ent">@${e}</span>`).join('');
  } else {
    ents.style.display='none';
  }
}

// ─── PIPELINE ───────────────────────────────────────
function setupPipeline(){
  updatePipelineStep(0);
}
function updatePipeline(id){
  const s = state.shots.find(x=>x.id===id);
  if(!s) return;
  const nodes = document.querySelectorAll('.pipe-node');
  // Update model label
  if(nodes[1]) nodes[1].innerHTML = `<span class="pipe-dot bg-accent"></span>${s.model}`;
}
function updatePipelineStep(step){
  document.querySelectorAll('.pipe-node').forEach((n,i)=>n.classList.toggle('active',i<=step));
}

// ─── SHARE ──────────────────────────────────────────
function setupShare(){
  document.getElementById('btn-share').onclick = () => {
    document.getElementById('modal-share').style.display='flex';
  };
}

// ─── DOCK STATS ─────────────────────────────────────
function updateDockStats(){
  const done = state.shots.filter(s=>s.status==='done').length;
  const pending = state.shots.filter(s=>s.status==='pending'||s.status==='generating').length;
  const stats = document.querySelector('.dock-stats');
  stats.innerHTML = `
    <span class="dock-stat"><span class="stat-dot bg-ok"></span>${done} approved</span>
    <span class="dock-stat"><span class="stat-dot bg-warn"></span>${pending} pending</span>`;
}

// ─── GLOBALS ────────────────────────────────────────
window.closeModal = (id) => document.getElementById(id).style.display='none';
window.copyShareLink = () => {
  const inp = document.getElementById('share-url');
  inp.select();
  navigator.clipboard.writeText(inp.value);
  addLog('ok','📋','Link copied');
};
window.addCollaborator = () => {
  const email = document.getElementById('collab-email').value.trim();
  if(!email) return;
  const list = document.getElementById('collab-list');
  const row = document.createElement('div');
  row.className='collab-row';
  row.innerHTML=`<span class="collab-avatar">${email[0].toUpperCase()}</span><span class="collab-name">${email}</span><span class="collab-role">Editor</span>`;
  list.appendChild(row);
  document.getElementById('collab-email').value='';
  addLog('ok','👤',`${email} added`);
};

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.onclick = e => { if(e.target===o) o.style.display='none'; };
});

})();
