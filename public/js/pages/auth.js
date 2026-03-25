// ═══════════════════════════════════════════════════
//  SIAAC-LGPD v2.0 — Autenticação (Login / Registro)
// ═══════════════════════════════════════════════════

function switchAuthTab(t) {
  document.getElementById('tab-login').classList.toggle('active', t === 'login');
  document.getElementById('tab-register').classList.toggle('active', t === 'register');
  document.getElementById('form-login').style.display = t === 'login' ? 'block' : 'none';
  document.getElementById('form-register').style.display = t === 'register' ? 'block' : 'none';
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-senha').value;
  const err = document.getElementById('login-err');
  if (!email || !password) { err.innerHTML = '<div class="err">Preencha e-mail e senha.</div>'; return; }
  try {
    const data = await api('POST', 'auth/login/', { email, password });
    AUTH_TOKEN = data.token;
    localStorage.setItem('siaac_token', AUTH_TOKEN);
    currentUser = data.user;
    launchApp();
  } catch (e) {
    err.innerHTML = `<div class="err">${e.data?.error || 'E-mail ou senha incorretos.'}</div>`;
  }
}

async function doRegister() {
  const nome = document.getElementById('reg-nome').value.trim();
  const sobrenome = document.getElementById('reg-sobrenome').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const senha = document.getElementById('reg-senha').value;
  const senha2 = document.getElementById('reg-senha2').value;
  const cargo = document.getElementById('reg-cargo').value;
  const empresa = document.getElementById('reg-empresa').value.trim();
  const err = document.getElementById('reg-err');
  if (!nome || !email || !senha) { err.innerHTML = '<div class="err">Preencha os campos obrigatórios.</div>'; return; }
  if (senha !== senha2) { err.innerHTML = '<div class="err">As senhas não coincidem.</div>'; return; }
  try {
    const data = await api('POST', 'auth/register/', { nome, sobrenome, email, password: senha, cargo, empresa });
    AUTH_TOKEN = data.token;
    localStorage.setItem('siaac_token', AUTH_TOKEN);
    currentUser = data.user;
    launchApp();
  } catch (e) {
    const msg = Object.values(e.data || {}).flat().join(' ') || 'Erro ao criar conta.';
    err.innerHTML = `<div class="err">${msg}</div>`;
  }
}

async function doLogout() {
  try { await api('POST', 'auth/logout/'); } catch {}
  AUTH_TOKEN = '';
  localStorage.removeItem('siaac_token');
  currentUser = null;
  avaliacoes = [];
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}
