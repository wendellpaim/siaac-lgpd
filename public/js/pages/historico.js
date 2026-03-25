// ═══════════════════════════════════════════════════
//  SIAAC-LGPD v2.0 — Histórico & Modal de Detalhe
// ═══════════════════════════════════════════════════

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
                : q.resposta != null ? `<span style="font-size:11px;font-weight:600;color:${cor};margin-left:auto">${q.resposta} — ${LKRL[q.resposta] || ''}</span>`
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

// ── Exclusão de avaliação ──────────────────────────────
async function excluirAv(avId) {
  const ok = await showConfirm(
    'Remover avaliação',
    'Deseja remover esta avaliação do histórico?<br><span style="color:var(--danger);font-size:12px">Esta ação não pode ser desfeita.</span>',
    { okLabel: 'Remover', type: 'danger' }
  );
  if (!ok) return;
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
