// ═══════════════════════════════════════════════════
//  SIAAC-LGPD v2.0 — Perfil do Usuário
// ═══════════════════════════════════════════════════

function renderPerfil() {
  const u = currentUser;
  if (!u) return;

  // Backend retorna o nome no campo 'nome'
  const nome = u.nome || u.nome_completo || u.email;
  const ini = nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  document.getElementById('pf-av').textContent = ini;
  document.getElementById('pf-nome').textContent = nome;
  document.getElementById('pf-email').textContent = u.email;

  // Cargo: perfil salvo → cadastro original
  const pc = u.perfil || {};
  document.getElementById('pf-cargo').textContent = pc.cargo || u.cargo || '';

  // Empresa: perfil_org → cadastro original
  const po = u.perfil_org || {};
  document.getElementById('pf-empresa').textContent = po.nome || u.empresa || '—';
  document.getElementById('pf-total').textContent =
    avaliacoes.length + ' avaliação' + (avaliacoes.length !== 1 ? 'ões' : '');

  // ── Campos de edição: perfil de usuário ──
  document.getElementById('edit-pc-cargo').value = pc.cargo || u.cargo || '';
  setSelectVal('edit-pc-area', pc.area);

  if (pc.nivel) {
    const lmap = { basico: 0, intermediario: 1, tecnico: 2 };
    const idx = lmap[pc.nivel];
    document.querySelectorAll('#edit-level-grid .lcard').forEach(c => c.classList.remove('sel'));
    if (idx !== undefined) document.querySelectorAll('#edit-level-grid .lcard')[idx]?.classList.add('sel');
    editCogLevel = pc.nivel;
  }

  // ── Campos de edição: perfil organizacional ──
  document.getElementById('edit-po-nome').value = po.nome || u.empresa || '';
  setSelectVal('edit-po-porte', po.porte);
  setSelectVal('edit-po-setor', po.setor);
  setSelectVal('edit-po-colab', po.colaboradores);
  document.getElementById('edit-po-equip').value = po.equipamentos_ti || '';

  const dados = po.dados_tratados || [];
  ['cpf', 'saude', 'fin', 'bio', 'cri', 'loc', 'comp'].forEach(d => {
    const el = document.getElementById('ed-' + d);
    if (el) el.checked = dados.includes(d);
  });

  const pols = po.politicas || [];
  ['priv', 'dpo', 'trei', 'map'].forEach(p => {
    const el = document.getElementById('ed-' + p);
    if (el) el.checked = pols.includes(p);
  });
}

function setSelectVal(id, val) {
  const el = document.getElementById(id);
  if (!el || !val) return;
  for (const opt of el.options) {
    if (opt.value === val || opt.textContent === val) { el.value = opt.value; break; }
  }
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
  const cargo = document.getElementById('edit-pc-cargo').value.trim();
  const area  = document.getElementById('edit-pc-area').value;
  if (!level) { alert('Selecione o nível de conhecimento.'); return; }
  try {
    await api('PATCH', 'auth/perfil/', { nivel: level, area, cargo });
    if (!currentUser.perfil) currentUser.perfil = {};
    currentUser.perfil.nivel = level;
    currentUser.perfil.area  = area;
    currentUser.perfil.cargo = cargo;
    document.getElementById('pf-cargo').textContent = cargo;
    document.getElementById('edit-cog-ok').style.display = 'block';
    setTimeout(() => { document.getElementById('edit-cog-ok').style.display = 'none'; }, 3000);
  } catch (e) { alert('Erro ao salvar: ' + e.message); }
}

async function salvarPerfilOrg() {
  const nome          = document.getElementById('edit-po-nome').value.trim();
  const porte         = document.getElementById('edit-po-porte').value;
  const setor         = document.getElementById('edit-po-setor').value;
  const colaboradores = document.getElementById('edit-po-colab').value;
  const equipamentos_ti = document.getElementById('edit-po-equip').value || null;
  if (!porte || !setor) { alert('Preencha porte e setor.'); return; }
  const dados_tratados = ['cpf', 'saude', 'fin', 'bio', 'cri', 'loc', 'comp']
    .filter(d => document.getElementById('ed-' + d)?.checked);
  const politicas = ['priv', 'dpo', 'trei', 'map']
    .filter(p => document.getElementById('ed-' + p)?.checked);
  try {
    const updated = await api('PATCH', 'auth/perfil-org/',
      { nome, porte, setor, colaboradores, equipamentos_ti, dados_tratados, politicas });
    currentUser.perfil_org = updated;
    document.getElementById('pf-empresa').textContent = nome || '—';
    document.getElementById('edit-org-ok').style.display = 'block';
    setTimeout(() => { document.getElementById('edit-org-ok').style.display = 'none'; }, 3000);
  } catch (e) { alert('Erro ao salvar: ' + e.message); }
}

async function confirmarExcluirDados() {
  const ok = await showConfirm(
    'Excluir histórico de avaliações',
    'Isso removerá <strong>todo o histórico</strong> de avaliações da sua conta.<br>Seus dados de perfil serão mantidos.',
    { okLabel: 'Excluir tudo', type: 'danger' }
  );
  if (!ok) return;
  try {
    await api('DELETE', 'avaliacoes/clear/');
    avaliacoes = [];
    renderPerfil();
    renderDashboard();
    const btn = document.querySelector('[onclick="confirmarExcluirDados()"]');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Histórico removido';
      btn.disabled = true;
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2500);
    }
  } catch (e) {
    alert('Erro ao remover histórico: ' + (e.message || 'tente novamente.'));
  }
}
