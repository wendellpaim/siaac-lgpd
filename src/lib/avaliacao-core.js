/**
 * Núcleo de avaliação SIAAC-LGPD — lógica pura separada do LLM (ISO/IEC 25010: Modularidade).
 * Consumido pelos testes automatizados e pelo frontend via bundler/script.
 */

const ARTIGOS_LGPD_OBRIGATORIOS = ['6', '37', '46', '48', '49'];

const CATS = {
  'base-legal': 'Base Legal',
  direitos: 'Direitos do Titular',
  segurança: 'Segurança da Informação',
  compartilhamento: 'Compartilhamento',
  incidentes: 'Gestão de Incidentes',
  governança: 'Governança e DPO',
};

function getNivelInfo(i) {
  if (i <= 20) return { nome: 'Inicial', cls: 'lvl-i' };
  if (i <= 40) return { nome: 'Básico', cls: 'lvl-b' };
  if (i <= 60) return { nome: 'Intermediário', cls: 'lvl-m' };
  if (i <= 80) return { nome: 'Gerenciado', cls: 'lvl-g' };
  return { nome: 'Otimizado', cls: 'lvl-o' };
}

function parseQ(text) {
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const s = clean.indexOf('{');
    const e = clean.lastIndexOf('}');
    if (s < 0) return [];
    const j = JSON.parse(clean.substring(s, e + 1));
    if (!Array.isArray(j.perguntas)) return [];
    return j.perguntas.map((q) => ({
      id: q.id,
      texto: q.texto,
      categoria: q.categoria || 'segurança',
      peso: q.peso || 1,
      framework: q.framework || '',
    }));
  } catch {
    return [];
  }
}

function fallbackQ(po, level) {
  const base =
    level === 'basico'
      ? [
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
        ]
      : [
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
    base.push({
      id: base.length + 1,
      texto:
        level === 'basico'
          ? 'Sua empresa lida com dados de saúde, financeiros ou de crianças? Há cuidado especial com esses dados mais sensíveis?'
          : 'Há controles e base legal específica (Art. 11 LGPD) para o tratamento de dados pessoais sensíveis documentados?',
      categoria: 'segurança',
      peso: 3,
      framework: 'LGPD Art. 11 · CIS Control 3 · ISO 27001 A.10',
    });
  }
  return base;
}

function calcularIndice(questions, answers, skipped = {}, cogLevel = 'intermediario') {
  let svp = 0;
  let sp = 0;
  const at = {};
  const aw = {};
  const penalizar = cogLevel === 'basico';

  questions.forEach((q) => {
    if (skipped[q.id]) {
      if (penalizar) {
        sp += q.peso;
        if (!at[q.categoria]) {
          at[q.categoria] = 0;
          aw[q.categoria] = 0;
        }
        aw[q.categoria] += q.peso;
      }
      return;
    }
    const val = answers[q.id] ?? null;
    if (val === null) return;
    svp += val * q.peso;
    sp += q.peso;
    if (!at[q.categoria]) {
      at[q.categoria] = 0;
      aw[q.categoria] = 0;
    }
    at[q.categoria] += val * q.peso;
    aw[q.categoria] += q.peso;
  });

  let indice = sp > 0 ? Math.round((svp / sp) * 25) : 0;
  const totalIgnoradas = Object.keys(skipped).length;
  const descontoAplicado = cogLevel === 'basico' ? Math.round(totalIgnoradas * 0.75) : 0;
  indice = Math.max(0, indice - descontoAplicado);

  const areaScores = {};
  Object.keys(at).forEach((c) => {
    areaScores[c] = aw[c] > 0 ? Math.round((at[c] / aw[c]) * 25) : 0;
  });

  return { indice, descontoAplicado, totalIgnoradas, areaScores, nivel: getNivelInfo(indice) };
}

function respostasUniformes(questions, valor) {
  const answers = {};
  questions.forEach((q) => {
    answers[q.id] = valor;
  });
  return answers;
}

function fallbackRel(indice, ni, areaScores, d) {
  const criticas = Object.entries(areaScores)
    .filter(([, v]) => v < 40)
    .map(([k]) => CATS[k] || k);

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
  return {
    diagnostico: c.diagnostico,
    areas_criticas: criticas.length ? criticas : ['Revisão geral recomendada'],
    recomendacoes: c.recomendacoes,
    plano_acao: c.plano_acao,
  };
}

