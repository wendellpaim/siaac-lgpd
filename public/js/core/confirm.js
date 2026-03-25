// ═══════════════════════════════════════════════════
//  SIAAC-LGPD v2.0 — Modal de Confirmação Customizado
// ═══════════════════════════════════════════════════

let _confirmResolve = null;

/**
 * Substitui o window.confirm() nativo.
 * @param {string} title   - Título do modal
 * @param {string} message - Mensagem de descrição
 * @param {object} opts    - { okLabel, cancelLabel, type: 'danger'|'warn' }
 * @returns {Promise<boolean>}
 */
function showConfirm(title, message, opts = {}) {
  const {
    okLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    type = 'danger',
  } = opts;

  const overlay  = document.getElementById('confirm-overlay');
  const iconEl   = document.getElementById('confirm-icon');
  const titleEl  = document.getElementById('confirm-title');
  const msgEl    = document.getElementById('confirm-msg');
  const okBtn    = document.getElementById('confirm-ok-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');

  iconEl.textContent = type === 'danger' ? '🗑' : '⚠️';
  iconEl.className   = `confirm-icon ${type}`;
  titleEl.textContent = title;
  msgEl.innerHTML    = message;
  okBtn.textContent  = okLabel;
  cancelBtn.textContent = cancelLabel;

  // Estilo do botão de confirmação conforme tipo
  okBtn.className = type === 'danger' ? 'btn bd' : 'btn bp';

  overlay.classList.add('open');

  // Fecha ao clicar no overlay
  overlay.onclick = (e) => { if (e.target === overlay) confirmResolve(false); };

  return new Promise(resolve => { _confirmResolve = resolve; });
}

function confirmResolve(result) {
  const overlay = document.getElementById('confirm-overlay');
  overlay.classList.remove('open');
  overlay.onclick = null;
  if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
}
