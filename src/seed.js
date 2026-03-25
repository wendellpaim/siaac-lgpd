// src/seed.js
// Cria dados de demonstração no banco JSON
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db, usuarios, perfis, avaliacoes } = require('./db');

async function seed() {
  console.log('\n🌱 Criando dados de demonstração...\n');

  // Remove demo anterior se existir
  const old = usuarios.findByEmail('demo@siaac.br');
  if (old) {
    const avIds = db.get('avaliacoes').filter({ user_id: old.id }).map('id').value();
    avIds.forEach(id => {
      db.get('recomendacoes').remove({ avaliacao_id: id }).write();
      db.get('historico_qa').remove({ avaliacao_id: id }).write();
    });
    db.get('avaliacoes').remove({ user_id: old.id }).write();
    db.get('perfis_usuario').remove({ user_id: old.id }).write();
    db.get('perfis_org').remove({ user_id: old.id }).write();
    db.get('rascunhos').remove({ user_id: old.id }).write();
    db.get('usuarios').remove({ id: old.id }).write();
    console.log('   Dados demo anteriores removidos.');
  }

  // Cria usuário demo
  const hash = await bcrypt.hash('demo123', 12);
  const userId = usuarios.create(
    'Demo LGPD', 'demo@siaac.br', hash,
    'DPO / Encarregado de Dados', 'IFBA Campus Feira'
  );

  // Perfil do usuário
  perfis.updateUsuario(userId, {
    nivel: 'tecnico',
    area: 'TI / Tecnologia',
    lgpd_exp: 'Avançada — atuo como DPO ou equivalente'
  });

  // Perfil organizacional
  perfis.updateOrg(userId, {
    nome: 'IFBA Campus Feira', porte: 'Grande empresa',
    setor: 'Educação', colaboradores: '250 ou mais',
    equipamentos: 150, dados_tratados: ['cpf', 'saude', 'cri'],
    politicas: ['priv', 'dpo', 'trei']
  });

  // Avaliação 1 — mais recente (boa pontuação)
  const id1 = avaliacoes.create(userId, {
    empresa: 'IFBA Campus Feira', setor: 'Educação',
    porte: 'Grande empresa', nivel_usuario: 'tecnico',
    indice: 62, nivel_maturidade: 'Gerenciado',
    area_scores: { 'base-legal': 70, 'direitos': 65, 'segurança': 58, 'compartilhamento': 60, 'incidentes': 55, 'governança': 68 },
    diagnostico: 'Avaliação indica nível Gerenciado com processos razoavelmente controlados. Há oportunidades de melhoria em Gestão de Incidentes.',
    plano_acao: 'Priorizar formalização do plano de incidentes e revisão de controles de acesso.',
    recomendacoes: [
      { prioridade: 'alta', acao: 'Formalizar plano de resposta a incidentes de dados', prazo_dias: 30 },
      { prioridade: 'media', acao: 'Revisar controles de acesso nos sistemas legados', prazo_dias: 60 },
      { prioridade: 'baixa', acao: 'Certificar colaboradores em proteção de dados', prazo_dias: 90 },
    ],
    historico_qa: []
  });

  // Ajusta data para parecer histórico real
  db.get('avaliacoes').find({ id: id1 }).assign({
    criado_em: new Date(Date.now() - 36 * 24 * 60 * 60 * 1000).toISOString()
  }).write();

  // Avaliação 2 — mais antiga (pontuação menor)
  const id2 = avaliacoes.create(userId, {
    empresa: 'IFBA Campus Feira', setor: 'Educação',
    porte: 'Grande empresa', nivel_usuario: 'tecnico',
    indice: 41, nivel_maturidade: 'Intermediário',
    area_scores: { 'base-legal': 45, 'direitos': 38, 'segurança': 42, 'incidentes': 30, 'governança': 50 },
    diagnostico: 'Lacunas em Direitos do Titular e Gestão de Incidentes identificadas.',
    plano_acao: 'Canal de titulares e política de privacidade como prioridades imediatas.',
    recomendacoes: [
      { prioridade: 'alta', acao: 'Criar canal de atendimento ao titular', prazo_dias: 15 },
      { prioridade: 'alta', acao: 'Publicar política de privacidade atualizada', prazo_dias: 30 },
    ],
    historico_qa: []
  });

  db.get('avaliacoes').find({ id: id2 }).assign({
    criado_em: new Date(Date.now() - 133 * 24 * 60 * 60 * 1000).toISOString()
  }).write();

  console.log('✅ Usuário demo criado: demo@siaac.br / demo123');
  console.log('✅ 2 avaliações de exemplo criadas');
  console.log('\n   Execute: npm start');
  console.log('   Acesse:  http://localhost:3000\n');
  process.exit(0);
}

seed().catch(e => { console.error('Erro:', e.message); process.exit(1); });
