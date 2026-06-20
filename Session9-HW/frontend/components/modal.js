const ICONS = {
  error: '🌙',
  info: '✨',
  confirm: '🚪',
  warning: '⏳',
};

let activeModal = null;

function closeModal(overlay, result) {
  if (!overlay || overlay.dataset.closing === '1') return;
  overlay.dataset.closing = '1';
  overlay.classList.remove('lalayi-modal--visible');

  const finish = () => {
    overlay.remove();
    if (activeModal?.overlay === overlay) {
      activeModal = null;
    }
    overlay._resolve?.(result);
  };

  overlay.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 300);
}

function trapFocus(overlay) {
  const focusable = overlay.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal(overlay, false);
      return;
    }
    if (e.key !== 'Tab' || !focusable.length) return;

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {object} options
 * @param {'alert'|'error'|'confirm'|'warning'} [options.type]
 * @param {string} [options.title]
 * @param {string} options.message
 * @param {string} [options.icon]
 * @param {string} [options.confirmText]
 * @param {string} [options.cancelText]
 * @returns {Promise<boolean>}
 */
export function showModal({
  type = 'alert',
  title,
  message,
  icon,
  confirmText = 'باشه',
  cancelText = 'انصراف',
}) {
  if (activeModal) {
    closeModal(activeModal.overlay, false);
  }

  const isConfirm = type === 'confirm';
  const modalIcon = icon || ICONS[type] || ICONS.info;
  const modalTitle =
    title ||
    (type === 'error'
      ? 'اوه! یه مشکلی پیش اومد'
      : type === 'confirm'
        ? 'مطمئنی؟'
        : type === 'warning'
          ? 'یه لحظه صبر کن'
          : 'پیام');

  const overlay = document.createElement('div');
  overlay.className = 'lalayi-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'lalayi-modal-title');

  overlay.innerHTML = `
    <div class="lalayi-modal__backdrop" data-action="backdrop"></div>
    <div class="lalayi-modal__card lalayi-modal__card--${type}">
      <div class="lalayi-modal__icon" aria-hidden="true">${modalIcon}</div>
      <h2 class="lalayi-modal__title" id="lalayi-modal-title">${modalTitle}</h2>
      <p class="lalayi-modal__message">${escapeHtml(message)}</p>
      <div class="lalayi-modal__actions">
        ${isConfirm ? `<button type="button" class="lalayi-modal__btn lalayi-modal__btn--ghost" data-action="cancel">${cancelText}</button>` : ''}
        <button type="button" class="lalayi-modal__btn lalayi-modal__btn--primary" data-action="confirm">${confirmText}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('lalayi-modal--visible'));

  const confirmBtn = overlay.querySelector('[data-action="confirm"]');
  const cancelBtn = overlay.querySelector('[data-action="cancel"]');
  const backdrop = overlay.querySelector('[data-action="backdrop"]');

  trapFocus(overlay);
  confirmBtn.focus();

  return new Promise((resolve) => {
    overlay._resolve = resolve;
    activeModal = { overlay };

    confirmBtn.addEventListener('click', () => closeModal(overlay, true));
    cancelBtn?.addEventListener('click', () => closeModal(overlay, false));
    backdrop.addEventListener('click', () => closeModal(overlay, isConfirm ? false : true));
  });
}

export function showErrorModal(message, { title } = {}) {
  return showModal({ type: 'error', title, message, confirmText: 'باشه' });
}

export function showWarningModal(message, { title } = {}) {
  return showModal({ type: 'warning', title, message, confirmText: 'فهمیدم' });
}

export function showConfirmModal(message, { title, confirmText, cancelText } = {}) {
  return showModal({
    type: 'confirm',
    title: title || 'مطمئنی؟',
    message,
    confirmText: confirmText || 'آره',
    cancelText: cancelText || 'نه',
  });
}

export function showMicPermissionModal() {
  return showModal({
    type: 'confirm',
    title: 'دسترسی به میکروفون 🎙',
    message:
      'برای قصه تعاملی، وقتی بچه سوال می‌پرسه باید بتونیم گوش بدیم و جواب بدیم.\n\nبعد از تأیید، مرورگر ازت اجازه میکروفون می‌خواد.',
    icon: '🎙',
    confirmText: 'آره، اجازه می‌دم',
    cancelText: 'نه، الان نه',
  });
}
