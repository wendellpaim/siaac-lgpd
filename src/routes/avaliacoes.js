const express = require('express');
const { avaliacoes, recomendacoes, rascunhos } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// ─── Rotas fixas PRIMEIRO (antes de qualquer /:id) ───────────────────────────

// GET /api/avaliacoes
router.get('/', auth, (req, res) => {
  res.json(avaliacoes.list(req.user.id));
});

// POST /api/avaliacoes
router.post('/', auth, (req, res) => {
  try {
    const id = avaliacoes.create(req.user.id, req.body);
    const av = avaliacoes.getById(id, req.user.id);
    res.status(201).json(av);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/avaliacoes/clear
router.delete('/clear', auth, (req, res) => {
  const deleted = avaliacoes.deleteAll(req.user.id);
  res.json({ deleted });
});

// PATCH /api/avaliacoes/recomendacao/:id
router.patch('/recomendacao/:id', auth, (req, res) => {
  const { concluida, prazo_dias } = req.body;
  const rec = recomendacoes.update(parseInt(req.params.id), req.user.id, { concluida, prazo_dias });
  if (!rec) return res.status(404).json({ error: 'Recomendação não encontrada.' });
  res.json(rec);
});

// ─── Rascunho — deve vir ANTES de /:id ───────────────────────────────────────

// GET /api/avaliacoes/rascunho
router.get('/rascunho', auth, (req, res) => {
  const r = rascunhos.get(req.user.id);
  if (!r) return res.status(204).send();
  res.json(r);
});

// PUT /api/avaliacoes/rascunho
router.put('/rascunho', auth, (req, res) => {
  rascunhos.upsert(req.user.id, req.body);
  res.json(rascunhos.get(req.user.id));
});

// DELETE /api/avaliacoes/rascunho
router.delete('/rascunho', auth, (req, res) => {
  rascunhos.delete(req.user.id);
  res.status(204).send();
});

// ─── Rotas com parâmetro dinâmico DEPOIS ─────────────────────────────────────

// GET /api/avaliacoes/:id
router.get('/:id', auth, (req, res) => {
  const av = avaliacoes.getById(parseInt(req.params.id), req.user.id);
  if (!av) return res.status(404).json({ error: 'Avaliação não encontrada.' });
  res.json(av);
});

// DELETE /api/avaliacoes/:id
router.delete('/:id', auth, (req, res) => {
  const changes = avaliacoes.delete(parseInt(req.params.id), req.user.id);
  if (!changes) return res.status(404).json({ error: 'Avaliação não encontrada.' });
  res.status(204).send();
});

module.exports = router;
