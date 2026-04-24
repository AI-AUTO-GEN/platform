/* V04 — Weave Pipeline Interactions */

// ── AUTH ──
function doLogin(){
  const e=document.getElementById('auth-email').value.trim();
  if(!e){document.getElementById('auth-msg').textContent='Enter an email';return}
  document.getElementById('auth-msg').textContent='✓ Welcome';
  document.getElementById('uid').textContent=e;
  setTimeout(()=>{
    document.getElementById('auth-screen').style.display='none';
    document.getElementById('app').style.display='grid';
  },350);
}
function doLogout(){
  document.getElementById('app').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  document.getElementById('auth-msg').textContent='';
}

// ── NAVIGATION ──
function goMode(mode, btn){
  document.querySelectorAll('.sb-item').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.ctrl').forEach(c=>c.classList.remove('active'));
  const target = document.getElementById('ctrl-'+mode);
  if(target) target.classList.add('active');
  document.querySelectorAll('.dock-item').forEach(d=>{
    d.classList.toggle('active', d.getAttribute('onclick')?.includes(mode));
  });
}
function goDock(mode, dockBtn){
  document.querySelectorAll('.dock-item').forEach(d=>d.classList.remove('active'));
  dockBtn.classList.add('active');
  document.querySelectorAll('.sb-item').forEach(sb=>{
    if(sb.getAttribute('onclick')?.includes(mode)) sb.click();
  });
}

// ── COLLAPSIBLE SECTIONS (NEW V04 — Weave pattern) ──
function toggleSection(header){
  const expanded = header.getAttribute('aria-expanded') === 'true';
  header.setAttribute('aria-expanded', !expanded);
}

// ── SHOT NAVIGATOR ──
function pickShot(i, btn){
  document.querySelectorAll('.shot-chip').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');
  // Update pipeline breadcrumb based on shot
  updatePipeline(i);
}
let shotCount = 5;
function addShot(){
  shotCount++;
  const strip = document.getElementById('shot-strip');
  const addBtn = strip.querySelector('.shot-add');
  const chip = document.createElement('button');
  chip.className = 'shot-chip';
  chip.innerHTML = '#' + shotCount + '<span class="status-dot pending"></span>';
  chip.onclick = function(){ pickShot(shotCount-1, chip); };
  strip.insertBefore(chip, addBtn);
}

// ── PIPELINE BREADCRUMB (NEW V04) ──
const pipelineData = [
  {prompt:'Warehouse entry', model:'Flux Pro', params:'1080p · 8s'},
  {prompt:'Rain close-up', model:'Kling 3.0', params:'4K · 4s'},
  {prompt:'Elena reveal', model:'Flux Pro', params:'1080p · 8s'},
  {prompt:'Chase sequence', model:'Gen-3 Alpha', params:'1080p · 16s'},
  {prompt:'Rooftop finale', model:'Flux Dev', params:'720p · 8s'},
];
function updatePipeline(i){
  const d = pipelineData[i] || pipelineData[0];
  const steps = document.querySelectorAll('.pipe-step');
  if(steps[0]) steps[0].innerHTML = '<span class="pipe-dot"></span>' + (d.prompt.length>16? d.prompt.substring(0,16)+'…' : d.prompt);
  if(steps[1]) steps[1].innerHTML = '<span class="pipe-dot"></span>' + d.model;
  if(steps[2]) steps[2].innerHTML = '<span class="pipe-dot"></span>' + d.params;
}

// ── MODEL SELECTOR ──
document.addEventListener('click', (e) => {
  if(!e.target.closest('.model-card') && !e.target.closest('.model-dropdown')){
    document.querySelectorAll('.model-card.open').forEach(c=>c.classList.remove('open'));
  }
  if(e.target.classList.contains('model-opt')){
    const dd = e.target.closest('.model-dropdown');
    const card = dd.previousElementSibling;
    dd.querySelectorAll('.model-opt').forEach(o=>o.classList.remove('selected'));
    e.target.classList.add('selected');
    const group = e.target.closest('.model-group');
    const provider = group.querySelector('.model-group-label').textContent;
    card.querySelector('.model-provider').textContent = provider;
    card.querySelector('.model-name').textContent = e.target.textContent;
    card.classList.remove('open');
    // Update pipeline breadcrumb model step
    const modelStep = document.querySelectorAll('.pipe-step')[1];
    if(modelStep) modelStep.innerHTML = '<span class="pipe-dot"></span>' + e.target.textContent;
  }
});

