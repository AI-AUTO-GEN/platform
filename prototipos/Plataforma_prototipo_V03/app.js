/* V03 — Interactions (Higgsfield × OpenArt Fusion) */

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
  // Sidebar active state
  document.querySelectorAll('.sb-item').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // Switch control panel
  document.querySelectorAll('.ctrl').forEach(c=>c.classList.remove('active'));
  const target = document.getElementById('ctrl-'+mode);
  if(target) target.classList.add('active');
  // Sync dock
  document.querySelectorAll('.dock-item').forEach(d=>{
    d.classList.toggle('active', d.getAttribute('onclick')?.includes(mode));
  });
}

function goDock(mode, dockBtn){
  // Dock active state
  document.querySelectorAll('.dock-item').forEach(d=>d.classList.remove('active'));
  dockBtn.classList.add('active');
  // Find matching sidebar item and trigger it
  const sbItems = document.querySelectorAll('.sb-item');
  sbItems.forEach(sb=>{
    if(sb.getAttribute('onclick')?.includes(mode)){
      sb.click();
    }
  });
}

// ── SHOT NAVIGATOR ──
function pickShot(i, btn){
  document.querySelectorAll('.shot-chip').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');
}

let shotCount = 5;
function addShot(){
  shotCount++;
  const strip = document.querySelector('.shot-strip');
  const addBtn = strip.querySelector('.shot-add');
  const chip = document.createElement('button');
  chip.className = 'shot-chip';
  chip.textContent = '#' + shotCount;
  chip.onclick = function(){ pickShot(shotCount-1, chip); };
  strip.insertBefore(chip, addBtn);
}

// ── MODEL SELECTOR ──
document.addEventListener('click', (e) => {
  // Close model dropdowns when clicking outside
  if(!e.target.closest('.model-card') && !e.target.closest('.model-dropdown')){
    document.querySelectorAll('.model-card.open').forEach(c=>c.classList.remove('open'));
  }
  // Model option selection
  if(e.target.classList.contains('model-opt')){
    const dd = e.target.closest('.model-dropdown');
    const card = dd.previousElementSibling;
    dd.querySelectorAll('.model-opt').forEach(o=>o.classList.remove('selected'));
    e.target.classList.add('selected');
    // Update card text
    const group = e.target.closest('.model-group');
    const provider = group.querySelector('.model-group-label').textContent;
    card.querySelector('.model-provider').textContent = provider;
    card.querySelector('.model-name').textContent = e.target.textContent;
    card.classList.remove('open');
  }
});

// ── @ ENTITY MENTIONS ──
function insertEntity(name){
  const ta = document.getElementById('prompt-text');
  const mention = '@' + name + ' ';
  ta.value += mention;
  ta.focus();
  // Toggle pill visual
  const pills = document.querySelectorAll('.pill-tag');
  pills.forEach(p=>{
    if(p.textContent === '@'+name) p.classList.toggle('inserted');
  });
}

// ── BATCH CONTROL ──
function batchChange(delta){
  const el = document.getElementById('batch-n');
  let n = parseInt(el.textContent) + delta;
  if(n<1) n=1; if(n>8) n=8;
  el.textContent = n;
  // Update CTA cost
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
  pill.className='pill-active';
  pill.textContent='Active';
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
