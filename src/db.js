// src/db.js
// Banco de dados usando lowdb v1 (JSON puro — sem compilação C++, funciona no Windows sem configuração)
// Versão lowdb: 1.0.0 | Armazena dados em siaac.json na raiz do projeto

const low  = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const crypto = require('crypto');

const adapter = new FileSync(path.join(__dirname, '..', 'siaac.json'));
const db = low(adapter);

// Estrutura inicial do banco
db.defaults({
  usuarios: [],
  perfis_usuario: [],
  perfis_org: [],
  avaliacoes: [],
  recomendacoes: [],
  historico_qa: [],
  rascunhos: [],
  _seq: { usuarios: 0, avaliacoes: 0, recomendacoes: 0, historico_qa: 0, rascunhos: 0 }
}).write();

// Gerador de IDs sequenciais
function nextId(table) {
  const val = db.get(`_seq.${table}`).value() + 1;
  db.set(`_seq.${table}`, val).write();
  return val;
}

function now() { return new Date().toISOString(); }

// ═══════ USUARIOS ═══════
const usuarios = {
  findByEmail: (email) =>
    db.get('usuarios').find({ email: email.toLowerCase() }).value(),

  findById: (id) => {
    const u = db.get('usuarios').find({ id }).value();
    if (!u) return null;
    const { senha_hash, ...safe } = u;
    return safe;
  },

  create: (nome, email, senhaHash, cargo = '', empresa = '') => {
    const id = nextId('usuarios');
    db.get('usuarios').push({
      id, nome, email: email.toLowerCase(), senha_hash: senhaHash,
      cargo, empresa, criado_em: now()
    }).write();
    // Cria perfis vazios
    db.get('perfis_usuario').push({ id, user_id: id, nivel: '', area: '', lgpd_exp: '' }).write();
    db.get('perfis_org').push({
      id, user_id: id, nome: '', porte: '', setor: '',
      colaboradores: '', equipamentos: 0,
      dados_tratados: [], politicas: []
    }).write();
    return id;
  },
};

// ═══════ PERFIS ═══════
const perfis = {
  getUsuario: (userId) =>
    db.get('perfis_usuario').find({ user_id: userId }).value() || {},

  getOrg: (userId) => {
    const p = db.get('perfis_org').find({ user_id: userId }).value() || {};
    const SETORES_SENSIVEIS = ['Saúde / Clínicas', 'Financeiro / Fintechs', 'Educação'];
    const dadosLabel = { cpf:'CPF/RG', saude:'Saúde', fin:'Financeiros', bio:'Biométricos', cri:'Crianças', loc:'Localização', comp:'Comportamentais' };
    return {
      ...p,
      setor_sensivel: SETORES_SENSIVEIS.includes(p.setor),
      dados_tratados_label: (p.dados_tratados || []).map(d => dadosLabel[d] || d).join(', ') || 'não especificado'
    };
  },

  updateUsuario: (userId, { nivel, area, lgpd_exp }) => {
    db.get('perfis_usuario')
      .find({ user_id: userId })
      .assign({ nivel: nivel || '', area: area || '', lgpd_exp: lgpd_exp || '' })
      .write();
  },

  updateOrg: (userId, data) => {
    db.get('perfis_org')
      .find({ user_id: userId })
      .assign({
        nome: data.nome || '',
        porte: data.porte || '',
        setor: data.setor || '',
        colaboradores: data.colaboradores || '',
        equipamentos: data.equipamentos || 0,
        dados_tratados: data.dados_tratados || [],
        politicas: data.politicas || []
      })
      .write();
  },
};

// ═══════ AVALIACOES ═══════
function buildAvaliacao(av) {
  return {
    ...av,
    recomendacoes: db.get('recomendacoes')
      .filter({ avaliacao_id: av.id })
      .sortBy('ordem')
      .value(),
  };
}

function buildAvaliacaoDetail(av) {
  return {
    ...buildAvaliacao(av),
    historico_qa: db.get('historico_qa')
      .filter({ avaliacao_id: av.id })
      .sortBy('ordem')
      .value(),
  };
}

