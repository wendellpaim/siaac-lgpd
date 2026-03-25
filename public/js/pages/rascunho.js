// ═══════════════════════════════════════════════════
//  SIAAC-LGPD v2.0 — Rascunho (Draft)
// ═══════════════════════════════════════════════════

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
