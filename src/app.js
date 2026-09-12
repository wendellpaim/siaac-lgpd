require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  const geminiLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Muitas requisições. Aguarde 1 minuto.' },
  });
  app.use('/api/gemini', geminiLimit);

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/avaliacoes', require('./routes/avaliacoes'));
  app.use('/api/gemini', require('./routes/gemini'));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  return app;
}

module.exports = { createApp };