// ── CANVAS VIEW SWITCHING (NEW V04) ──
function setView(view, btn){
  document.querySelectorAll('.tb-pill').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  const viewport = document.getElementById('render-viewport');
  const grid = document.getElementById('comparison-grid');
  if(view === 'compare' || view === 'grid'){
    viewport.style.display = 'none';
    grid.classList.add('visible');
    grid.className = 'comparison-grid visible ' + (view === 'grid' ? 'cols-4' : 'cols-2');
  } else {
    viewport.style.display = 'flex';
    grid.classList.remove('visible');
  }
}

// ── COMPARISON GRID (NEW V04) ──
function selectComp(card){
  document.querySelectorAll('.comp-card').forEach(c=>c.classList.remove('selected'));
  card.classList.add('selected');
}

// ── GENERATE (NEW V04 — with queue) ──
function doGenerate(){
  const btn = document.getElementById('btn-generate');
  const queue = document.getElementById('dock-queue');
  const fill = document.getElementById('q-fill');
  const label = document.getElementById('q-label');
  
  btn.textContent = '⏳ Generating...';
  btn.style.opacity = '.6';
  btn.style.pointerEvents = 'none';
  queue.style.display = 'flex';
  
  let progress = 0;
  const interval = setInterval(()=>{
    progress += Math.random() * 8;
    if(progress >= 100){
      progress = 100;
      clearInterval(interval);
      btn.textContent = '⚡ Generate — 96 credits';
      btn.style.opacity = '1';
      btn.style.pointerEvents = '';
      label.textContent = 'Done!';
      label.style.color = '#4ecb71';
      setTimeout(()=>{ queue.style.display='none'; label.style.color=''; }, 2000);
      // Switch to compare view
      const compBtn = document.querySelectorAll('.tb-pill')[1];
      if(compBtn) setView('compare', compBtn);
    }
    fill.style.width = progress + '%';
    label.textContent = Math.round(progress) + '%';
  }, 200);
}

// ── OUTPUT CHIPS (clickable toggle) ──
document.addEventListener('click', (e) => {
  if(e.target.classList.contains('output-chip')){
    const row = e.target.closest('.output-row');
    row.querySelectorAll('.output-chip').forEach(c=>c.classList.remove('active'));
    e.target.classList.add('active');
  }
});

// ── @ ENTITY MENTIONS ──
function insertEntity(name){
  const ta = document.getElementById('prompt-text');
  ta.value += '@' + name + ' ';
  ta.focus();
  document.querySelectorAll('.pill-tag').forEach(p=>{
    if(p.textContent === '@'+name) p.classList.toggle('inserted');
  });
}

// ── BATCH CONTROL ──
function batchChange(delta){
  const el = document.getElementById('batch-n');
  let n = parseInt(el.textContent) + delta;
  if(n<1) n=1; if(n>8) n=8;
  el.textContent = n;
  document.getElementById('btn-generate').textContent = '⚡ Generate — ' + (n*48) + ' credits';
}

// ── PROJECTS ──
function pickProj(el){
  document.querySelectorAll('.proj').forEach(p=>{
    p.classList.remove('active-proj');
    const pill = p.querySelector('.pill-active');
    if(pill) pill.remove();
  });
  el.classList.add('active-proj');
  const pill = document.createElement('span');
  pill.className='pill-active'; pill.textContent='Active';
  el.appendChild(pill);
}

// ── ASSETS ──
function selAsset(el){
  el.closest('.asset-list-panel').querySelectorAll('.asset-row').forEach(r=>r.classList.remove('sel'));
  el.classList.add('sel');
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('auth-email').addEventListener('keydown', e=>{
    if(e.key==='Enter') doLogin();
  });
});
