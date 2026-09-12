/**
 * Suite de testes SIAAC-LGPD — TCC IFBA 2026
 * Cobre Eixos 1–3 da pesquisa e critérios ISO/IEC 25010.
 *
 * Executar: npm run test:avaliacao
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const core = require('../src/lib/avaliacao-core');
const {
  setEixo1,
  setEixo2,
  setEixo3,
  setIso25010,
} = require('./report-writer');

const cenariosFixture = require('./fixtures/cenarios.json');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const GEMINI_ROUTE = path.join(__dirname, '..', 'src', 'routes', 'gemini.js');

let app;

beforeAll(() => {
  app = createApp();
});

// ─────────────────────────────────────────────────────────────────────────────
// EIXO 1 — COBERTURA NORMATIVA
// Critério: perguntas do banco fallback referenciam Art. 6º, 37, 46, 48 e 49
// ─────────────────────────────────────────────────────────────────────────────
describe('EIXO 1 — Cobertura normativa LGPD', () => {
  test('banco fallback cobre os 5 artigos obrigatórios (6, 37, 46, 48, 49)', () => {
    const niveis = ['basico', 'intermediario', 'tecnico'];
    const auditorias = niveis.map((nivel) => {
      const po = cenariosFixture.cenarios.find((c) => c.perfil_usuario.nivel === nivel)?.perfil_org || {};
      const perguntas = core.fallbackQ(po, nivel);
      return { nivel, ...core.auditarCoberturaNormativa(perguntas) };
    });

    const consolidado = core.ARTIGOS_LGPD_OBRIGATORIOS.reduce((acc, art) => {
      acc[art] = auditorias.some((a) => a.refs[art]);
      return acc;
    }, {});
    const total = core.ARTIGOS_LGPD_OBRIGATORIOS.filter((a) => consolidado[a]).length;

    setEixo1({ refs: consolidado, total, aprovado: total === 5 });

    expect(total).toBe(5);
    core.ARTIGOS_LGPD_OBRIGATORIOS.forEach((art) => {
      expect(consolidado[art]).toBe(true);
    });
  });

  test('parseQ extrai perguntas com campo framework para auditoria normativa', () => {
    const json = JSON.stringify({
      perguntas: [
        { id: 1, texto: 'Minimização de dados?', categoria: 'base-legal', peso: 2, framework: 'LGPD Art. 6º III' },
        { id: 2, texto: 'ROPA atualizado?', categoria: 'compartilhamento', peso: 2, framework: 'LGPD Art. 37' },
      ],
    });
    const parsed = core.parseQ(json);
    const audit = core.auditarCoberturaNormativa(parsed);
    expect(parsed).toHaveLength(2);
    expect(audit.refs['6']).toBe(true);
    expect(audit.refs['37']).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EIXO 2 — CONSISTÊNCIA DO MODELO
// Critério: índice(4) > índice(0); ordenação C1 < C2 < C3 com respostas representativas
// ─────────────────────────────────────────────────────────────────────────────
describe('EIXO 2 — Consistência do modelo', () => {
  const resultadosEixo2 = [];

  cenariosFixture.cenarios.forEach((cenario) => {
    test(`${cenario.id}: respostas extremas e representativas`, () => {
      const { perfil_usuario, perfil_org } = cenario;
      const perguntas = core.fallbackQ(perfil_org, perfil_usuario.nivel);

      const ans0 = core.respostasUniformes(perguntas, 0);
      const ans4 = core.respostasUniformes(perguntas, 4);
      const ansRepr = core.respostasUniformes(perguntas, cenario.respostas_representativas);

      const r0 = core.calcularIndice(perguntas, ans0, {}, perfil_usuario.nivel);
      const r4 = core.calcularIndice(perguntas, ans4, {}, perfil_usuario.nivel);
      const rRepr = core.calcularIndice(perguntas, ansRepr, {}, perfil_usuario.nivel);

      expect(r4.indice).toBeGreaterThan(r0.indice);
      expect(r0.indice).toBe(0);
      expect(r4.indice).toBe(100);

      resultadosEixo2.push({
        id: cenario.id,
        nome: cenario.nome,
        indice_min: r0.indice,
        indice_max: r4.indice,
        indice_repr: rRepr.indice,
        nivel_min: r0.nivel.nome,
        nivel_max: r4.nivel.nome,
        valor_representativo: cenario.respostas_representativas,
      });
    });
  });

  test('ordenação C1 < C2 < C3 com respostas representativas por perfil', () => {
    const indices = {};
    cenariosFixture.cenarios.forEach((cenario) => {
      const perguntas = core.fallbackQ(cenario.perfil_org, cenario.perfil_usuario.nivel);
      const ans = core.respostasUniformes(perguntas, cenario.respostas_representativas);
      indices[cenario.id] = core.calcularIndice(perguntas, ans, {}, cenario.perfil_usuario.nivel).indice;
    });

    const monotoniaExtremaOk = resultadosEixo2.every((r) => r.indice_max > r.indice_min);
    const ordenacaoOk = indices.C1 < indices.C2 && indices.C2 < indices.C3;

    setEixo2({
      cenarios: resultadosEixo2,
      indices_repr: indices,
      monotonia_extrema_ok: monotoniaExtremaOk,
      ordenacao_cenarios_ok: ordenacaoOk,
    });

    expect(indices.C1).toBeLessThan(indices.C2);
    expect(indices.C2).toBeLessThan(indices.C3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EIXO 3 — QUALIDADE DAS RECOMENDAÇÕES
// Critério rubrica: (a) clareza (b) citação LGPD (c) ISO/CIS/NIST (d) aplicabilidade PME
// ─────────────────────────────────────────────────────────────────────────────
describe('EIXO 3 — Qualidade das recomendações', () => {
  const resultadosEixo3 = [];

  cenariosFixture.cenarios.forEach((cenario) => {
    test(`${cenario.id}: rubrica de recomendações fallback`, () => {
      const { perfil_usuario, perfil_org } = cenario;
      const perguntas = core.fallbackQ(perfil_org, perfil_usuario.nivel);
      const ans = core.respostasUniformes(perguntas, cenario.respostas_representativas);
      const { indice, areaScores, nivel } = core.calcularIndice(
        perguntas,
        ans,
        {},
        perfil_usuario.nivel
      );

      const rel = core.fallbackRel(indice, nivel, areaScores, {
        empresa: perfil_org.nome,
        porte: perfil_org.porte,
        setor: perfil_org.setor,
        level: perfil_usuario.nivel,
      });

      const rubrica = core.avaliarRecomendacoesCenario(
        rel.recomendacoes,
        perfil_usuario.nivel,
        perfil_org.porte
      );

      resultadosEixo3.push({
        id: cenario.id,
        nome: cenario.nome,
        classificacao: rubrica.classificacao,
        media: rubrica.media,
        itens: rubrica.itens,
      });

      expect(rel.recomendacoes.length).toBeGreaterThan(0);
      expect(rubrica.media).toBeGreaterThanOrEqual(3);

      if (cenario.id === 'C1') {
        rubrica.itens.forEach((item) => {
          expect(item.clareza).toBeGreaterThanOrEqual(1);
          expect(item.aplicabilidade_pme).toBeGreaterThanOrEqual(1);
        });
      }
      if (cenario.id === 'C3') {
        const comFramework = rubrica.itens.some((i) => i.mapeamento_framework >= 2);
        const comLgpd = rubrica.itens.some((i) => i.citacao_lgpd >= 2);
        expect(comFramework || comLgpd).toBe(true);
      }
    });
  });

  test('registra classificação rubrica por cenário no relatório', () => {
    setEixo3({ cenarios: resultadosEixo3 });
    resultadosEixo3.forEach((r) => {
      expect(['Parcial', 'Adequado', 'Excelente']).toContain(r.classificacao);
      expect(r.media).toBeGreaterThanOrEqual(3);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ISO/IEC 25010 — Segurança, Modularidade, Confiabilidade, Manutenibilidade
// ─────────────────────────────────────────────────────────────────────────────
describe('ISO/IEC 25010 — Atributos de qualidade', () => {
  test('Segurança: credenciais Gemini ausentes no frontend', () => {
    const jsFiles = listarArquivosRecursivo(PUBLIC_DIR, '.js');
    const violacoes = [];
    jsFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf8');
      if (/GEMINI_API_KEY|generativelanguage\.googleapis\.com|X-goog-api-key/i.test(content)) {
        violacoes.push(path.relative(process.cwd(), file));
      }
    });
    expect(violacoes).toEqual([]);
  });

  test('Modularidade: cálculo de índice isolado em src/lib/avaliacao-core.js', () => {
    const geminiSrc = fs.readFileSync(GEMINI_ROUTE, 'utf8');
    expect(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'avaliacao-core.js'))).toBe(true);
    expect(geminiSrc).not.toMatch(/calcularIndice|svp\s*\/\s*sp/);
    expect(typeof core.calcularIndice).toBe('function');
  });

  test('Confiabilidade: fallback ativo quando GEMINI_API_KEY ausente', async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
    const res = await request(app)
      .post('/api/gemini')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'teste' });
    if (saved) process.env.GEMINI_API_KEY = saved;
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/GEMINI_API_KEY/i);

    const perguntas = core.fallbackQ({}, 'basico');
    expect(perguntas.length).toBeGreaterThanOrEqual(10);
  });

  test('Manutenibilidade: rotas organizadas por recurso (/api/auth, /api/avaliacoes, /api/gemini)', () => {
    const routesDir = path.join(__dirname, '..', 'src', 'routes');
    const esperados = ['auth.js', 'avaliacoes.js', 'gemini.js'];
    esperados.forEach((f) => expect(fs.existsSync(path.join(routesDir, f))).toBe(true));
  });

  test('registra resultados ISO/IEC 25010 no relatório', async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
    const geminiRes = await request(app)
      .post('/api/gemini')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'x' });
    if (saved) process.env.GEMINI_API_KEY = saved;

    const jsFiles = listarArquivosRecursivo(PUBLIC_DIR, '.js');
    const frontendSeguro = jsFiles.every((file) => {
      const c = fs.readFileSync(file, 'utf8');
      return !/GEMINI_API_KEY|generativelanguage\.googleapis\.com/i.test(c);
    });

    setIso25010({
      itens: [
        { criterio: 'Segurança', descricao: 'Credenciais não expostas no frontend', ok: frontendSeguro },
        { criterio: 'Modularidade', descricao: 'Cálculo separado do LLM (avaliacao-core.js)', ok: true },
        { criterio: 'Confiabilidade', descricao: 'Fallback sem API Gemini (503 + fallbackQ)', ok: geminiRes.status === 503 },
        {
          criterio: 'Manutenibilidade',
          descricao: 'Rotas por recurso (auth, avaliacoes, gemini)',
          ok: ['auth.js', 'avaliacoes.js', 'gemini.js'].every((f) =>
            fs.existsSync(path.join(__dirname, '..', 'src', 'routes', f))
          ),
        },
      ],
    });

    expect(frontendSeguro).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API — smoke tests Supertest
// ─────────────────────────────────────────────────────────────────────────────
describe('API REST — smoke tests', () => {
  test('GET /api/auth/me exige autenticação', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('POST /api/gemini exige prompt', async () => {
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
    const res = await request(app)
      .post('/api/gemini')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

function listarArquivosRecursivo(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  fs.readdirSync(dir).forEach((name) => {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...listarArquivosRecursivo(full, ext));
    else if (full.endsWith(ext)) out.push(full);
  });
  return out;
}
