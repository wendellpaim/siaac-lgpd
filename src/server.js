const { createApp } = require('./app');

const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 SIAAC-LGPD rodando em http://localhost:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Gemini: ${process.env.GEMINI_API_KEY ? '✅ configurado' : '⚠️  GEMINI_API_KEY não definida'}\n`);
});
