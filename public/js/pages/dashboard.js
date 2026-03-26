// ═══════════════════════════════════════════════════
//  SIAAC-LGPD v2.0 — Dashboard
// ═══════════════════════════════════════════════════

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
  document.getElementById('dash-greeting').textContent = 'Olá, ' + ((currentUser?.nome || currentUser?.nome_completo || '')?.split(' ')[0] || '') + ' 👋';
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
