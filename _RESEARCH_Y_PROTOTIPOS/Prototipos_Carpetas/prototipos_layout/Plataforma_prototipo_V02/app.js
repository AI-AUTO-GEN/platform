/* V02 — Interactions */
function doLogin(){
  const e=document.getElementById('auth-email').value.trim();
  if(!e){document.getElementById('auth-msg').textContent='Enter an email';return}
  document.getElementById('auth-msg').textContent='✓ Welcome';
  document.getElementById('uid').textContent=e;
  setTimeout(()=>{document.getElementById('auth-screen').style.display='none';document.getElementById('app').style.display='flex'},400);
}
function doLogout(){document.getElementById('app').style.display='none';document.getElementById('auth-screen').style.display='flex';document.getElementById('auth-msg').textContent=''}

function go(id,btn){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.topnav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('v-'+id).classList.add('active');
  btn.classList.add('active');
}

function subTab(btn){document.querySelectorAll('.sub-tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active')}
function selAsset(el){document.querySelectorAll('.asset-thumb').forEach(t=>t.classList.remove('sel'));el.classList.add('sel')}
function pickProj(el){document.querySelectorAll('.proj').forEach(p=>{p.classList.remove('active-proj');p.querySelector('.pill')?.remove()});el.classList.add('active-proj');const s=document.createElement('span');s.className='pill pill-active';s.textContent='Active';el.appendChild(s)}

function pickShot(i,btn){
  document.querySelectorAll('.rail-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelector('.shot-num').textContent='#'+(i+1);
}
function addShot(btn){
  const n=document.querySelectorAll('.rail-btn:not(.rail-add)').length+1;
  const b=document.createElement('button');
  b.className='rail-btn';b.textContent='#'+n;b.onclick=function(){pickShot(n-1,b)};
  btn.parentElement.insertBefore(b,btn);
}

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('auth-email').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
});
