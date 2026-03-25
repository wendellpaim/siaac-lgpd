require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

// ── Segurança ──
app.use(helmet({ contentSecurityPolicy: false })); // CSP off para servir o SPA inline
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Rate limit na rota Gemini (evita abuso da API key)
const geminiLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  message: { error: 'Muitas requisições. Aguarde 1 minuto.' },
});
app.use('/api/gemini', geminiLimit);

// ── Rotas da API ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/avaliacoes', require('./routes/avaliacoes'));
app.use('/api/gemini', require('./routes/gemini'));

// ── Arquivos estáticos ──
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── SPA catchall — todas as rotas servem o index.html ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Inicializa ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 SIAAC-LGPD rodando em http://localhost:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Gemini: ${process.env.GEMINI_API_KEY ? '✅ configurado' : '⚠️  GEMINI_API_KEY não definida'}\n`);
});
