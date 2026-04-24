/* RENDERFARM V9 — Prototype Interactions */

function doLogin() {
  const email = document.getElementById('auth-email').value.trim();
  if (!email) { document.getElementById('auth-msg').textContent = 'Enter an email'; return; }
  document.getElementById('auth-msg').textContent = '✓ Welcome';
  document.getElementById('user-email').textContent = email;
  setTimeout(() => {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = 'flex';
  }, 400);
}

function doLogout() {
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('auth-msg').textContent = '';
}

function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
  btn.classList.add('active');
}

function switchEntityType(type, btn) {
  document.querySelectorAll('.etab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}

function selectEntity(el) {
  document.querySelectorAll('.entity-thumb').forEach(t => t.classList.remove('selected'));
  el.classList.add('selected');
}

function selectShot(idx, btn) {
  document.querySelectorAll('.shot-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelector('.shot-badge').textContent = '#' + (idx + 1);
}

// Allow Enter key on auth
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('auth-email').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});