function referenciaArtigo(texto, numeroArtigo) {
  const t = (texto || '').toLowerCase();
  const n = String(numeroArtigo);
  const patterns = [
    new RegExp(`art\\.\\s*0*${n}\\b`, 'i'),
    new RegExp(`artigo\\s*0*${n}\\b`, 'i'),
    new RegExp(`art\\.\\s*0*${n}[º°]`, 'i'),
  ];
  if (n === '6') patterns.push(/art\.\s*6[º°]\s*iii/i, /princípios/i);
  return patterns.some((p) => p.test(t));
}

function auditarCoberturaNormativa(perguntas) {
  const refs = {};
  ARTIGOS_LGPD_OBRIGATORIOS.forEach((a) => {
    refs[a] = perguntas.some((q) => referenciaArtigo(`${q.texto} ${q.framework}`, a));
  });
  const total = ARTIGOS_LGPD_OBRIGATORIOS.filter((a) => refs[a]).length;
  return { refs, total, aprovado: total === ARTIGOS_LGPD_OBRIGATORIOS.length };
}

function avaliarRecomendacao(acao, nivel, porte) {
  const texto = acao || '';
  const lower = texto.toLowerCase();

  const jargaoTecnico = /\b(mfa|rota|dpa|siem|privil[eé]gio|nist|iso\s*27001|cis control|csf)\b/i;
  const jargaoBasicoOk = /\b(e-mail|senha|cliente|funcion[aá]rio|advogado|especialista)\b/i;
  const citacaoLgpd = /\b(art\.?\s*\d+|lgpd)\b/i.test(texto);
  const mapeamentoFramework = /\b(iso\s*27001|cis control|nist)\b/i.test(texto);
  const corporativo = /\b(comit[eê]|board|soc\s*2|auditoria externa|equipe dedicada de compliance)\b/i.test(lower);
  const pme = /\b(planilha|e-mail|gratuit|simples|pequena|micro|sem\s+custo|comece)\b/i.test(lower) || !corporativo;

  let clareza = 0;
  if (nivel === 'basico') clareza = jargaoTecnico.test(texto) ? 0 : jargaoBasicoOk.test(texto) ? 2 : 1;
  else if (nivel === 'intermediario') clareza = jargaoBasicoOk.test(texto) || /formalize|documente|política/i.test(texto) ? 2 : 1;
  else clareza = jargaoTecnico.test(texto) ? 2 : 1;

  const citacao = citacaoLgpd ? 2 : nivel === 'basico' ? (/\bespecialista|advogado|lei\b/i.test(texto) ? 1 : 0) : 0;
  const framework = mapeamentoFramework ? 2 : nivel === 'tecnico' ? 0 : 1;
  const aplicabilidade =
    porte && /micro|pequena|epp|mei/i.test(porte) && corporativo ? 0 : pme ? 2 : 1;

  const pontos = clareza + citacao + framework + aplicabilidade;
  return {
    clareza,
    citacao_lgpd: citacao,
    mapeamento_framework: framework,
    aplicabilidade_pme: aplicabilidade,
    pontos,
    classificacao: pontos >= 7 ? 'Excelente' : pontos >= 5 ? 'Adequado' : pontos >= 3 ? 'Parcial' : 'Insuficiente',
  };
}

function avaliarRecomendacoesCenario(recomendacoes, nivel, porte) {
  const itens = (recomendacoes || []).map((r) => ({
    acao: r.acao,
    ...avaliarRecomendacao(r.acao, nivel, porte),
  }));
  const media = itens.length ? itens.reduce((s, i) => s + i.pontos, 0) / itens.length : 0;
  const classificacao =
    media >= 7 ? 'Excelente' : media >= 5 ? 'Adequado' : media >= 3 ? 'Parcial' : 'Insuficiente';
  return { itens, media: Math.round(media * 10) / 10, classificacao };
}

module.exports = {
  ARTIGOS_LGPD_OBRIGATORIOS,
  getNivelInfo,
  parseQ,
  fallbackQ,
  calcularIndice,
  respostasUniformes,
  fallbackRel,
  referenciaArtigo,
  auditarCoberturaNormativa,
  avaliarRecomendacao,
  avaliarRecomendacoesCenario,
};