const avaliacoes = {
  list: (userId) =>
    db.get('avaliacoes')
      .filter({ user_id: userId })
      .sortBy(av => new Date(av.criado_em))
      .reverse()
      .value()
      .map(buildAvaliacao),

  getById: (id, userId) => {
    const av = db.get('avaliacoes').find({ id, user_id: userId }).value();
    return av ? buildAvaliacaoDetail(av) : null;
  },

  create: (userId, data) => {
    const id = nextId('avaliacoes');
    db.get('avaliacoes').push({
      id,
      user_id: userId,
      empresa: data.empresa || '',
      setor: data.setor || '',
      porte: data.porte || '',
      nivel_usuario: data.nivel_usuario || '',
      indice: data.indice || 0,
      nivel_maturidade: data.nivel_maturidade || '',
      area_scores: data.area_scores || {},
      diagnostico: data.diagnostico || '',
      plano_acao: data.plano_acao || '',
      perguntas_ignoradas: data.perguntas_ignoradas || 0,
      desconto_aplicado: data.desconto_aplicado || 0,
      criado_em: now()
    }).write();

    // Recomendações
    (data.recomendacoes || []).forEach((rec, i) => {
      const recId = nextId('recomendacoes');
      db.get('recomendacoes').push({
        id: recId, avaliacao_id: id, ordem: i,
        prioridade: rec.prioridade || 'media',
        acao: rec.acao || '',
        prazo_dias: rec.prazo_dias || 30,
        concluida: false
      }).write();
    });

    // Histórico Q&A
    (data.historico_qa || []).forEach(qa => {
      db.get('historico_qa').push({
        id: nextId('historico_qa'),
        avaliacao_id: id,
        ordem: qa.ordem || 0,
        texto: qa.texto || '',
        categoria: qa.categoria || '',
        peso: qa.peso || 1,
        framework: qa.framework || '',
        resposta: qa.resposta !== undefined ? qa.resposta : null,
        ignorada: qa.ignorada || false
      }).write();
    });

    // Limpa rascunho
    db.get('rascunhos').remove({ user_id: userId }).write();

    return id;
  },

  delete: (id, userId) => {
    const av = db.get('avaliacoes').find({ id, user_id: userId }).value();
    if (!av) return 0;
    db.get('recomendacoes').remove({ avaliacao_id: id }).write();
    db.get('historico_qa').remove({ avaliacao_id: id }).write();
    db.get('avaliacoes').remove({ id, user_id: userId }).write();
    return 1;
  },

  deleteAll: (userId) => {
    const avIds = db.get('avaliacoes').filter({ user_id: userId }).map('id').value();
    avIds.forEach(id => {
      db.get('recomendacoes').remove({ avaliacao_id: id }).write();
      db.get('historico_qa').remove({ avaliacao_id: id }).write();
    });
    db.get('avaliacoes').remove({ user_id: userId }).write();
    return avIds.length;
  },
};

// ═══════ RECOMENDACOES ═══════
const recomendacoes = {
  update: (id, userId, { concluida, prazo_dias }) => {
    // Verifica posse
    const rec = db.get('recomendacoes').find({ id }).value();
    if (!rec) return null;
    const av = db.get('avaliacoes').find({ id: rec.avaliacao_id, user_id: userId }).value();
    if (!av) return null;

    const patch = {};
    if (concluida !== undefined) patch.concluida = Boolean(concluida);
    if (prazo_dias !== undefined && parseInt(prazo_dias) > 0) patch.prazo_dias = parseInt(prazo_dias);

    db.get('recomendacoes').find({ id }).assign(patch).write();
    return db.get('recomendacoes').find({ id }).value();
  },
};

// ═══════ RASCUNHO ═══════
const rascunhos = {
  get: (userId) =>
    db.get('rascunhos').find({ user_id: userId }).value() || null,

  upsert: (userId, { perguntas, respostas, ignoradas, nivel_usuario }) => {
    const existing = db.get('rascunhos').find({ user_id: userId }).value();
    const data = {
      user_id: userId,
      perguntas: perguntas || [],
      respostas: respostas || {},
      ignoradas: ignoradas || {},
      nivel_usuario: nivel_usuario || '',
      salvo_em: now()
    };
    if (existing) {
      db.get('rascunhos').find({ user_id: userId }).assign(data).write();
    } else {
      db.get('rascunhos').push(data).write();
    }
  },

  delete: (userId) => {
    db.get('rascunhos').remove({ user_id: userId }).write();
  },
};

module.exports = { db, usuarios, perfis, avaliacoes, recomendacoes, rascunhos };
