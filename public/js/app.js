// ═══════════════════════════════════════════════════
//  SIAAC-LGPD v2.0 — Frontend SPA
//  Consome API REST Django — sem API key no browser
// ═══════════════════════════════════════════════════

// ── API Helper ──────────────────────────────────────
const CSRF = document.querySelector('meta[name="csrf-token"]')?.content || '';
let AUTH_TOKEN = localStorage.getItem('siaac_token') || '';

async function api(method, path, data = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': CSRF,
    },
  };
  if (AUTH_TOKEN) opts.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  if (data) opts.body = JSON.stringify(data);
  const resp = await fetch(`/api/${path}`, opts);
  if (resp.status === 204) return null;
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw Object.assign(new Error(json.error || 'Erro na API'), { status: resp.status, data: json });
  return json;
}

// ── Estado global ────────────────────────────────────
let currentUser = null;
let avaliacoes = [];
let cogLevel = null, evalQuestions = [], evalAnswers = {}, evalSkipped = {}, evalFromAI = false;

const LKRL = ['Não implementado', 'Iniciado', 'Parcial', 'Avançado', 'Implementado'];
const CAT_META = {
  'base-legal': { lbl: 'Base Legal', cls: 'c0' },
  'direitos': { lbl: 'Direitos do Titular', cls: 'c1' },
  'segurança': { lbl: 'Segurança', cls: 'c2' },
  'compartilhamento': { lbl: 'Compartilhamento', cls: 'c3' },
  'incidentes': { lbl: 'Incidentes', cls: 'c4' },
  'governança': { lbl: 'Governança e DPO', cls: 'c5' },
};
const CATS = {
  'base-legal': 'Base Legal', 'direitos': 'Direitos do Titular',
  'segurança': 'Segurança da Informação', 'compartilhamento': 'Compartilhamento',
  'incidentes': 'Gestão de Incidentes', 'governança': 'Governança e DPO',
};

// ── Auth ─────────────────────────────────────────────
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
    const data = await api('POST', 'auth/register/', { first_name: nome, last_name: sobrenome, email, password: senha, cargo, empresa });
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
  const nome = currentUser.nome_completo || currentUser.email;
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

// ── Dashboard ─────────────────────────────────────────
function getNivelInfo(i) {
  if (i <= 20) return { nome: 'Inicial', cls: 'lvl-i' };
  if (i <= 40) return { nome: 'Básico', cls: 'lvl-b' };
  if (i <= 60) return { nome: 'Intermediário', cls: 'lvl-m' };
  if (i <= 80) return { nome: 'Gerenciado', cls: 'lvl-g' };
  return { nome: 'Otimizado', cls: 'lvl-o' };
}
function barColor(v) { return v >= 60 ? '#1a5c3a' : v >= 40 ? '#e67e22' : '#c0392b'; }
function levelColorCls(i) { if (i <= 20) return 'mv-r'; if (i <= 60) return 'mv-a'; if (i <= 80) return 'mv-b'; return 'mv-g'; }

function renderDashboard() {
  document.getElementById('dash-greeting').textContent = 'Olá, ' + (currentUser?.nome_completo?.split(' ')[0] || '') + ' 👋';
  const ult = avaliacoes[0];
  const med = avaliacoes.length ? Math.round(avaliacoes.reduce((s, a) => s + a.indice, 0) / avaliacoes.length) : 0;
  const best = avaliacoes.length ? Math.max(...avaliacoes.map(a => a.indice)) : 0;
  document.getElementById('dash-metrics').innerHTML = `
    <div class="met"><div class="ml">Avaliações</div><div class="mv mv-b">${avaliacoes.length}</div></div>
    <div class="met"><div class="ml">Índice mais recente</div><div class="mv ${ult ? levelColorCls(ult.indice) : ''}">${ult ? ult.indice + '%' : '—'}</div></div>
    <div class="met"><div class="ml">Média</div><div class="mv ${med ? levelColorCls(med) : ''}">${med ? med + '%' : '—'}</div></div>
    <div class="met"><div class="ml">Melhor resultado</div><div class="mv mv-g">${best ? best + '%' : '—'}</div></div>`;
  const el = document.getElementById('dash-recent');
  const rec = avaliacoes.slice(0, 3);
  el.innerHTML = rec.length
    ? rec.map(av => hcardHTML(av, true)).join('')
    : '<div style="text-align:center;padding:24px;color:var(--hint);font-size:13px">Nenhuma avaliação ainda. <a href="#" onclick="navTo(\'nova\');return false" style="color:var(--brand)">Iniciar agora →</a></div>';
}

function hcardHTML(av) {
  const ni = getNivelInfo(av.indice);
  const dt = new Date(av.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  return `<div class="hcard" onclick="openModal(${av.id})">
    <div class="hh"><div><div class="hemp">${av.empresa || 'Empresa'}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:2px">${av.setor || ''} · ${av.porte || ''}</div></div>
    <div class="hdate">${dt}</div></div>
    <div class="hsr"><div class="hscore" style="color:${barColor(av.indice)}">${av.indice}%</div>
    <span class="hlbadge ${ni.cls}">${ni.nome}</span>
    <div class="hbar" style="margin-left:8px"><div class="hbarf" style="width:${av.indice}%;background:${barColor(av.indice)}"></div></div></div>
  </div>`;
}

// ── Histórico ─────────────────────────────────────────
function renderHistorico() {
  let avs = [...avaliacoes];
  const fNivel = document.getElementById('hf-nivel')?.value || '';
  const fOrder = document.getElementById('hf-order')?.value || 'desc';
  if (fNivel) avs = avs.filter(a => getNivelInfo(a.indice).nome === fNivel);
  if (fOrder === 'asc') avs.sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));
  else if (fOrder === 'sd') avs.sort((a, b) => b.indice - a.indice);
  else if (fOrder === 'sa') avs.sort((a, b) => a.indice - b.indice);
  const hc = document.getElementById('hcount');
  if (hc) hc.textContent = `${avs.length} avaliação${avs.length !== 1 ? 'ões' : ''}`;
  const el = document.getElementById('hist-list');
  el.innerHTML = avs.length ? avs.map(av => hcardHTML(av)).join('') : '<div class="he"><p>Nenhuma avaliação encontrada.</p><button class="btn bp" onclick="navTo(\'nova\')" style="margin-top:12px">+ Nova avaliação</button></div>';
}

// ── Modal de detalhe ──────────────────────────────────
async function openModal(avId) {
  document.getElementById('modal-content').innerHTML = '<div style="text-align:center;padding:32px"><div class="spin"></div></div>';
  document.getElementById('modal-detail').classList.add('open');
  try {
    const av = await api('GET', `avaliacoes/${avId}/`);
    renderModal(av);
  } catch {
    document.getElementById('modal-content').innerHTML = '<p style="color:var(--danger)">Erro ao carregar avaliação.</p>';
  }
}

