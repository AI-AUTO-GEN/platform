/* ═══════════════════════════════════════════
   V06 — RENDERFARM Definitive Edition
   Unified: Stitch + Weave + Higgsfield + OpenArt
   ═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // ── STATE ──
  const S = {
    shots: [
      { id:1, name:'Warehouse — Establishing', prompt:'Wide shot of an abandoned warehouse at night, rain pouring, neon reflections on wet concrete, cinematic Arri Alexa look', model:'flux-pro', res:'1080p', dur:'5s', ar:'16:9', status:'done', cost:.12 },
      { id:2, name:'Elena — Close-up Reveal', prompt:'Elena turns toward camera, warm backlight, shallow depth of field, rain droplets on face, emotion', model:'kling', res:'1080p', dur:'5s', ar:'16:9', status:'done', cost:.18 },
      { id:3, name:'Mike — Noir Silhouette', prompt:'Mike enters from darkness, noir silhouette, cigarette smoke rising, single overhead practical light', model:'flux-pro', res:'1080p', dur:'8s', ar:'16:9', status:'pending', cost:0 },
      { id:4, name:'Chase — Alley Sequence', prompt:'Handheld chase through narrow alley, wet ground reflections, adrenaline pacing, bokeh city lights behind', model:'minimax', res:'720p', dur:'8s', ar:'16:9', status:'error', cost:0 },
      { id:5, name:'City — Aerial Dusk', prompt:'Wide aerial drone shot, city at golden hour transitioning to dusk, establishing shot for Act 2 opening', model:'wan', res:'4k', dur:'10s', ar:'21:9', status:'pending', cost:0 },
    ],
    sel: null,
    model: 'flux-pro',
    modelIdx: 0,
    models: ['Flux Pro','Kling 2.0','Minimax','Wan 2.1','Runway Gen-4','Pika 2.2'],
    modelKeys: ['flux-pro','kling','minimax','wan','runway','pika'],
    gen: false,
    view: 'canvas',
    sessionCost: .48,
    totalCredits: 2.47,
  };

  const MNAME = k => ({
    'flux-pro':'Flux Pro','kling':'Kling 2.0','minimax':'Minimax',
    'wan':'Wan 2.1','runway':'Runway Gen-4','pika':'Pika 2.2'
  }[k] || k);

  const GRADS = [
    'linear-gradient(135deg,#1a1a2e,#2d1b4e,#0f0f1a)',
    'linear-gradient(135deg,#2e1a1a,#4e3b1b,#1a0f0f)',
    'linear-gradient(135deg,#0f1a1a,#1b2e4e,#1a1a0f)',
    'linear-gradient(135deg,#1a2e1a,#1b4e3b,#0f1a1a)',
    'linear-gradient(135deg,#2e2e1a,#4e1b3b,#1a0f1a)',
    'linear-gradient(135deg,#1a1a3e,#3d2b5e,#1f0f2a)',
  ];

  // ── AUTH ──
  $('a-go').onclick = () => {
    $('a-msg').textContent = '◈ Connecting…';
    $('a-msg').style.color = 'var(--warn)';
    setTimeout(() => { $('auth').style.display='none'; $('app').style.display='grid'; render(); }, 700);
  };

  // ── RENDER SHOTS ──
  function render() {
    const c = $('shots');
    c.innerHTML = '';
    S.shots.forEach((s,i) => {
      const st = s.status==='done'?'badge-ok':s.status==='pending'?'badge-warn':'badge-err';
      const sl = s.status==='done'?'✓ Done':s.status==='pending'?'◌ Queue':'✕ Error';
      const d = document.createElement('div');
      d.className = 'shot' + (S.sel===s.id?' sel':'');
      d.dataset.id = s.id;
      d.innerHTML = `<div class="shot-vis" style="background:${GRADS[i%GRADS.length]}"><span class="ph">▶</span><div class="shot-over"><span class="badge badge-idx">#${s.id}</span><span class="badge ${st}">${sl}</span></div></div><div class="shot-info"><div class="shot-name">${s.name}</div><div class="shot-det"><span>◈ ${MNAME(s.model)}</span><span>${s.res}</span><span>${s.dur}</span><span>${s.cost?'$'+s.cost.toFixed(2):'—'}</span></div></div>`;
      d.onclick = () => openInspector(s.id);
      c.appendChild(d);
    });
    updatePipeline();
    updateDock();
  }

  // ── INSPECTOR ──
  function openInspector(id) {
    S.sel = id;
    const s = S.shots.find(x=>x.id===id);
    if(!s) return;
    document.querySelectorAll('.shot').forEach(e=>e.classList.toggle('sel',+e.dataset.id===id));
    $('i-title').textContent = `Shot #${s.id} — ${s.name}`;
    $('i-prompt').value = s.prompt;
    setChips('i-models', s.model);
    setChips('i-res', s.res);
    setChips('i-dur', s.dur);
    setChips('i-ar', s.ar);
    $('p-txt').value = s.prompt;
    autoH();
    $('inspector').classList.add('open');
  }

  function setChips(containerId, activeKey) {
    document.querySelectorAll(`#${containerId} .chip`).forEach(c => {
      c.classList.toggle('on', c.dataset.k === activeKey);
    });
  }

  $('i-close').onclick = () => { $('inspector').classList.remove('open'); S.sel=null; document.querySelectorAll('.shot').forEach(e=>e.classList.remove('sel')); };

  // Chip selection in inspector
  $('i-body').addEventListener('click', e => {
    const ch = e.target.closest('.chip');
    if(!ch) return;
    const row = ch.closest('.chips');
    row.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));
    ch.classList.add('on');
  });

  // Sliders
  $('i-steps').oninput = () => $('i-steps-v').textContent = $('i-steps').value;
  $('i-cfg').oninput = () => $('i-cfg-v').textContent = parseFloat($('i-cfg').value).toFixed(1);

  // Inspector actions
  $('i-gen').onclick = () => { if(S.sel){ const s=S.shots.find(x=>x.id===S.sel); if(s){$('p-txt').value=s.prompt; autoH(); doGen();} }};
  $('i-dup').onclick = () => { if(S.sel){ const s=S.shots.find(x=>x.id===S.sel); if(s){ const n={...s,id:S.shots.length+1,name:s.name+' (v2)',status:'pending',cost:0}; S.shots.push(n); render(); }}};
  $('i-del').onclick = () => { if(S.sel){ S.shots=S.shots.filter(x=>x.id!==S.sel); $('inspector').classList.remove('open'); S.sel=null; render(); }};
  $('i-comp').onclick = () => switchView('compare');

  // ── PROMPT ──
  function autoH(){ const t=$('p-txt'); t.style.height='auto'; t.style.height=Math.min(t.scrollHeight,110)+'px'; }
  $('p-txt').oninput = () => {
    autoH();
    const m = $('p-txt').value.match(/@\w+/g);
    const ents = $('p-ents');
    if(m&&m.length){ ents.style.display='flex'; ents.innerHTML=m.map(x=>`<span class="pent in">${x}</span>`).join(''); }
    else { ents.style.display='none'; }
  };

  $('p-send').onclick = () => doGen();
  $('p-txt').onkeydown = e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault(); doGen();} };

  // Mode toggle
  document.querySelectorAll('.p-mode-b').forEach(b => b.onclick = () => {
    document.querySelectorAll('.p-mode-b').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
  });

  // Model cycle
  $('p-model').onclick = () => {
    S.modelIdx = (S.modelIdx+1)%S.models.length;
    S.model = S.modelKeys[S.modelIdx];
    $('p-model-lbl').textContent = S.models[S.modelIdx];
  };

  // Pills
  $('pills').onclick = e => { const p=e.target.closest('.pill'); if(p){$('p-txt').value=p.dataset.p; $('p-txt').focus(); autoH();} };

  // ── GENERATION ──
  function doGen() {
    const txt = $('p-txt').value.trim();
    if(!txt||S.gen) return;
    S.gen = true;

    // Gen Log
    const dot=$('glog-dot'), lbl=$('glog-lbl'), body=$('glog-b');
    dot.classList.add('busy'); lbl.textContent='Generating…';
    body.innerHTML='';

    // Queue dock
    $('q-dot').style.display='block';
    $('q-label').textContent='Rendering 1 job…';
    $('q-label').style.color='var(--warn)';

    // Pipeline update
    updatePipelineStep(2);

    const steps = [
      {t:'Prompt analyzed & tokenized', d:250},
      {t:'Style context loaded (Noir·Rain)', d:700},
      {t:'Character refs: @Mike, @Elena', d:1200},
      {t:`Inference via ${S.models[S.modelIdx]}…`, d:1700, run:true},
    ];

    steps.forEach(s => setTimeout(()=>{
      const el=document.createElement('div');
      el.className='gstep '+(s.run?'run':'ok');
      el.innerHTML=`<span class="gstep-i">${s.run?'↻':'✓'}</span><span>${s.t}</span>`;
      body.appendChild(el); body.scrollTop=9999;
    }, s.d));

    // Progress
    setTimeout(()=>{
      const bar=document.createElement('div'); bar.className='gbar';
      bar.innerHTML='<div class="gbar-f" style="width:0%"></div>';
      body.appendChild(bar);
      let pct=0; const fill=bar.querySelector('.gbar-f');
      const iv=setInterval(()=>{
        pct+=Math.random()*14+4;
        if(pct>=100){pct=100;clearInterval(iv);finishGen(txt);}
        fill.style.width=pct+'%';
        $('q-fill').style.width=pct+'%';
      },180);
    },1900);
  }

  function finishGen(txt){
    const body=$('glog-b');
    const r=body.querySelector('.gstep.run');
    if(r){r.className='gstep ok';r.querySelector('.gstep-i').textContent='✓';}
    const f=document.createElement('div');f.className='gstep ok';
    f.innerHTML='<span class="gstep-i" style="color:var(--ok)">✓</span><span style="color:var(--ok)">Complete — ready for review</span>';
    body.appendChild(f);body.scrollTop=9999;

    $('glog-dot').classList.remove('busy');$('glog-lbl').textContent='Complete';
    S.gen=false;

    // New shot
    const cost=+(Math.random()*.15+.08).toFixed(2);
    S.sessionCost+=cost; S.totalCredits-=cost;
    const words=txt.split(' ').slice(0,3).join(' ');
    S.shots.push({id:S.shots.length+1,name:words+'…',prompt:txt,model:S.model,res:'1080p',dur:'5s',ar:'16:9',status:'done',cost});
    render();
    $('p-txt').value=''; autoH();

    // Dock
    $('q-dot').style.display='none';
    $('q-label').textContent='No active jobs';$('q-label').style.color='';
    $('q-fill').style.width='0%';
    $('d-cost').textContent='Session: $'+S.sessionCost.toFixed(2);
    $('t-credits').textContent='$'+S.totalCredits.toFixed(2);

    updatePipelineStep(3);
    setTimeout(()=>{$('glog-lbl').textContent='Ready';updatePipelineStep(0);},3000);
  }

  // ── PIPELINE ──
  function updatePipeline(){
    const done=S.shots.filter(s=>s.status==='done').length;
    const total=S.shots.length;
    if(done===total) updatePipelineStep(3);
    else updatePipelineStep(0);
  }
  function updatePipelineStep(idx){
    document.querySelectorAll('.pipe-node').forEach((n,i)=>n.classList.toggle('active',i===idx));
  }

  // ── DOCK ──
  function updateDock(){
    const pending=S.shots.filter(s=>s.status==='pending').length;
    if(pending>0&&!S.gen){$('q-label').textContent=pending+' queued'; $('q-dot').style.display='block';}
    $('d-cost').textContent='Session: $'+S.sessionCost.toFixed(2);
    $('t-credits').textContent='$'+S.totalCredits.toFixed(2);
  }
  document.querySelectorAll('.dock-tab').forEach(t=>t.onclick=()=>{
    document.querySelectorAll('.dock-tab').forEach(x=>x.classList.remove('on'));t.classList.add('on');
  });

  // ── RAIL NAV ──
  document.querySelectorAll('.rail-btn[data-v]').forEach(b=>b.onclick=()=>switchView(b.dataset.v));

  function switchView(v){
    S.view=v;
    document.querySelectorAll('.rail-btn[data-v]').forEach(b=>b.classList.toggle('active',b.dataset.v===v));
    $('comp-view').classList.toggle('vis',v==='compare');
    $('shots').style.display=v==='canvas'?'flex':'none';
    $('pills').style.display=v==='canvas'?'flex':'none';
    $('pcard').style.display=v==='canvas'?'block':'none';
    if(v==='compare') renderCompare();
  }

  // ── COMPARISON VIEW ──
  function renderCompare(){
    const cv=$('comp-view');cv.innerHTML='';
    S.shots.forEach((s,i)=>{
      const c=document.createElement('div');c.className='comp-c';
      c.innerHTML=`<div class="comp-v" style="background:${GRADS[i%GRADS.length]}"><span class="ph">▶</span></div><div class="comp-f"><div><div class="comp-n">${MNAME(s.model)}</div><div class="comp-cost">${s.cost?'$'+s.cost.toFixed(2):'—'}</div></div><div class="comp-btns"><button class="comp-btn" title="Select">✓</button><button class="comp-btn" title="Regenerate">↻</button></div></div>`;
      c.onclick=()=>{cv.querySelectorAll('.comp-c').forEach(x=>x.classList.remove('pick'));c.classList.add('pick');};
      cv.appendChild(c);
    });
  }

  // ── GLOG TOGGLE ──
  $('glog-h').onclick = () => $('glog').classList.toggle('min');

  // ── KEYBOARD ──
  document.onkeydown = e => {
    if(e.key==='Escape'){$('inspector').classList.remove('open');S.sel=null;document.querySelectorAll('.shot').forEach(x=>x.classList.remove('sel'));}
    if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();$('p-txt').focus();}
  };
});
