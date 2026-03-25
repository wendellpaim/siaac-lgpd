const express = require('express');
const fetch = require('node-fetch');
const auth = require('../middleware/auth');

const router = express.Router();

// gemini-2.0-flash: modelo estável atual, suportado no plano gratuito
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent';

// Aguarda N segundos
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

// Chama o Gemini com retry progressivo em caso de 429
async function callGemini(apiKey, body) {
  const esperas = [15000, 30000, 60000]; // 15s, 30s, 60s
  
  for (let attempt = 0; attempt <= esperas.length; attempt++) {
    const resp = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      timeout: 60000,
    });

    if (resp.status === 429 && attempt < esperas.length) {
      const ms = esperas[attempt];
      console.warn(`[Gemini] 429 cota — tentativa ${attempt + 1}, aguardando ${ms/1000}s...`);
      await esperar(ms);
      continue;
    }

    return resp;
  }
}

// POST /api/gemini
router.post('/', auth, async (req, res) => {
  const { prompt, maxTokens = 4000 } = req.body;

  if (!prompt) return res.status(400).json({ error: 'prompt obrigatório.' });

  if (!process.env.GEMINI_API_KEY) {
    console.error('[Gemini] GEMINI_API_KEY não definida no .env');
    return res.status(503).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
  }

  console.log(`[Gemini] Chamando API — prompt: ${prompt.length} chars, maxTokens: ${maxTokens}`);

  try {
    const resp = await callGemini(process.env.GEMINI_API_KEY, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error(`[Gemini] Erro ${resp.status}:`, errText.slice(0, 300));
      return res.status(502).json({
        error: `Gemini retornou ${resp.status}`,
        detail: errText.slice(0, 200),
      });
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`[Gemini] OK — resposta: ${text.length} chars`);
    res.json({ text });

  } catch (e) {
    console.error('[Gemini] Exceção:', e.message);
    if (e.type === 'request-timeout') return res.status(504).json({ error: 'Gemini timeout (60s)' });
    res.status(502).json({ error: 'Gemini indisponível: ' + e.message });
  }
});

module.exports = router;
