const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { usuarios, perfis } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

function makeToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function userPayload(userId) {
  const u = usuarios.findById(userId);
  const pc = perfis.getUsuario(userId) || {};
  const po = perfis.getOrg(userId) || {};
  const setorSensivel = ['Saúde / Clínicas', 'Financeiro / Fintechs', 'Educação'].includes(po.setor);
  const dadosLabel = {cpf:'CPF/RG',saude:'Saúde',fin:'Financeiros',bio:'Biométricos',cri:'Crianças',loc:'Localização',comp:'Comportamentais'};
  po.setor_sensivel = setorSensivel;
  po.dados_tratados_label = (po.dados_tratados || []).map(d => dadosLabel[d] || d).join(', ') || 'não especificado';
  return { ...u, perfil: pc, perfil_org: po };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { nome, sobrenome, email, password, cargo, empresa } = req.body;
  if (!nome || !email || !password) return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
  if (password.length < 8) return res.status(400).json({ error: 'Senha deve ter ao menos 8 caracteres.' });
  if (usuarios.findByEmail(email)) return res.status(400).json({ error: 'E-mail já cadastrado.' });
  const nomeCompleto = [nome, sobrenome].filter(Boolean).join(' ');
  const hash = await bcrypt.hash(password, 12);
  const userId = usuarios.create(nomeCompleto, email.toLowerCase(), hash, cargo || '', empresa || '');
  res.status(201).json({ token: makeToken(userId), user: userPayload(userId) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const u = usuarios.findByEmail((email || '').toLowerCase());
  if (!u) return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
  const ok = await bcrypt.compare(password || '', u.senha_hash);
  if (!ok) return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
  res.json({ token: makeToken(u.id), user: userPayload(u.id) });
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json(userPayload(req.user.id));
});

// PATCH /api/auth/perfil
router.patch('/perfil', auth, (req, res) => {
  const { nivel, area, lgpd_exp } = req.body;
  perfis.updateUsuario(req.user.id, { nivel, area, lgpd_exp });
  res.json(perfis.getUsuario(req.user.id));
});

// PATCH /api/auth/perfil-org
router.patch('/perfil-org', auth, (req, res) => {
  perfis.updateOrg(req.user.id, req.body);
  res.json(perfis.getOrg(req.user.id));
});

module.exports = router;
