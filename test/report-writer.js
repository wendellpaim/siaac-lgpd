/** Acumula resultados dos eixos para o relatório test/resultado_avaliacao.txt */
const fs = require('fs');
const path = require('path');

const REPORT_PATH = path.join(__dirname, 'resultado_avaliacao.txt');

const report = {
  gerado_em: null,
  eixo1: null,
  eixo2: null,
  eixo3: null,
  iso25010: null,
  resumo_jest: null,
};

function setEixo1(data) {
  report.eixo1 = data;
}

function setEixo2(data) {
  report.eixo2 = data;
}

function setEixo3(data) {
  report.eixo3 = data;
}

function setIso25010(data) {
  report.iso25010 = data;
}

function setResumoJest(data) {
  report.resumo_jest = data;
}

function formatarRelatorio() {
  const linhas = [];
  const sep = '═'.repeat(72);

  linhas.push('RELATÓRIO DE AVALIAÇÃO AUTOMATIZADA — SIAAC-LGPD');
  linhas.push(`Gerado em: ${report.gerado_em}`);
  linhas.push(sep);

  if (report.eixo1) {
    linhas.push('');
    linhas.push('EIXO 1 — COBERTURA NORMATIVA (Art. 6º, 37, 46, 48, 49 LGPD)');
    linhas.push(`Resultado: ${report.eixo1.total}/5 artigos referenciados`);
    linhas.push(`Status: ${report.eixo1.aprovado ? 'APROVADO ✓' : 'REPROVADO ✗'}`);
    Object.entries(report.eixo1.refs).forEach(([art, ok]) => {
      linhas.push(`  Art. ${art}º: ${ok ? 'referenciado' : 'AUSENTE'}`);
    });
  }

  if (report.eixo2) {
    linhas.push('');
    linhas.push('EIXO 2 — CONSISTÊNCIA DO MODELO');
    linhas.push(`Verificação global índice(4) > índice(0): ${report.eixo2.monotonia_extrema_ok ? 'OK ✓' : 'FALHOU ✗'}`);
    linhas.push(`Ordenação C1 < C2 < C3 (respostas representativas): ${report.eixo2.ordenacao_cenarios_ok ? 'OK ✓' : 'FALHOU ✗'}`);
    linhas.push('');
    report.eixo2.cenarios.forEach((c) => {
      linhas.push(`  ${c.id} — ${c.nome}`);
      linhas.push(`    Respostas todas 0 → índice: ${c.indice_min}% (nível: ${c.nivel_min})`);
      linhas.push(`    Respostas todas 4 → índice: ${c.indice_max}% (nível: ${c.nivel_max})`);
      linhas.push(`    Respostas representativas (${c.valor_representativo}) → índice: ${c.indice_repr}%`);
    });
    linhas.push('');
    linhas.push(`  Índices representativos: C1=${report.eixo2.indices_repr.C1}% | C2=${report.eixo2.indices_repr.C2}% | C3=${report.eixo2.indices_repr.C3}%`);
  }

  if (report.eixo3) {
    linhas.push('');
    linhas.push('EIXO 3 — QUALIDADE DAS RECOMENDAÇÕES (rubrica 0–8 por recomendação)');
    report.eixo3.cenarios.forEach((c) => {
      linhas.push('');
      linhas.push(`  ${c.id} — ${c.nome}`);
      linhas.push(`    Classificação geral: ${c.classificacao} (média ${c.media}/8)`);
      linhas.push('    Critérios (a–d): clareza | citação LGPD | ISO/CIS/NIST | aplicabilidade PME');
      c.itens.forEach((item, i) => {
        linhas.push(
          `      [${i + 1}] ${item.classificacao} (${item.pontos}/8) — cl=${item.clareza} lgpd=${item.citacao_lgpd} fw=${item.mapeamento_framework} pme=${item.aplicabilidade_pme}`
        );
        linhas.push(`          "${item.acao.slice(0, 90)}${item.acao.length > 90 ? '…' : ''}"`);
      });
    });
  }

  if (report.iso25010) {
    linhas.push('');
    linhas.push('ARQUITETURA ISO/IEC 25010');
    report.iso25010.itens.forEach((item) => {
      linhas.push(`  [${item.criterio}] ${item.descricao}: ${item.ok ? 'OK ✓' : 'FALHOU ✗'}`);
    });
  }

  if (report.resumo_jest) {
    linhas.push('');
    linhas.push(sep);
    linhas.push(`Jest: ${report.resumo_jest.passed} aprovados, ${report.resumo_jest.failed} falhas, ${report.resumo_jest.total} total`);
    linhas.push(`Suite: ${report.resumo_jest.status}`);
  }

  linhas.push('');
  return linhas.join('\n');
}

function escreverRelatorio() {
  report.gerado_em = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, formatarRelatorio(), 'utf8');
}

module.exports = {
  report,
  setEixo1,
  setEixo2,
  setEixo3,
  setIso25010,
  setResumoJest,
  escreverRelatorio,
  REPORT_PATH,
};
