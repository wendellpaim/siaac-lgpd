// ═══════════════════════════════════════════════════
//  SIAAC-LGPD v2.0 — Nova Avaliação
// ═══════════════════════════════════════════════════

// ── Fluxo de Steps ────────────────────────────────────
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
  const cogEl = document.getElementById('cog-preview');
  if (pc.nivel) {
    const levelLabel = { basico: 'Iniciante', intermediario: 'Intermediário', tecnico: 'Especialista' };
    cogEl.innerHTML = `<div class="pr-header"><div class="pr-title">👤 Perfil do Usuário</div></div>
      <div class="pr-body"><div class="pr-row">
        <div class="pr-field"><div class="pr-lbl">Nível</div><div class="pr-val">${levelLabel[pc.nivel] || pc.nivel}</div></div>
        <div class="pr-field"><div class="pr-lbl">Área</div><div class="pr-val">${pc.area || '—'}</div></div>
        <div class="pr-field"><div class="pr-lbl">Cargo</div><div class="pr-val">${pc.cargo || currentUser?.cargo || '—'}</div></div>
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

// ── Gerar Questionário (proxy → Gemini) ────────────────
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
    basico: `PÚBLICO-ALVO: dono ou gestor de pequena empresa sem formação técnica.
- Use linguagem simples e direta, sem siglas ou termos jurídicos.
- Inicie cada pergunta com uma situação prática do cotidiano da empresa.
- Nunca use abreviações como LGPD, ANPD, DPO, ROPA sem explicar brevemente o significado na própria pergunta.
- Exemplo BOM: "Sua empresa possui uma lista com todos os dados pessoais que coleta dos clientes (como nome, e-mail, CPF), para que usa cada dado e por quanto tempo guarda?"
- Exemplo RUIM: "Há ROPA formalizado com finalidade e base legal mapeadas?"`,

    intermediario: `PÚBLICO-ALVO: analista, profissional de RH, jurídico ou gestor com conhecimento básico de LGPD.
- Use terminologia LGPD com contexto prático (explique brevemente a exigência legal ao formular).
- Oriente as perguntas a processos, documentos e responsabilidades.
- Exemplo BOM: "A empresa possui uma Política de Privacidade publicada e atualizada, descrevendo quais dados coleta, para que finalidade e com qual base legal (conforme exige o Art. 9º da LGPD)?"
- Exemplo RUIM: "Art. 9º compliance status?"`,

    tecnico: `PÚBLICO-ALVO: DPO, CISO, analista sênior ou profissional jurídico especializado.
- Use terminologia técnica e jurídica precisa.
- Referencie artigos da LGPD e controles normativos (ISO 27001, CIS Controls, NIST CSF) diretamente no texto da pergunta.
- Exemplo BOM: "Os sistemas que tratam dados pessoais aplicam controle de acesso por mínimo privilégio com MFA obrigatório para acessos privilegiados (LGPD Art. 46 / ISO 27001 A.9 / CIS Control 6)?"
- Exemplo RUIM: "Tem controle de acesso?"`,
  };

  const nivelLabel = { basico: 'Iniciante', intermediario: 'Intermediário', tecnico: 'Especialista' };

  const escalaInstrucao = `
ESCALA DE RESPOSTA OBRIGATÓRIA:
Cada pergunta DEVE ser respondível na seguinte escala de 0 a 4:
  0 = Não implementado — a prática não existe na organização
  1 = Iniciado — há intenção ou esforço pontual, mas sem processo formal
  2 = Parcial — existe, mas incompleto, inconsistente ou sem documentação
  3 = Avançado — implementado e funcional, mas sem revisão/auditoria periódica
  4 = Implementado — totalmente formalizado, documentado e revisado periodicamente

REGRAS CRÍTICAS PARA FORMULAR AS PERGUNTAS:
1. Cada pergunta deve avaliar UM único controle ou prática de conformidade.
2. A pergunta deve ser objetiva: o respondente deve conseguir se posicionar claramente em 0, 1, 2, 3 ou 4.
3. PROIBIDO fazer perguntas de sim/não (ex: "Você tem política de privacidade?"). Reformule para avaliar GRAU de maturidade (ex: "Em que medida a Política de Privacidade está formalizada, publicada e mantida atualizada?").
4. PROIBIDO perguntas compostas com "e/ou" que avaliem duas práticas ao mesmo tempo.
5. O respondente também pode marcar "Não sei responder" — portanto, perguntas muito técnicas demais para o perfil devem ser evitadas.`;

  return `Você é um especialista sênior em conformidade com LGPD, ISO/IEC 27001:2022, CIS Controls v8 e NIST CSF 2.0. Sua tarefa é gerar um questionário de avaliação de maturidade em proteção de dados.

═══════════════════════════════════════
PERFIL DO RESPONDENTE
═══════════════════════════════════════
Nível de conhecimento: ${nivelLabel[pc.nivel] || pc.nivel}
Cargo / Função: ${pc.cargo || currentUser?.cargo || 'não informado'}
Área de atuação: ${pc.area || 'não informada'}

INSTRUÇÃO DE LINGUAGEM PARA ESTE PERFIL:
${nivelInstrucao[pc.nivel] || nivelInstrucao.intermediario}

═══════════════════════════════════════
PERFIL DA ORGANIZAÇÃO
═══════════════════════════════════════
Empresa: ${po.nome || 'não informado'}
Porte: ${po.porte}
Setor: ${po.setor}
Colaboradores: ${po.colaboradores || 'não informado'}
Dados pessoais tratados: ${po.dados_tratados_label || po.dados_tratados?.join(', ') || 'não especificado'}
Políticas já existentes: ${(po.politicas || []).length} de 4 informadas
Setor com dados sensíveis: ${po.setor_sensivel ? 'SIM — inclua 2 perguntas sobre dados sensíveis (LGPD Art. 11)' : 'NÃO'}

═══════════════════════════════════════
${escalaInstrucao}

═══════════════════════════════════════
DISTRIBUIÇÃO OBRIGATÓRIA — 20 PERGUNTAS
═══════════════════════════════════════
Gere exatamente 20 perguntas distribuídas assim (sem repetir escopos dentro de cada categoria):

1. base-legal (4 perguntas): mapeamento de bases legais, política de privacidade, registro de consentimento, princípio da minimização
2. direitos (3 perguntas): canal de atendimento ao titular, prazo de resposta a solicitações, portabilidade de dados
3. segurança (4 perguntas): controle de acesso e autenticação, criptografia de dados, backup e recuperação, inventário de ativos
4. compartilhamento (3 perguntas): contratos com fornecedores (DPA), transferência internacional, registro de operações (ROPA)
5. incidentes (3 perguntas): plano de resposta a incidentes, notificação à ANPD em 72h, simulações e testes
6. governança (3 perguntas): designação do DPO, programa de treinamento, revisão periódica do programa de conformidade

PESOS:
- peso 3 = controle crítico (use no máximo 6 vezes no total)
- peso 2 = controle importante
- peso 1 = boa prática recomendada

═══════════════════════════════════════
FORMATO DE SAÍDA — APENAS JSON VÁLIDO
═══════════════════════════════════════
Retorne SOMENTE o JSON abaixo, sem texto antes ou depois, sem blocos de código markdown:

{"perguntas":[{"id":1,"texto":"texto da pergunta aqui","categoria":"base-legal","peso":2,"framework":"LGPD Art. 7º"},{"id":2,"texto":"...","categoria":"direitos","peso":3,"framework":"LGPD Art. 18"}]}

Categorias válidas: base-legal | direitos | segurança | compartilhamento | incidentes | governança
Pesos válidos: 1 | 2 | 3`;
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

async function confirmarVoltarQuestionario() {
  if (Object.keys(evalAnswers).length > 0 || Object.keys(evalSkipped).length > 0) {
    const ok = await showConfirm(
      'Sair do questionário',
      'Suas respostas serão salvas como rascunho e você poderá retomar de onde parou.',
      { okLabel: 'Sair e salvar', cancelLabel: 'Continuar respondendo', type: 'warn' }
    );
    if (!ok) return;
    saveDraft();
  }
  evalAnswers = {}; evalSkipped = {}; evalQuestions = []; cogLevel = null; evalFromAI = false;
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

  const historicoQA = evalQuestions.map(q => ({
    ordem: q.id, texto: q.texto, categoria: q.categoria, peso: q.peso,
    framework: q.framework || '', ignorada: !!evalSkipped[q.id],
    resposta: evalSkipped[q.id] ? null : (evalAnswers[q.id] ?? null),
  }));

  const payload = {
    empresa: d.empresa, setor: d.setor, porte: d.porte, nivel_usuario: cogLevel,
    indice, nivel_maturidade: ni.nome, area_scores: areaScores,
    diagnostico: rel.diagnostico || '', plano_acao: rel.plano_acao || '',
    perguntas_ignoradas: totalIgnoradas, desconto_aplicado: descontoAplicado,
    recomendacoes: (rel.recomendacoes || []).map((r, i) => ({
      prioridade: r.prioridade || 'media', acao: r.acao || '',
      prazo_dias: parseInt(r.prazo) || 30, concluida: false, ordem: i,
    })),
    historico_qa: historicoQA,
  };

  try {
    const saved = await api('POST', 'avaliacoes/', payload);
    avaliacoes.unshift(saved);
    await clearDraft();
  } catch (e) { console.warn('Erro ao salvar avaliação:', e); }

  renderResultado(indice, ni, areaScores, rel, d);
  showEvalStep(4); updateEvalSteps(2);
}

// ── Relatório via proxy ───────────────────────────────
async function gerarRelatorio(indice, ni, areaScores, d) {
  const instrRelatorio = {
    basico: `Linguagem simples, sem jargões. Escreva como se fosse uma orientação direta ao dono da empresa. Se houver perguntas ignoradas (${d.totalIgnoradas}), explique em palavras simples que o resultado pode estar subestimando o risco real. Se índice < 60% ou ignoradas > 3, inclua obrigatoriamente uma recomendação para buscar ajuda de um especialista ou advogado em LGPD.`,
    intermediario: `Use termos da LGPD com contexto prático. Verbos de ação: Revise, Documente, Formalize, Valide, Implemente. Mencione artigos relevantes quando agregar valor.`,
    tecnico: `Linguagem técnica e jurídica precisa. Referencie artigos da LGPD, controles ISO 27001, CIS Controls e NIST CSF nas recomendações. Seja direto e objetivo.`,
  };

  const prompt = `Você é um especialista sênior em conformidade com LGPD. Gere um relatório de avaliação de maturidade em JSON.

═══════════════════════════════════════
DADOS DA AVALIAÇÃO
═══════════════════════════════════════
Índice de conformidade: ${indice}%
Nível de maturidade: ${ni.nome}
Empresa: ${d.empresa} (${d.porte}) — Setor: ${d.setor}
Perfil do respondente: ${d.level}
Perguntas ignoradas ("Não sei responder"): ${d.totalIgnoradas}
Desconto aplicado por desconhecimento: ${d.descontoAplicado} pontos
Scores por área: ${JSON.stringify(areaScores)}

═══════════════════════════════════════
INSTRUÇÃO DE LINGUAGEM
═══════════════════════════════════════
${instrRelatorio[d.level] || instrRelatorio.intermediario}

═══════════════════════════════════════
REGRAS DO RELATÓRIO
═══════════════════════════════════════
1. diagnostico: parágrafo único e objetivo resumindo o estado atual de conformidade, destacando pontos fortes e áreas críticas.
2. areas_criticas: liste apenas as áreas com score abaixo de 40%. Se nenhuma, retorne array vazio.
3. recomendacoes: máximo 5 recomendações priorizadas. Cada uma deve ser uma ação concreta e executável (não vaga). prazo = apenas o número inteiro de dias.
4. plano_acao: frase curta indicando por onde começar e qual é a sequência lógica de ação.

═══════════════════════════════════════
FORMATO DE SAÍDA — APENAS JSON VÁLIDO
═══════════════════════════════════════
Retorne SOMENTE o JSON abaixo, sem texto antes ou depois, sem blocos de código markdown:

{"diagnostico":"...","areas_criticas":["..."],"recomendacoes":[{"prioridade":"alta","acao":"ação concreta aqui","prazo":"30"}],"plano_acao":"..."}

Valores válidos para prioridade: alta | media | baixa`;

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
