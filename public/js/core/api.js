// ═══════════════════════════════════════════════════
//  SIAAC-LGPD v2.0 — API Helper & Estado Global
// ═══════════════════════════════════════════════════

// ── API Helper ──────────────────────────────────────
const CSRF = document.querySelector('meta[name="csrf-token"]')?.content || '';
let AUTH_TOKEN = localStorage.getItem('siaac_token') || '';

async function api(method, path, data = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': CSRF,
    },
  };
  if (AUTH_TOKEN) opts.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  if (data) opts.body = JSON.stringify(data);
  const resp = await fetch(`/api/${path}`, opts);
  if (resp.status === 204) return null;
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw Object.assign(new Error(json.error || 'Erro na API'), { status: resp.status, data: json });
  return json;
}

// ── Estado global ────────────────────────────────────
let currentUser = null;
let avaliacoes = [];
let cogLevel = null, evalQuestions = [], evalAnswers = {}, evalSkipped = {}, evalFromAI = false;

const LKRL = ['Não implementado', 'Iniciado', 'Parcial', 'Avançado', 'Implementado'];
const CAT_META = {
  'base-legal': { lbl: 'Base Legal', cls: 'c0' },
  'direitos': { lbl: 'Direitos do Titular', cls: 'c1' },
  'segurança': { lbl: 'Segurança', cls: 'c2' },
  'compartilhamento': { lbl: 'Compartilhamento', cls: 'c3' },
  'incidentes': { lbl: 'Incidentes', cls: 'c4' },
  'governança': { lbl: 'Governança e DPO', cls: 'c5' },
};
const CATS = {
  'base-legal': 'Base Legal', 'direitos': 'Direitos do Titular',
  'segurança': 'Segurança da Informação', 'compartilhamento': 'Compartilhamento',
  'incidentes': 'Gestão de Incidentes', 'governança': 'Governança e DPO',
};

// ── Utilitários ───────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