function renderModal(av) {
  const ni = getNivelInfo(av.indice);
  const dt = new Date(av.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const pi = { alta: 'ph2', media: 'pm', baixa: 'pl' }, pl = { alta: 'A', media: 'M', baixa: 'B' };
  const likerColor = ['var(--danger)', 'var(--warn)', '#c0a000', 'var(--info)', 'var(--brand)'];

  document.getElementById('modal-content').innerHTML = `
    <div style="margin-bottom:20px">
      <div style="font-size:18px;font-weight:600;margin-bottom:4px">${av.empresa}</div>
      <div style="font-size:13px;color:var(--muted)">${av.setor} · ${av.porte} · ${dt}</div>
    </div>
    <div style="display:flex;align-items:center;gap:12px;padding:18px;background:var(--s2);border-radius:var(--r);margin-bottom:20px">
      <div style="font-size:48px;font-weight:600;color:${barColor(av.indice)};letter-spacing:-2px">${av.indice}%</div>
      <div><span class="hlbadge ${ni.cls}" style="font-size:13px;padding:4px 12px">${ni.nome}</span>
      <div style="font-size:11px;color:var(--muted);margin-top:6px">Fórmula: (Σ valor×peso / Σpeso) × 25</div></div>
    </div>
    <div style="font-weight:600;font-size:13px;margin-bottom:10px">Conformidade por área</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
      ${Object.entries(av.area_scores || {}).map(([k, v]) => `
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:140px;font-size:12px;color:var(--muted);flex-shrink:0">${CATS[k] || k}</div>
          <div style="flex:1;height:6px;background:var(--s2);border-radius:3px;overflow:hidden">
            <div style="width:${v}%;height:100%;background:${barColor(v)};border-radius:3px"></div></div>
          <div style="font-size:12px;font-family:'DM Mono',monospace;width:34px;text-align:right;color:${barColor(v)}">${v}%</div>
        </div>`).join('')}
    </div>
    ${av.diagnostico ? `<div class="rbox"><h3>📝 Diagnóstico</h3><p>${av.diagnostico}</p></div>` : ''}
    ${(av.recomendacoes || []).length ? `
    <div class="rbox">
      <h3 style="margin-bottom:4px">🎯 Recomendações</h3>
      <p style="font-size:11px;color:var(--hint);margin-bottom:14px">Marque como concluída e ajuste o prazo. Alterações salvas automaticamente.</p>
      <div id="rec-list-${av.id}">
        ${av.recomendacoes.map((r, ri) => `
          <div id="rec-item-${r.id}" style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:0.5px solid var(--border);${ri === av.recomendacoes.length - 1 ? 'border-bottom:none' : ''}">
            <input type="checkbox" ${r.concluida ? 'checked' : ''} style="width:17px;height:17px;accent-color:var(--brand);cursor:pointer;flex-shrink:0;margin-top:2px"
              onchange="toggleRec(${r.id}, this.checked)"/>
            <div class="rprio ${pi[r.prioridade] || 'pm'}" style="flex-shrink:0;margin-top:1px">${pl[r.prioridade] || 'M'}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:500;${r.concluida ? 'text-decoration:line-through;opacity:.5' : ''};line-height:1.5">${r.acao}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap">
                <span style="font-size:11px;color:var(--hint)">Prazo:</span>
                <input type="number" min="1" max="999" value="${(r.prazo_dias || '').toString().replace(/\D/g, '')}" placeholder="—"
                  style="font-size:12px;padding:3px 8px;border-radius:6px;border:0.5px solid var(--border2);background:var(--s2);color:var(--text);width:64px;font-family:'DM Mono',monospace;text-align:center;transition:background .15s,border-color .15s;-moz-appearance:textfield;appearance:textfield"
                  onfocus="this.style.background='#fff';this.style.borderColor='var(--brand)'"
                  onblur="this.style.background='var(--s2)';this.style.borderColor='var(--border2)';atualizarPrazo(${r.id}, this.value)"
                  oninput="atualizarPrazo(${r.id}, this.value)"/>
                <span style="font-size:11px;color:var(--muted)">dias</span>
                ${r.concluida ? '<span style="font-size:11px;font-weight:500;color:var(--brand)">✓ Concluída</span>' : ''}
              </div>
            </div>
          </div>`).join('')}
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:0.5px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <span id="rec-progress-${av.id}" style="font-size:12px;color:var(--muted)">${av.recomendacoes.filter(r => r.concluida).length} de ${av.recomendacoes.length} concluídas</span>
        <div style="flex:1;max-width:140px;height:4px;background:var(--s2);border-radius:2px;overflow:hidden;margin:0 12px">
          <div style="width:${Math.round((av.recomendacoes.filter(r => r.concluida).length / av.recomendacoes.length) * 100)}%;height:100%;background:var(--brand);border-radius:2px;transition:width .4s"></div>
        </div>
      </div>
    </div>` : ''}
    ${av.plano_acao ? `<div class="rbox"><h3>🗺 Plano de Ação</h3><p>${av.plano_acao}</p></div>` : ''}
    ${(av.historico_qa || []).length ? `
    <div class="rbox">
      <h3 style="cursor:pointer;user-select:none" onclick="toggleQAHistory(this)">
        📋 Histórico de perguntas e respostas
        <span style="font-size:11px;font-weight:400;color:var(--hint);margin-left:6px">(clique para expandir)</span>
      </h3>
      <div id="qa-history" style="display:none;margin-top:12px">
        ${av.historico_qa.map((q, i) => {
          const cm = CAT_META[q.categoria] || { lbl: q.categoria, cls: 'c5' };
          const cor = q.resposta != null ? likerColor[q.resposta] : 'var(--hint)';
          const fw = q.framework ? `<div style="font-size:10px;color:var(--hint);margin-top:3px;font-family:'DM Mono',monospace">${q.framework}</div>` : '';
          return `<div style="padding:12px 0;border-bottom:0.5px solid var(--border)${i === av.historico_qa.length - 1 ? ';border-bottom:none' : ''}">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap">
              <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--hint)">Q${String(i + 1).padStart(2, '0')}</span>
              <span class="qcat ${cm.cls}">${cm.lbl}</span>
              ${q.ignorada ? '<span style="font-size:11px;font-weight:500;color:var(--warn);margin-left:auto">— Não soube responder</span>'
                : q.resposta != null ? `<span style="font-size:11px;font-weight:600;color:${cor};margin-left:auto">${q.resposta} — ${q.resposta_label}</span>`
                : '<span style="font-size:11px;color:var(--hint);margin-left:auto">Não respondida</span>'}
            </div>
            <div style="font-size:13px;color:var(--text);line-height:1.5${q.ignorada ? ';opacity:.55' : ''}">${q.texto}</div>
            ${fw}
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
    <div style="display:flex;justify-content:space-between;margin-top:16px">
      <button class="btn bd" style="font-size:12px;padding:7px 14px" onclick="excluirAv(${av.id})">Remover avaliação</button>
      <button class="btn bg" style="font-size:12px;padding:7px 14px" onclick="closeModal()">Fechar</button>
    </div>`;
}

function closeModal() { document.getElementById('modal-detail').classList.remove('open'); }
function toggleQAHistory(h) {
  const p = document.getElementById('qa-history');
  if (!p) return;
  const open = p.style.display === 'block';
  p.style.display = open ? 'none' : 'block';
  const s = h.querySelector('span');
  if (s) s.textContent = open ? '(clique para expandir)' : '(clique para recolher)';
}

// ── Recomendações (API) ───────────────────────────────
async function toggleRec(recId, checked) {
  try { await api('PATCH', `avaliacoes/recomendacao/${recId}/`, { concluida: checked }); }
  catch (e) { console.warn('toggleRec error:', e); }
}

async function atualizarPrazo(recId, valor) {
  const n = parseInt(valor, 10);
  if (!n || n < 1) return;
  try { await api('PATCH', `avaliacoes/recomendacao/${recId}/`, { prazo_dias: n }); }
  catch (e) { console.warn('atualizarPrazo error:', e); }
}

// ── Exclusão de avaliação (DELETE real no banco) ──────
async function excluirAv(avId) {
  if (!confirm('Deseja remover esta avaliação do histórico?\nEsta ação não pode ser desfeita.')) return;
  try {
    await api('DELETE', `avaliacoes/${avId}/`);
    avaliacoes = avaliacoes.filter(a => a.id !== avId);
    closeModal();
    renderHistorico();
    renderDashboard();
  } catch (e) {
    alert('Erro ao remover avaliação: ' + (e.message || 'tente novamente.'));
  }
}

async function confirmarExcluirDados() {
  if (!confirm('Isso removerá todo o histórico de avaliações da sua conta.\nSeus dados de perfil serão mantidos.\nDeseja continuar?')) return;
  try {
    await api('DELETE', 'avaliacoes/clear/');
    avaliacoes = [];
    renderPerfil();
    renderDashboard();
    const btn = document.querySelector('[onclick="confirmarExcluirDados()"]');
    if (btn) { const orig = btn.textContent; btn.textContent = '✓ Histórico removido'; btn.disabled = true; setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2500); }
  } catch (e) {
    alert('Erro ao remover histórico: ' + (e.message || 'tente novamente.'));
  }
}

// ── Rascunho (API) ────────────────────────────────────
async function saveDraft() {
  if (!evalQuestions.length) return;
  try {
    await api('PUT', 'avaliacoes/rascunho/', {
      perguntas: evalQuestions,
      respostas: evalAnswers,
      ignoradas: evalSkipped,
      nivel_usuario: cogLevel || '',
    });
    updateDraftBanner();
  } catch (e) { console.warn('saveDraft error:', e); }
}

async function loadDraft() {
  try { return await api('GET', 'avaliacoes/rascunho/'); }
  catch { return null; }
}

async function clearDraft() {
  try { await api('DELETE', 'avaliacoes/rascunho/'); }
  catch {}
}

async function updateDraftBanner() {
  const banner = document.getElementById('qa-banner');
  if (!banner) return;
  const draft = await loadDraft();
  if (!draft || !draft.perguntas?.length) { banner.classList.remove('visible'); return; }
  const answered = Object.keys(draft.respostas || {}).length;
  const skipped = Object.keys(draft.ignoradas || {}).length;
  const total = draft.perguntas.length;
  const pct = Math.round(((answered + skipped) / total) * 100);
  const sub = document.getElementById('qa-banner-sub');
  const fill = document.getElementById('qa-banner-prog-fill');
  if (sub) sub.textContent = `${answered} respondida${answered !== 1 ? 's' : ''} · ${skipped} ignorada${skipped !== 1 ? 's' : ''} · ${total} perguntas`;
  if (fill) fill.style.width = pct + '%';
  banner.classList.add('visible');
}

async function descartarRascunho() {
  if (!confirm('Deseja descartar o questionário em andamento?\nTodas as respostas salvas serão perdidas.')) return;
  await clearDraft();
  evalQuestions = []; evalAnswers = {}; evalSkipped = {}; cogLevel = null;
  updateDraftBanner();
}

async function continuarRascunho() {
  const draft = await loadDraft();
  if (!draft) return;
  cogLevel = draft.nivel_usuario;
  evalQuestions = draft.perguntas;
  evalAnswers = draft.respostas || {};
  evalSkipped = draft.ignoradas || {};
  navTo('nova');
  renderQ(cogLevel);
  showEvalStep(2); updateEvalSteps(1);
  Object.entries(evalAnswers).forEach(([qid, val]) => {
    [0, 1, 2, 3, 4].forEach(v => { const el = document.getElementById(`lk-${qid}-${v}`); if (el) el.className = 'lkb'; });
    const sel = document.getElementById(`lk-${qid}-${val}`);
    if (sel) sel.className = `lkb ${val === 2 ? 's2l' : 's' + val}`;
  });
  Object.keys(evalSkipped).forEach(qid => aplicarVisualSkip(qid));
  atualizarContador();
}

// ── Perfil ────────────────────────────────────────────
function renderPerfil() {
  const u = currentUser;
  if (!u) return;
  const nome = u.nome_completo || u.email;
  const ini = nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  document.getElementById('pf-av').textContent = ini;
  document.getElementById('pf-nome').textContent = nome;
  document.getElementById('pf-email').textContent = u.email;
  document.getElementById('pf-cargo').textContent = u.perfil?.cargo || '';
  document.getElementById('pf-empresa').textContent = u.perfil?.empresa || u.perfil_org?.nome || '—';
  document.getElementById('pf-total').textContent = avaliacoes.length + ' avaliação' + (avaliacoes.length !== 1 ? 'ões' : '');
  // Preenche campos de edição
  const pc = u.perfil || {};
  setSelectVal('edit-pc-area', pc.area);
  setSelectVal('edit-pc-lgpd', pc.lgpd_exp);
  if (pc.nivel) {
    const lmap = { basico: 0, intermediario: 1, tecnico: 2 };
    const idx = lmap[pc.nivel];
    document.querySelectorAll('#edit-level-grid .lcard').forEach(c => c.classList.remove('sel'));
    if (idx !== undefined) document.querySelectorAll('#edit-level-grid .lcard')[idx]?.classList.add('sel');
    editCogLevel = pc.nivel;
  }
  const po = u.perfil_org || {};
  document.getElementById('edit-po-nome').value = po.nome || '';
  setSelectVal('edit-po-porte', po.porte);
  setSelectVal('edit-po-setor', po.setor);
  setSelectVal('edit-po-colab', po.colaboradores);
  document.getElementById('edit-po-equip').value = po.equipamentos_ti || '';
  const dados = po.dados_tratados || [];
  ['cpf', 'saude', 'fin', 'bio', 'cri', 'loc', 'comp'].forEach(d => { const el = document.getElementById('ed-' + d); if (el) el.checked = dados.includes(d); });
  const pols = po.politicas || [];
  ['priv', 'dpo', 'trei', 'map'].forEach(p => { const el = document.getElementById('ed-' + p); if (el) el.checked = pols.includes(p); });
}

function setSelectVal(id, val) {
  const el = document.getElementById(id);
  if (!el || !val) return;
  for (const opt of el.options) { if (opt.value === val || opt.textContent === val) { el.value = opt.value; break; } }
}

function togglePerfilEdit(which) {
  const map = { cognitivo: 'edit-cognitivo', org: 'edit-org' };
  const el = document.getElementById(map[which]);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
  if (el.style.display === 'block') el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

let editCogLevel = null;
function selLevel(level, el, ctx) {
  if (ctx === 'edit') {
    editCogLevel = level;
    document.querySelectorAll('#edit-level-grid .lcard').forEach(c => c.classList.remove('sel'));
  } else {
    cogLevel = level;
    document.querySelectorAll('#inline-level-grid .lcard').forEach(c => c.classList.remove('sel'));
  }
  el.classList.add('sel');
}

async function salvarPerfilCognitivo() {
  const level = editCogLevel;
  const area = document.getElementById('edit-pc-area').value;
  const lgpd_exp = document.getElementById('edit-pc-lgpd').value;
  if (!level) { alert('Selecione o nível linguístico.'); return; }
  try {
    await api('PATCH', 'auth/perfil/', { nivel: level, area, lgpd_exp });
    if (currentUser.perfil) { currentUser.perfil.nivel = level; currentUser.perfil.area = area; currentUser.perfil.lgpd_exp = lgpd_exp; }
    document.getElementById('edit-cog-ok').style.display = 'block';
    setTimeout(() => { document.getElementById('edit-cog-ok').style.display = 'none'; }, 3000);
  } catch (e) { alert('Erro ao salvar: ' + e.message); }
}

async function salvarPerfilOrg() {
  const nome = document.getElementById('edit-po-nome').value.trim();
  const porte = document.getElementById('edit-po-porte').value;
  const setor = document.getElementById('edit-po-setor').value;
  const colaboradores = document.getElementById('edit-po-colab').value;
  const equipamentos_ti = document.getElementById('edit-po-equip').value || null;
  if (!porte || !setor) { alert('Preencha porte e setor.'); return; }
  const dados_tratados = ['cpf', 'saude', 'fin', 'bio', 'cri', 'loc', 'comp'].filter(d => document.getElementById('ed-' + d)?.checked);
  const politicas = ['priv', 'dpo', 'trei', 'map'].filter(p => document.getElementById('ed-' + p)?.checked);
  try {
    const updated = await api('PATCH', 'auth/perfil-org/', { nome, porte, setor, colaboradores, equipamentos_ti, dados_tratados, politicas });
    currentUser.perfil_org = updated;
    document.getElementById('edit-org-ok').style.display = 'block';
    setTimeout(() => { document.getElementById('edit-org-ok').style.display = 'none'; }, 3000);
  } catch (e) { alert('Erro ao salvar: ' + e.message); }
}

// ── Nova Avaliação — Fluxo ────────────────────────────
function buildEvalSteps() {
  const labels = ['Revisão de Perfis', 'Questionário IA', 'Resultado'];
  document.getElementById('eval-steps').innerHTML = labels.map((l, i) =>
    `<div class="step${i === 0 ? ' active' : ''}" id="estep-${i}"><div class="sdot">${i + 1}</div><span class="slbl">${l}</span></div>` +
    (i < labels.length - 1 ? '<div class="sdiv"></div>' : '')).join('');
}

function updateEvalSteps(logical) {
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById('estep-' + i); if (!el) continue;
    el.className = 'step' + (i < logical ? ' done' : i === logical ? ' active' : '');
    el.querySelector('.sdot').textContent = i < logical ? '✓' : (i + 1);
  }
}

function showEvalStep(n) {
  [0, 1, 2, 3, 4].forEach(i => { const el = document.getElementById('step-' + i); if (el) el.style.display = 'none'; });
  const el = document.getElementById('step-' + n); if (el) el.style.display = 'block';
  const logical = n === 0 ? 0 : n <= 2 ? 1 : n === 3 ? 1 : 2;
  updateEvalSteps(logical);
}

function initNova() {
  if (evalQuestions.length > 0) return; // rascunho ativo, não reinicia
  evalQuestions = []; evalAnswers = {}; evalSkipped = {}; cogLevel = null; evalFromAI = false;
  showEvalStep(0); updateEvalSteps(0);
  renderProfileReviews();
}

function renderProfileReviews() {
  const pc = currentUser?.perfil || {};
  const po = currentUser?.perfil_org || {};
  const levelLabel = { basico: 'Básico', intermediario: 'Intermediário', tecnico: 'Técnico' };
  const cogEl = document.getElementById('cog-preview');
  if (pc.nivel) {
    cogEl.innerHTML = `<div class="pr-header"><div class="pr-title">👤 Perfil do Usuário</div></div>
      <div class="pr-body"><div class="pr-row">
        <div class="pr-field"><div class="pr-lbl">Nível</div><div class="pr-val">${levelLabel[pc.nivel] || pc.nivel}</div></div>
        <div class="pr-field"><div class="pr-lbl">Área</div><div class="pr-val">${pc.area || '—'}</div></div>
        <div class="pr-field"><div class="pr-lbl">Exp. LGPD</div><div class="pr-val">${(pc.lgpd_exp || '—').split('—')[0].trim()}</div></div>
      </div></div>`;
  } else {
    cogEl.innerHTML = `<div class="pr-header"><div class="pr-title">👤 Perfil do Usuário</div>
      <button class="pr-edit-btn" onclick="navTo('perfil')" style="color:var(--warn)">+ Preencher</button></div>
      <div class="pr-body"><div class="pr-missing">⚠ Preencha o perfil do usuário em <strong>Meu Perfil</strong>.</div></div>`;
  }
  const orgEl = document.getElementById('org-preview');
  if (po.porte) {
    orgEl.innerHTML = `<div class="pr-header"><div class="pr-title">🏢 Perfil Organizacional</div></div>
      <div class="pr-body"><div class="pr-row">
        <div class="pr-field"><div class="pr-lbl">Empresa</div><div class="pr-val">${po.nome || '—'}</div></div>
        <div class="pr-field"><div class="pr-lbl">Porte</div><div class="pr-val">${po.porte}</div></div>
        <div class="pr-field"><div class="pr-lbl">Setor</div><div class="pr-val">${po.setor}</div></div>
      </div></div>`;
  } else {
    orgEl.innerHTML = `<div class="pr-header"><div class="pr-title">🏢 Perfil Organizacional</div>
      <button class="pr-edit-btn" onclick="navTo('perfil')" style="color:var(--warn)">+ Preencher</button></div>
      <div class="pr-body"><div class="pr-missing">⚠ Preencha o perfil organizacional em <strong>Meu Perfil</strong>.</div></div>`;
  }
  const canProceed = pc.nivel && po.porte;
  const missing = document.getElementById('missing-warning');
  const btn = document.getElementById('btn-gerar');
  if (missing) missing.style.display = canProceed ? 'none' : 'flex';
  if (btn) btn.disabled = !canProceed;
}

// ── Gerar Questionário (proxy Django → Gemini) ────────
async function gerarQ() {
  const pc = currentUser?.perfil || {};
  const po = currentUser?.perfil_org || {};
  if (!pc.nivel || !po.porte) { alert('Perfis incompletos.'); return; }
  cogLevel = pc.nivel;
  showEvalStep(1);
  evalQuestions = []; evalAnswers = {}; evalSkipped = {}; evalFromAI = false;
  const st = document.getElementById('q-load-status');
  const streamBar = document.getElementById('stream-bar');
  const streamCount = document.getElementById('stream-count');
  const streamReady = document.getElementById('stream-ready');
  const streamStatusRow = document.getElementById('stream-status-row');
  const streamContainer = document.getElementById('stream-container');
  if (streamContainer) streamContainer.innerHTML = '';
  if (streamBar) streamBar.style.width = '0%';
  if (streamReady) streamReady.style.display = 'none';

  const prompt = buildPrompt(pc, po);

  // Animação de progresso
  let animPct = 0;
  const animInterval = setInterval(() => {
    const step = animPct < 70 ? 3 : animPct < 85 ? 1.2 : 0.3;
    animPct = Math.min(animPct + step, 92);
    if (streamBar) streamBar.style.width = animPct + '%';
    if (streamCount) streamCount.textContent = `Gerando... ${Math.round(animPct)}%`;
    st.textContent = `Aguardando Gemini... ${Math.round(animPct)}%`;
  }, 200);

  try {
    const data = await api('POST', 'gemini/', { prompt, maxTokens: 4000 });
    clearInterval(animInterval);
    if (streamBar) streamBar.style.width = '95%';
    st.textContent = 'Extraindo perguntas...';
    evalQuestions = parseQ(data.text || '');
    if (evalQuestions.length >= 10) evalFromAI = true;
  } catch (e) {
    clearInterval(animInterval);
    // 429 (cota), 503 (indisponível) ou qualquer erro → fallback silencioso
    console.warn('Gemini indisponível, usando banco de perguntas padrão.');
  }

  if (evalQuestions.length < 10) {
    evalQuestions = fallbackQ(po, pc.nivel);
    evalFromAI = false;
  }

  // Renderiza preview das perguntas no step-1
  if (streamContainer) {
    streamContainer.innerHTML = '';
    evalQuestions.forEach((q, i) => {
      const cm = CAT_META[q.categoria] || { lbl: q.categoria, cls: 'c5' };
      const div = document.createElement('div');
      div.className = 'qcard';
      div.style.cssText = `animation:fadeInQ .2s ease ${i * 40}ms both`;
      div.innerHTML = `<div class="qmeta">
        <span class="qnum">Q${String(i + 1).padStart(2, '0')}</span>
        <span class="qcat ${cm.cls}">${cm.lbl}</span>
        <span style="font-size:10px;padding:2px 7px;border-radius:8px;background:var(--s2);color:var(--hint);font-weight:500">peso ${q.peso}</span>
      </div><div class="qtxt">${q.texto}</div>`;
      streamContainer.appendChild(div);
    });
  }
  if (streamBar) streamBar.style.width = '100%';
  if (streamCount) streamCount.textContent = `${evalQuestions.length} perguntas geradas`;
  if (streamStatusRow) streamStatusRow.style.display = 'none';
  if (streamReady) streamReady.style.display = 'block';
  st.textContent = 'Questionário pronto!';
}

function confirmarStreamCompleto() {
  renderQ(cogLevel);
  showEvalStep(2); updateEvalSteps(1);
  const notice = document.getElementById('q-origin-notice');
  if (notice) {
    notice.textContent = evalFromAI
      ? '✦ Perguntas geradas por IA · Gemini 2.0 Flash · SIAAC-LGPD v2.0'
      : '⚠ Perguntas do banco padrão (IA indisponível) · SIAAC-LGPD v2.0';
    notice.style.color = evalFromAI ? 'var(--hint)' : 'var(--warn)';
  }
}

// ── Prompt builder ─────────────────────────────────────
function buildPrompt(pc, po) {
  const nivelInstrucao = {
    basico: `NÍVEL BÁSICO: escreva como se conversasse com dono de pequena empresa. Nunca use siglas sem explicar. Perguntas devem começar com situações do cotidiano. Inclua ao menos 5 "perguntas de revelação de desconhecimento" (peso 3) que um gestor básico provavelmente responderá "Sim" por desconhecimento.`,
    intermediario: `NÍVEL INTERMEDIÁRIO: use termos LGPD com contexto prático. Evite jargões técnicos de TI. Orientado a processos e documentação.`,
    tecnico: `NÍVEL TÉCNICO: terminologia técnica e jurídica precisa. Referencie artigos da LGPD e controles ISO/CIS/NIST diretamente.`,
  };
  return `Você é especialista em LGPD, ISO/IEC 27001:2022, CIS Controls v8 e NIST CSF 2.0.

PERFIL DO USUÁRIO: Nível ${pc.nivel} | Área: ${pc.area || 'não informada'} | LGPD: ${pc.lgpd_exp || 'não informada'}
INSTRUÇÃO: ${nivelInstrucao[pc.nivel] || nivelInstrucao.intermediario}

PERFIL ORG: ${po.nome || 'Empresa'} | ${po.porte} | ${po.setor} | ${po.colaboradores || '?'} colaboradores
Dados tratados: ${po.dados_tratados_label || po.dados_tratados?.join(', ') || 'não especificado'}
Políticas: ${(po.politicas || []).length}/4 | Setor sensível: ${po.setor_sensivel ? 'SIM' : 'NÃO'}

DISTRIBUIÇÃO OBRIGATÓRIA (20 perguntas, escopos únicos por categoria):
base-legal(4): bases legais, política privacidade, consentimento, minimização
direitos(3): canal titular, prazo resposta, portabilidade
segurança(4): acesso/autenticação, criptografia, backup, inventário
compartilhamento(3): contratos fornecedores, transferência internacional, ROPA
incidentes(3): plano resposta, notificação ANPD 72h, simulação
governança(3): DPO, treinamento, revisão periódica

Peso 3=crítico(máx 6) | Peso 2=importante | Peso 1=boa prática
ANTI-REPETIÇÃO: cada pergunta explora aspecto diferente dentro da categoria.
${po.setor_sensivel ? 'Inclua 2 perguntas sobre dados sensíveis (LGPD Art. 11).' : ''}

Retorne APENAS JSON válido:
{"perguntas":[{"id":1,"texto":"...","categoria":"base-legal|direitos|segurança|compartilhamento|incidentes|governança","peso":1|2|3,"framework":"referência normativa"}]}`;
}

// ── Render e interação do questionário ────────────────
function renderQ(level) {
  const ll = { basico: 'Básico', intermediario: 'Intermediário', tecnico: 'Técnico' }[level] || 'Geral';
  document.getElementById('q-subtitle-txt').textContent = `Nível ${ll} · ${evalQuestions.length} perguntas · LGPD, ISO 27001, CIS Controls, NIST CSF`;
  atualizarContador();
  document.getElementById('q-container').innerHTML = evalQuestions.map((q, i) => {
    const cm = CAT_META[q.categoria] || { lbl: q.categoria, cls: 'c5' };
    const pl = q.peso === 3 ? 'crítico' : q.peso === 2 ? 'importante' : 'boa prática';
    const fw = q.framework ? `<span style="font-size:10px;color:var(--hint);margin-left:auto;font-family:'DM Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px" title="${q.framework}">${q.framework}</span>` : '';
    return `<div class="qcard" id="qcard-${q.id}">
      <div class="qmeta">
        <span class="qnum">Q${String(i + 1).padStart(2, '0')}</span>
        <span class="qcat ${cm.cls}">${cm.lbl}</span>
        <span style="font-size:10px;padding:2px 7px;border-radius:8px;background:var(--s2);color:var(--hint);font-weight:500">peso ${q.peso} · ${pl}</span>
        ${fw}
      </div>
      <div class="qtxt">${q.texto}</div>
      <div class="likert">${[0, 1, 2, 3, 4].map(v => `<label class="lkb" id="lk-${q.id}-${v}" onclick="setAns(${q.id},${v})">
        <div class="lkd">${v}</div><span class="lkl">${LKRL[v]}</span></label>`).join('')}</div>
      <div class="skip-row">
        <button class="skip-btn" id="skip-${q.id}" onclick="toggleSkip(${q.id})" title="Esta pergunta não será considerada no cálculo">? Não sei responder</button>
      </div>
    </div>`;
  }).join('');
}

function atualizarContador() {
  const r = Object.keys(evalAnswers).length, ig = Object.keys(evalSkipped).length, t = evalQuestions.length;
  const el = document.getElementById('q-counter');
  if (el) el.textContent = `${r} respondida${r !== 1 ? 's' : ''} · ${ig} ignorada${ig !== 1 ? 's' : ''} · ${t} total`;
}

function setAns(qid, val) {
  if (evalSkipped[qid]) {
    delete evalSkipped[qid];
    const card = document.getElementById(`qcard-${qid}`); if (card) card.classList.remove('skipped-card');
    const sb = document.getElementById(`skip-${qid}`); if (sb) { sb.classList.remove('skipped'); sb.textContent = '? Não sei responder'; }
  }
  evalAnswers[qid] = val;
  [0, 1, 2, 3, 4].forEach(v => { const el = document.getElementById(`lk-${qid}-${v}`); if (el) el.className = 'lkb'; });
  const sel = document.getElementById(`lk-${qid}-${val}`);
  if (sel) sel.className = `lkb ${val === 2 ? 's2l' : 's' + val}`;
  atualizarContador();
  saveDraft();
}

function aplicarVisualSkip(qid) {
  const card = document.getElementById(`qcard-${qid}`); if (card) card.classList.add('skipped-card');
  const sb = document.getElementById(`skip-${qid}`); if (sb) { sb.classList.add('skipped'); sb.textContent = '✕ Ignorada — clique para desfazer'; }
  [0, 1, 2, 3, 4].forEach(v => { const el = document.getElementById(`lk-${qid}-${v}`); if (el) el.className = 'lkb'; });
}

function toggleSkip(qid) {
  if (evalSkipped[qid]) {
    delete evalSkipped[qid];
    const card = document.getElementById(`qcard-${qid}`); if (card) card.classList.remove('skipped-card');
    const sb = document.getElementById(`skip-${qid}`); if (sb) { sb.classList.remove('skipped'); sb.textContent = '? Não sei responder'; }
  } else {
    delete evalAnswers[qid];
    evalSkipped[qid] = true;
    aplicarVisualSkip(qid);
  }
  atualizarContador();
  saveDraft();
}

function confirmarVoltarQuestionario() {
  if (Object.keys(evalAnswers).length > 0 || Object.keys(evalSkipped).length > 0) {
    saveDraft();
  }
  // Limpa estado do questionário e volta ao step 0
  evalAnswers = {}; evalSkipped = {}; evalQuestions = []; cogLevel = null; evalFromAI = false;
  // Navega para o dashboard mostrando o banner de rascunho se houver
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  document.getElementById('page-dashboard').classList.add('active');
  document.getElementById('nav-dashboard').classList.add('active');
  renderDashboard();
  updateDraftBanner();
}

// ── Calcular ──────────────────────────────────────────
async function calcular() {
  const answered = Object.keys(evalAnswers).length;
  if (answered < Math.min(8, evalQuestions.length)) { alert(`Responda pelo menos ${Math.min(8, evalQuestions.length)} perguntas.`); return; }
  showEvalStep(3);
  document.getElementById('r-load-status').textContent = 'Calculando índice...';
  await sleep(300);

  let svp = 0, sp = 0; const at = {}, aw = {};
  const penalizar = cogLevel === 'basico';
  evalQuestions.forEach(q => {
    if (evalSkipped[q.id]) {
      if (penalizar) { sp += q.peso; if (!at[q.categoria]) { at[q.categoria] = 0; aw[q.categoria] = 0; } aw[q.categoria] += q.peso; }
      return;
    }
    const val = evalAnswers[q.id] ?? null; if (val === null) return;
    svp += val * q.peso; sp += q.peso;
    if (!at[q.categoria]) { at[q.categoria] = 0; aw[q.categoria] = 0; }
    at[q.categoria] += val * q.peso; aw[q.categoria] += q.peso;
  });

  let indice = sp > 0 ? Math.round((svp / sp) * 25) : 0;
  const totalIgnoradas = Object.keys(evalSkipped).length;
  const descontoAplicado = cogLevel === 'basico' ? Math.round(totalIgnoradas * 0.75) : 0;
  indice = Math.max(0, indice - descontoAplicado);

  const ni = getNivelInfo(indice);
  const areaScores = {};
  Object.keys(at).forEach(c => { areaScores[c] = aw[c] > 0 ? Math.round((at[c] / aw[c]) * 25) : 0; });

  document.getElementById('r-load-status').textContent = 'Gerando relatório com IA...';
  await sleep(200);

  const d = {
    empresa: currentUser?.perfil_org?.nome || 'Empresa',
    porte: currentUser?.perfil_org?.porte || '',
    setor: currentUser?.perfil_org?.setor || '',
    level: cogLevel, totalIgnoradas, descontoAplicado,
  };
  let rel; try { rel = await gerarRelatorio(indice, ni, areaScores, d); } catch { rel = fallbackRel(indice, ni, areaScores, d); }

  // Monta payload e salva no banco via API
  const historicoQA = evalQuestions.map(q => ({
    ordem: q.id,
    texto: q.texto,
    categoria: q.categoria,
    peso: q.peso,
    framework: q.framework || '',
    ignorada: !!evalSkipped[q.id],
    resposta: evalSkipped[q.id] ? null : (evalAnswers[q.id] ?? null),
  }));

  const payload = {
    empresa: d.empresa, setor: d.setor, porte: d.porte, nivel_usuario: cogLevel,
    indice, nivel_maturidade: ni.nome, area_scores: areaScores,
    diagnostico: rel.diagnostico || '', plano_acao: rel.plano_acao || '',
    perguntas_ignoradas: totalIgnoradas, desconto_aplicado: descontoAplicado,
    recomendacoes: (rel.recomendacoes || []).map((r, i) => ({
      prioridade: r.prioridade || 'media',
      acao: r.acao || '',
      prazo_dias: parseInt(r.prazo) || 30,
      concluida: false, ordem: i,
    })),
    historico_qa: historicoQA,
  };

  try {
    const saved = await api('POST', 'avaliacoes/', payload);
    avaliacoes.unshift(saved); // Adiciona no topo da lista local
    await clearDraft();
  } catch (e) { console.warn('Erro ao salvar avaliação:', e); }

  renderResultado(indice, ni, areaScores, rel, d);
  showEvalStep(4); updateEvalSteps(2);
}

// ── Relatório via proxy ───────────────────────────────
async function gerarRelatorio(indice, ni, areaScores, d) {
  const instrRelatorio = {
    basico: `BÁSICO: linguagem de conversa, sem jargões. Se houver perguntas ignoradas (${d.totalIgnoradas}), destaque que o resultado pode subestimar o risco. Se índice < 60% ou ignoradas > 3, inclua recomendação obrigatória para buscar DPO/especialista LGPD.`,
    intermediario: `INTERMEDIÁRIO: termos LGPD com contexto prático. Verbos de processo: Revise, Documente, Formalize, Valide.`,
    tecnico: `TÉCNICO: terminologia precisa com referências a artigos LGPD e controles ISO/CIS/NIST.`,
  };
  const prompt = `Especialista LGPD. Relatório de conformidade em JSON.
Índice: ${indice}% | Nível: ${ni.nome} | ${d.empresa} (${d.porte}) | Setor: ${d.setor}
Áreas: ${JSON.stringify(areaScores)} | Respondente: ${d.level}
Perguntas ignoradas: ${d.totalIgnoradas} | Desconto aplicado: ${d.descontoAplicado}pts
INSTRUÇÃO: ${instrRelatorio[d.level] || instrRelatorio.intermediario}
Retorne APENAS JSON: {"diagnostico":"...","areas_criticas":["..."],"recomendacoes":[{"prioridade":"alta|media|baixa","acao":"...","prazo":"número"}],"plano_acao":"..."}
Máx 5 recomendações. prazo = apenas o número em dias.`;
  const data = await api('POST', 'gemini/', { prompt, maxTokens: 1200 });
  const clean = (data.text || '').replace(/```json|```/g, '').trim();
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
  return JSON.parse(clean.substring(s, e + 1));
}

function fallbackRel(indice, ni, areaScores, d) {
  const criticas = Object.entries(areaScores).filter(([, v]) => v < 40).map(([k]) => CATS[k] || k);
  const conteudo = {
    basico: {
      diagnostico: `A avaliação mostrou que ${d.empresa} está no nível "${ni.nome}" com ${indice}% de conformidade. ${indice <= 40 ? 'Sua empresa ainda tem muito a melhorar para proteger os dados dos seus clientes.' : 'Bom progresso, mas ainda há pontos importantes a melhorar.'}`,
      recomendacoes: [
        { prioridade: 'alta', acao: 'Converse com um especialista em LGPD ou advogado sobre o que sua empresa precisa fazer', prazo: '15' },
        { prioridade: 'alta', acao: 'Crie um e-mail dedicado para que clientes possam pedir informações sobre seus dados', prazo: '30' },
        { prioridade: 'media', acao: 'Peça ao responsável de TI para criar senhas individuais para cada funcionário', prazo: '30' },
      ],
      plano_acao: 'Comece buscando orientação especializada e criando o canal de atendimento aos clientes.',
    },
    intermediario: {
      diagnostico: `${d.empresa} atingiu ${indice}% de conformidade, nível "${ni.nome}". ${indice <= 40 ? 'Práticas pontuais, mas sem sistematização.' : 'Processos parcialmente implementados com oportunidades de melhoria.'}`,
      recomendacoes: [
        { prioridade: 'alta', acao: 'Formalize as bases legais para cada tipo de dado coletado', prazo: '30' },
        { prioridade: 'alta', acao: 'Publique ou atualize a Política de Privacidade no site', prazo: '45' },
        { prioridade: 'media', acao: 'Com apoio de TI, revise controles de acesso aos sistemas', prazo: '60' },
      ],
      plano_acao: 'Priorize a formalização das bases legais e a política de privacidade.',
    },
    tecnico: {
      diagnostico: `${d.empresa} apresenta ${indice}% de conformidade (nível "${ni.nome}"). ${indice <= 40 ? 'Ausência de controles formalizados.' : 'Gaps em documentação e governança identificados.'}`,
      recomendacoes: [
        { prioridade: 'alta', acao: 'Mapear bases legais por operação de tratamento (Art. 7º LGPD) e elaborar ROPA (Art. 37)', prazo: '30' },
        { prioridade: 'alta', acao: 'Revisar Política de Privacidade conforme Art. 9º e implementar canal de direitos (Art. 18)', prazo: '45' },
        { prioridade: 'media', acao: 'Implementar controle de acesso por mínimo privilégio (ISO 27001 A.9 / CIS Control 6)', prazo: '60' },
      ],
      plano_acao: 'Iniciar pelo ROPA e bases legais. Paralelamente implementar controles técnicos de acesso.',
    },
  };
  const c = conteudo[d.level] || conteudo.intermediario;
  return { diagnostico: c.diagnostico, areas_criticas: criticas.length ? criticas : ['Revisão geral recomendada'], recomendacoes: c.recomendacoes, plano_acao: c.plano_acao };
}

function renderResultado(indice, ni, areaScores, rel, d) {
  document.getElementById('g-score').innerHTML = `${indice}<span class="gunit">%</span>`;
  const nd = { Inicial: 'ausência de práticas formais', Básico: 'práticas pontuais', Intermediário: 'políticas parcialmente implementadas', Gerenciado: 'processos controlados', Otimizado: 'maturidade plena' };
  document.getElementById('g-level').textContent = ni.nome + ' — ' + (nd[ni.nome] || '');
  setTimeout(() => { document.getElementById('g-fill').style.width = indice + '%'; }, 100);
  document.getElementById('result-areas').innerHTML = Object.entries(areaScores).map(([c, v]) => {
    const cm = CAT_META[c] || { lbl: c };
    return `<div class="acard"><div class="aname">${cm.lbl}</div>
      <div class="abar"><div class="afill" style="width:0%;background:${barColor(v)}" data-w="${v}"></div></div>
      <div class="apct">${v}%</div></div>`;
  }).join('');
  setTimeout(() => { document.querySelectorAll('.afill').forEach(el => { el.style.width = el.dataset.w + '%'; }); }, 150);
  const pi = { alta: 'ph2', media: 'pm', baixa: 'pl' }, pl2 = { alta: 'A', media: 'M', baixa: 'B' };
  document.getElementById('result-report').innerHTML = `
    <div class="rbox"><h3>📝 Diagnóstico Geral</h3><p>${rel.diagnostico || ''}</p></div>
    ${(rel.areas_criticas || []).length ? `<div class="rbox"><h3>⚠ Áreas Críticas</h3>${rel.areas_criticas.map(a => `<p style="padding:6px 0;border-bottom:.5px solid var(--border)">• ${a}</p>`).join('')}</div>` : ''}
    <div class="rbox"><h3>🎯 Recomendações</h3>
      ${(rel.recomendacoes || []).map(r => `<div class="rec"><div class="rprio ${pi[r.prioridade] || 'pm'}">${pl2[r.prioridade] || 'M'}</div>
        <div><div style="font-weight:500;font-size:13px">${r.acao}</div>
        <div style="color:var(--hint);font-size:11px;margin-top:1px">Prazo: ${r.prazo} dias</div></div></div>`).join('')}
    </div>
    ${rel.plano_acao ? `<div class="rbox"><h3>🗺 Plano de Ação</h3><p>${rel.plano_acao}</p></div>` : ''}
    <div class="ok">✅ Avaliação salva automaticamente no histórico.</div>
    ${d?.level === 'basico' && d?.descontoAplicado > 0 ? `<div style="background:#fdf4e8;border:0.5px solid rgba(230,126,34,.3);border-radius:var(--rs);padding:12px 16px;margin-top:10px;font-size:13px;color:#7a4a00">
      ⚠ <strong>Nota:</strong> ${d.totalIgnoradas} pergunta(s) não respondida(s) geraram desconto de ${d.descontoAplicado} pontos para refletir o risco do desconhecimento. Recomendamos consulta a um especialista em LGPD.
    </div>` : ''}
    <div class="dis">⚠ Relatório diagnóstico e orientativo. Não substitui consultoria jurídica. · SIAAC-LGPD v2.0 · IFBA 2026 · Wendell Paim</div>`;
}

function novaAvaliacao() { clearDraft(); evalQuestions = []; evalAnswers = {}; evalSkipped = {}; evalFromAI = false; cogLevel = null; navTo('nova'); }

// ── Fallback de perguntas ─────────────────────────────
function parseQ(text) {
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}'); if (s < 0) return [];
    const j = JSON.parse(clean.substring(s, e + 1));
    if (!Array.isArray(j.perguntas)) return [];
    return j.perguntas.map(q => ({ id: q.id, texto: q.texto, categoria: q.categoria || 'segurança', peso: q.peso || 1, framework: q.framework || '' }));
  } catch { return []; }
}

function fallbackQ(po, level) {
  const base = level === 'basico' ? [
    { id: 1, texto: 'Você sabe dizer por que sua empresa guarda o CPF, e-mail ou telefone dos seus clientes, e por quanto tempo?', categoria: 'base-legal', peso: 3, framework: 'LGPD Art. 7º e 6º III' },
    { id: 2, texto: 'Existe uma página no site ou documento explicando aos clientes quais dados a empresa coleta e para que usa?', categoria: 'base-legal', peso: 2, framework: 'LGPD Art. 9º (transparência)' },
    { id: 3, texto: 'Quando um cliente fornece o e-mail, existe registro de que ele concordou? E se quiser cancelar, sua empresa sabe como fazer?', categoria: 'base-legal', peso: 2, framework: 'LGPD Art. 8º (consentimento)' },
    { id: 4, texto: 'Sua empresa coleta apenas as informações que realmente precisa para atender o cliente?', categoria: 'base-legal', peso: 2, framework: 'LGPD Art. 6º III (necessidade)' },
    { id: 5, texto: 'Se um cliente ligar pedindo para apagar todos os dados dele, sua equipe saberia o que fazer e conseguiria responder em até 15 dias?', categoria: 'direitos', peso: 3, framework: 'LGPD Art. 18 e 19' },
    { id: 6, texto: 'Existe e-mail, formulário ou telefone específico para clientes que queiram saber o que a empresa sabe sobre eles?', categoria: 'direitos', peso: 2, framework: 'LGPD Art. 18 (canal)' },
    { id: 7, texto: 'Se um cliente pedir para levar os dados dele para outra empresa, sua empresa saberia como fazer?', categoria: 'direitos', peso: 1, framework: 'LGPD Art. 18 V (portabilidade)' },
    { id: 8, texto: 'Cada funcionário tem login e senha individuais para acessar os sistemas? Ou compartilham senha?', categoria: 'segurança', peso: 3, framework: 'LGPD Art. 46 · CIS Control 5' },
    { id: 9, texto: 'Se um computador for roubado, os dados dos clientes estão protegidos por senha ou criptografia?', categoria: 'segurança', peso: 3, framework: 'LGPD Art. 46 · ISO 27001 A.10' },
    { id: 10, texto: 'Sua empresa faz cópias de segurança (backup) dos dados dos clientes e já testou se consegue recuperá-los?', categoria: 'segurança', peso: 2, framework: 'LGPD Art. 46 · CIS Control 11' },
    { id: 11, texto: 'Você sabe onde estão armazenados todos os dados dos seus clientes — quais computadores, sistemas ou planilhas?', categoria: 'segurança', peso: 2, framework: 'LGPD Art. 46 · CIS Controls 1 e 2' },
    { id: 12, texto: 'Os fornecedores com acesso a dados dos clientes têm contrato que os obriga a proteger esses dados?', categoria: 'compartilhamento', peso: 2, framework: 'LGPD Art. 26-28' },
    { id: 13, texto: 'Existe lista de todos os dados coletados, com o motivo e quanto tempo ficam guardados?', categoria: 'compartilhamento', peso: 2, framework: 'LGPD Art. 37 (ROPA)' },
    { id: 14, texto: 'Os dados dos clientes ficam só no Brasil ou são enviados para outros países?', categoria: 'compartilhamento', peso: 1, framework: 'LGPD Art. 33-36' },
    { id: 15, texto: 'Se um funcionário enviar por engano dados dos clientes para a pessoa errada, sua empresa sabe a quem avisar e em quanto tempo?', categoria: 'incidentes', peso: 3, framework: 'LGPD Art. 48-49' },
    { id: 16, texto: 'Você conhece a ANPD (órgão que fiscaliza proteção de dados) e sabe que vazamentos graves devem ser notificados a eles?', categoria: 'incidentes', peso: 3, framework: 'LGPD Art. 48' },
    { id: 17, texto: 'Existe roteiro escrito do que fazer em caso de vazamento de dados dos clientes?', categoria: 'incidentes', peso: 2, framework: 'LGPD Art. 49 · ISO 27001 A.16' },
    { id: 18, texto: 'Existe alguém formalmente responsável por garantir que os dados dos clientes sejam protegidos, com nome e contato publicados?', categoria: 'governança', peso: 3, framework: 'LGPD Art. 41 (DPO)' },
    { id: 19, texto: 'Seus funcionários já receberam orientação sobre como lidar com dados de clientes de forma segura e dentro da lei?', categoria: 'governança', peso: 2, framework: 'LGPD Art. 50 · ISO 27001 A.7.2.2' },
    { id: 20, texto: 'Você conhece a LGPD e sabe que ela pode gerar multas de até 2% do faturamento anual em caso de descumprimento?', categoria: 'governança', peso: 3, framework: 'LGPD Art. 52 (sanções)' },
  ] : [
    { id: 1, texto: 'A organização possui bases legais definidas e documentadas para cada operação de tratamento?', categoria: 'base-legal', peso: 3, framework: 'LGPD Art. 7º e 11 · ISO 27001 A.18.1' },
    { id: 2, texto: 'A Política de Privacidade está publicada, atualizada e acessível, com finalidade, base legal e retenção?', categoria: 'base-legal', peso: 2, framework: 'LGPD Art. 9º · ISO 27001 A.18.1' },
    { id: 3, texto: 'O consentimento é registrado, rastreável e permite revogação sem prejuízo ao titular?', categoria: 'base-legal', peso: 2, framework: 'LGPD Art. 8º' },
    { id: 4, texto: 'A empresa aplica minimização — coleta apenas dados estritamente necessários para cada finalidade?', categoria: 'base-legal', peso: 2, framework: 'LGPD Art. 6º III' },
    { id: 5, texto: 'Existe canal formal para titular solicitar acesso, correção ou eliminação dos seus dados?', categoria: 'direitos', peso: 3, framework: 'LGPD Art. 18 · NIST CSF PR.AC-1' },
    { id: 6, texto: 'As solicitações dos titulares são respondidas em até 15 dias úteis com documentação dos atendimentos?', categoria: 'direitos', peso: 2, framework: 'LGPD Art. 19 · ISO 27001 A.18.1' },
    { id: 7, texto: 'Existe processo para portabilidade e comunicação sobre compartilhamentos realizados?', categoria: 'direitos', peso: 1, framework: 'LGPD Art. 18 V' },
    { id: 8, texto: 'Sistemas com dados pessoais usam controle de acesso por mínimo privilégio com MFA onde aplicável?', categoria: 'segurança', peso: 3, framework: 'LGPD Art. 46 · ISO 27001 A.9 · CIS Controls 4,5,6' },
    { id: 9, texto: 'Dados em repouso e em trânsito são protegidos por criptografia com gerenciamento de chaves documentado?', categoria: 'segurança', peso: 3, framework: 'LGPD Art. 46 · ISO 27001 A.10 · CIS Control 3' },
    { id: 10, texto: 'Backups são realizados regularmente, com testes de restauração periódicos e plano de continuidade?', categoria: 'segurança', peso: 2, framework: 'LGPD Art. 46 · ISO 27001 A.12.3 · CIS Control 11' },
    { id: 11, texto: 'Existe inventário atualizado de todos os ativos que armazenam ou processam dados pessoais?', categoria: 'segurança', peso: 2, framework: 'LGPD Art. 46 · ISO 27001 A.8 · CIS Controls 1,2' },
    { id: 12, texto: 'Contratos com fornecedores que acessam dados pessoais incluem cláusulas DPA com obrigações LGPD?', categoria: 'compartilhamento', peso: 2, framework: 'LGPD Art. 26-28 · ISO 27001 A.15' },
    { id: 13, texto: 'O ROPA está mantido e atualizado com finalidade, base legal e prazo de retenção por categoria de dado?', categoria: 'compartilhamento', peso: 2, framework: 'LGPD Art. 37 · ISO 27001 A.18.1.3' },
    { id: 14, texto: 'Transferências internacionais de dados têm controle formal e mecanismos de adequação documentados?', categoria: 'compartilhamento', peso: 1, framework: 'LGPD Art. 33-36' },
    { id: 15, texto: 'Há Plano de Resposta a Incidentes com procedimentos para detectar e notificar a ANPD em até 72h?', categoria: 'incidentes', peso: 3, framework: 'LGPD Art. 48-49 · ISO 27001 A.16 · NIST CSF RS' },
    { id: 16, texto: 'Existe processo para notificar titulares afetados em caso de incidente com risco relevante?', categoria: 'incidentes', peso: 2, framework: 'LGPD Art. 48 · ISO 27001 A.16.1.7' },
    { id: 17, texto: 'O Plano de Resposta a Incidentes é testado ao menos anualmente com simulação ou exercício de mesa?', categoria: 'incidentes', peso: 2, framework: 'LGPD Art. 49 · CIS Control 17' },
    { id: 18, texto: 'DPO foi designado formalmente com canal de contato publicado e acesso direto à alta gestão?', categoria: 'governança', peso: 2, framework: 'LGPD Art. 41 · NIST CSF GV · ISO 27001 A.6' },
    { id: 19, texto: 'Colaboradores recebem treinamentos periódicos sobre LGPD com registro e avaliação de eficácia?', categoria: 'governança', peso: 2, framework: 'LGPD Art. 50 · ISO 27001 A.7.2.2 · CIS Control 14' },
    { id: 20, texto: 'Existe programa formal de conformidade com revisões periódicas e reporte à alta gestão?', categoria: 'governança', peso: 1, framework: 'LGPD Art. 50 · NIST CSF GV.RM · ISO 27001 A.5' },
  ];
  if (po?.setor_sensivel || po?.setorSensivel) {
    base.push({ id: base.length + 1, texto: level === 'basico' ? 'Sua empresa lida com dados de saúde, financeiros ou de crianças? Há cuidado especial com esses dados mais sensíveis?' : 'Há controles e base legal específica (Art. 11 LGPD) para o tratamento de dados pessoais sensíveis documentados?', categoria: 'segurança', peso: 3, framework: 'LGPD Art. 11 · CIS Control 3 · ISO 27001 A.10' });
  }
  return base;
}

// ── Utilitários ───────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

document.getElementById('modal-detail').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

// ── Inicializa ────────────────────────────────────────
boot();
