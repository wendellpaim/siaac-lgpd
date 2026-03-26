// ═══════════════════════════════════════════════════
//  SIAAC-LGPD v2.0 — Bootstrap & Navegação
// ═══════════════════════════════════════════════════

// ── Bootstrap ─────────────────────────────────────────
async function boot() {
  if (!AUTH_TOKEN) { showAuth(); return; }
  try {
    currentUser = await api('GET', 'auth/me/');
    launchApp();
  } catch {
    AUTH_TOKEN = '';
    localStorage.removeItem('siaac_token');
    showAuth();
  }
}

function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
}

async function launchApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  const nome = currentUser.nome || currentUser.nome_completo || currentUser.email;
  const ini = nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  document.getElementById('u-av').textContent = ini;
  document.getElementById('u-name').textContent = nome;
  document.getElementById('u-email').textContent = currentUser.email;
  buildEvalSteps();
  await loadAvaliacoes();
  renderDashboard();
  updateDraftBanner();
}

// ── Navegação ─────────────────────────────────────────
function navTo(page) {
  // Se questionário ativo (step-2 visível), salva rascunho antes de sair
  const step2 = document.getElementById('step-2');
  const questionarioAtivo = step2 && step2.style.display !== 'none' && evalQuestions.length > 0;
  if (questionarioAtivo && page !== 'nova') {
    saveDraft();
  }

  // Ativa a página correta
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  // Ações por página
  if (page === 'historico') renderHistorico();
  if (page === 'perfil') renderPerfil();
  if (page === 'dashboard') { renderDashboard(); updateDraftBanner(); }
  if (page === 'nova') {
    // Só reinicia se não há questionário ativo nem rascunho pendente
    if (!questionarioAtivo) initNova();
    else {
      // Volta para o step que estava ativo — não reseta nada
      showEvalStep(2); updateEvalSteps(1);
    }
  }
}

// ── Avaliações (API) ──────────────────────────────────
async function loadAvaliacoes() {
  try { avaliacoes = await api('GET', 'avaliacoes/'); }
  catch { avaliacoes = []; }
}
