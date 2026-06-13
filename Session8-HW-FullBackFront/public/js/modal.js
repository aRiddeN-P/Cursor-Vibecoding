/**
 * modal.js — Dakhlyar global dialog system.
 *
 * Replaces every `window.confirm` / `window.alert` / inline-confirm UI across
 * the app with a single styled, accessible, Promise-based modal API.
 *
 *   await DakhlyarModal.confirm({ title, message, ... }) → Promise<boolean>
 *   await DakhlyarModal.alert({ message, subType, ... }) → Promise<true>
 *   DakhlyarModal.loading({ message })                   → token (string id)
 *   DakhlyarModal.closeLoading(token?)                   → close most-recent loading (or specific one)
 *   await DakhlyarModal.prompt({ message, ... })         → Promise<string|null> (shell)
 *
 * Each call also supports the legacy callback fields `onConfirm`, `onCancel`,
 * `onClose` for ergonomic use without `await`.
 *
 * Accessibility:
 *   - role="dialog", aria-modal="true", aria-labelledby points to the title
 *   - first interactive element receives focus on open
 *   - Tab/Shift+Tab traps focus inside the modal
 *   - Esc closes confirm/alert (cancel semantics); loading is non-dismissable
 *   - Overlay click closes alert; confirm requires an explicit button
 *
 * Stacking:
 *   - Multiple modals can be open at once; each gets a z-index higher than the
 *     previous and only the top modal handles Esc/Tab.
 *   - `loading` modals stack too; `closeLoading()` without a token closes the
 *     most-recent loading modal so call sites can always pair open/close.
 */
(function () {
  'use strict';

  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12.5 10 18.5 20 6"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><line x1="12" y1="11" x2="12" y2="17"/><circle cx="12" cy="7.4" r="1.2" fill="currentColor" stroke="none"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2 22 20H2L12 3.2Z"/><line x1="12" y1="10" x2="12" y2="14.6"/><circle cx="12" cy="17.3" r="1.1" fill="currentColor" stroke="none"/></svg>',
  };

  const FOCUSABLE = [
    'button', '[href]', 'input', 'select', 'textarea',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  /** Stack of currently-open modal records (top of stack = topmost modal). */
  const stack = [];
  /** Stack of currently-open loading modal records (subset of `stack`). */
  const loadingStack = [];
  /** id generator for `loading` tokens */
  let _id = 0;
  const nextId = () => `dak-modal-${++_id}`;

  // ───────────────────────────── helpers ─────────────────────────────

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function topInteractive() {
    // last entry that is NOT a loading modal
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].kind !== 'loading') return stack[i];
    }
    return null;
  }

  function setBodyLock() {
    if (stack.length) document.body.classList.add('dak-modal-open');
    else document.body.classList.remove('dak-modal-open');
  }

  /** Build the overlay+card skeleton (without variant-specific content). */
  function buildShell({ id, ariaLabelId, extraCardClass = '' }) {
    const overlay = el('div', 'dak-modal-overlay');
    overlay.id = id;
    overlay.style.zIndex = String(9999 + stack.length);

    const card = el('div', `dak-modal-card${extraCardClass ? ' ' + extraCardClass : ''}`);
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    if (ariaLabelId) card.setAttribute('aria-labelledby', ariaLabelId);
    card.tabIndex = -1;
    overlay.appendChild(card);
    return { overlay, card };
  }

  /** Animate-out then remove from DOM and update stack. */
  function closeRecord(rec) {
    if (rec._closed) return;
    rec._closed = true;
    // unregister
    const ix = stack.indexOf(rec);
    if (ix !== -1) stack.splice(ix, 1);
    const lix = loadingStack.indexOf(rec);
    if (lix !== -1) loadingStack.splice(lix, 1);

    rec.overlay.classList.add('dak-closing');
    // remove listeners eagerly so a quickly-mounted next modal isn't disturbed
    if (rec._cleanup) rec._cleanup();
    setTimeout(() => {
      try { rec.overlay.remove(); } catch (_) {}
      setBodyLock();
      // restore focus to the element that opened the modal
      if (rec.prevFocus && typeof rec.prevFocus.focus === 'function') {
        try { rec.prevFocus.focus(); } catch (_) {}
      }
    }, 150);
  }

  /** Focus trap + Esc handling — installed only on interactive modals. */
  function installKeyHandlers(rec) {
    const onKey = (e) => {
      // Only react when this modal is on top of the interactive stack.
      if (topInteractive() !== rec) return;

      if (e.key === 'Escape') {
        if (rec.kind === 'loading') return; // not dismissable
        e.preventDefault();
        rec._dismiss('esc');
        return;
      }

      if (e.key === 'Tab') {
        const focusables = Array.from(rec.card.querySelectorAll(FOCUSABLE))
          .filter((n) => !n.disabled && n.offsetParent !== null);
        if (!focusables.length) { e.preventDefault(); return; }
        const first = focusables[0];
        const last  = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !rec.card.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !rec.card.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', onKey);
    rec._cleanup = () => document.removeEventListener('keydown', onKey);
  }

  function mount(rec) {
    document.body.appendChild(rec.overlay);
    stack.push(rec);
    setBodyLock();

    // After mount, focus the primary action (or the card if none).
    requestAnimationFrame(() => {
      const focusables = rec.card.querySelectorAll(FOCUSABLE);
      const target = focusables[focusables.length - 1] || rec.card; // primary = last in LTR row = rightmost in RTL
      try { target.focus(); } catch (_) {}
    });

    installKeyHandlers(rec);
  }

  // ───────────────────────── public API ─────────────────────────

  /**
   * Show a confirm dialog.
   * @returns {Promise<boolean>} resolves true on confirm, false on cancel/Esc.
   */
  function confirm(opts = {}) {
    const {
      title, message = '',
      confirmText = 'تایید',
      cancelText  = 'انصراف',
      type        = 'default',
      onConfirm, onCancel,
    } = opts;

    return new Promise((resolve) => {
      const id = nextId();
      const titleId = title ? `${id}-title` : null;
      const { overlay, card } = buildShell({ id, ariaLabelId: titleId });

      if (title) {
        const h = el('h2', 'dak-modal-title');
        h.id = titleId;
        h.textContent = title;
        card.appendChild(h);
      }
      const p = el('p', 'dak-modal-message');
      p.textContent = message;
      card.appendChild(p);

      card.appendChild(el('hr', 'dak-modal-divider'));

      const actions = el('div', 'dak-modal-actions');
      const cancelBtn  = el('button', 'dak-modal-btn cancel');
      cancelBtn.type = 'button';
      cancelBtn.textContent = cancelText;
      const confirmBtn = el('button', `dak-modal-btn confirm${type === 'danger' ? ' danger' : ''}`);
      confirmBtn.type = 'button';
      confirmBtn.textContent = confirmText;
      actions.append(cancelBtn, confirmBtn);
      card.appendChild(actions);

      const rec = {
        kind: 'confirm', id, overlay, card,
        prevFocus: document.activeElement,
        _dismiss(_source) { finish(false); },
      };

      const finish = (result) => {
        if (rec._closed) return;
        closeRecord(rec);
        try { (result ? onConfirm : onCancel)?.(); } catch (e) { console.error(e); }
        resolve(!!result);
      };

      cancelBtn.addEventListener('click',  () => finish(false));
      confirmBtn.addEventListener('click', () => finish(true));
      // overlay click does NOT close confirm modals (per spec)
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          /* swallow — confirm requires explicit choice */
        }
      });

      mount(rec);
    });
  }

  /**
   * Show an alert (info / success / error / warning).
   * @returns {Promise<true>} resolves when the user closes the modal.
   */
  function alert(opts = {}) {
    const {
      title, message = '',
      subType = 'info',
      confirmText = 'باشه',
      onClose,
    } = opts;

    return new Promise((resolve) => {
      const id = nextId();
      const titleId = title ? `${id}-title` : null;
      const { overlay, card } = buildShell({ id, ariaLabelId: titleId });

      if (ICONS[subType]) {
        const icon = el('div', `dak-modal-icon ${subType}`, ICONS[subType]);
        card.appendChild(icon);
      }
      if (title) {
        const h = el('h2', 'dak-modal-title');
        h.id = titleId;
        h.textContent = title;
        card.appendChild(h);
      }
      const p = el('p', 'dak-modal-message');
      p.textContent = message;
      card.appendChild(p);

      const actions = el('div', 'dak-modal-actions single');
      const okBtn = el('button', 'dak-modal-btn confirm');
      okBtn.type = 'button';
      okBtn.textContent = confirmText;
      actions.appendChild(okBtn);
      card.appendChild(actions);

      const rec = {
        kind: 'alert', id, overlay, card,
        prevFocus: document.activeElement,
        _dismiss() { finish(); },
      };

      const finish = () => {
        if (rec._closed) return;
        closeRecord(rec);
        try { onClose?.(); } catch (e) { console.error(e); }
        resolve(true);
      };

      okBtn.addEventListener('click', finish);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(); });

      mount(rec);
    });
  }

  /**
   * Show a non-dismissable loading modal. Returns a token; pass it to
   * `closeLoading(token)` when the async op completes. Or call
   * `closeLoading()` to close the most recent loading modal.
   */
  function loading(opts = {}) {
    const { message = 'در حال پردازش...' } = opts;
    const id = nextId();
    const { overlay, card } = buildShell({ id, extraCardClass: 'loading' });

    card.appendChild(el('div', 'dak-modal-spinner'));
    const p = el('p', 'dak-modal-message');
    p.textContent = message;
    card.appendChild(p);

    // prevent overlay click from doing anything
    overlay.addEventListener('click', (e) => { e.stopPropagation(); });

    const rec = {
      kind: 'loading', id, overlay, card,
      prevFocus: document.activeElement,
    };

    mount(rec);
    loadingStack.push(rec);
    return id;
  }

  function closeLoading(token) {
    if (token) {
      const rec = stack.find((r) => r.id === token);
      if (rec) closeRecord(rec);
      return;
    }
    const rec = loadingStack[loadingStack.length - 1];
    if (rec) closeRecord(rec);
  }

  /**
   * Shell prompt() — used in a later phase. Returns string on submit, null on cancel.
   */
  function prompt(opts = {}) {
    const {
      title, message = '',
      placeholder = '',
      defaultValue = '',
      confirmText = 'تایید',
      cancelText  = 'انصراف',
      type        = 'default',
    } = opts;

    return new Promise((resolve) => {
      const id = nextId();
      const titleId = title ? `${id}-title` : null;
      const { overlay, card } = buildShell({ id, ariaLabelId: titleId });

      if (title) {
        const h = el('h2', 'dak-modal-title');
        h.id = titleId;
        h.textContent = title;
        card.appendChild(h);
      }
      if (message) {
        const p = el('p', 'dak-modal-message');
        p.textContent = message;
        card.appendChild(p);
      }

      const input = el('input', 'dak-modal-input');
      input.type = 'text';
      input.placeholder = placeholder;
      input.value = defaultValue;
      card.appendChild(input);

      card.appendChild(el('hr', 'dak-modal-divider'));

      const actions = el('div', 'dak-modal-actions');
      const cancelBtn = el('button', 'dak-modal-btn cancel');
      cancelBtn.type = 'button';
      cancelBtn.textContent = cancelText;
      const confirmBtn = el('button', `dak-modal-btn confirm${type === 'danger' ? ' danger' : ''}`);
      confirmBtn.type = 'button';
      confirmBtn.textContent = confirmText;
      actions.append(cancelBtn, confirmBtn);
      card.appendChild(actions);

      const rec = {
        kind: 'prompt', id, overlay, card,
        prevFocus: document.activeElement,
        _dismiss() { finish(null); },
      };

      const finish = (v) => {
        if (rec._closed) return;
        closeRecord(rec);
        resolve(v);
      };

      cancelBtn.addEventListener('click', () => finish(null));
      confirmBtn.addEventListener('click', () => finish(input.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(input.value); }
      });

      mount(rec);
      // focus the input rather than the primary button for prompts
      requestAnimationFrame(() => { try { input.focus(); input.select(); } catch (_) {} });
    });
  }

  /** Close every open modal (escape hatch — e.g. on hard logout). */
  function closeAll() {
    [...stack].forEach(closeRecord);
  }

  window.DakhlyarModal = {
    confirm,
    alert,
    loading,
    closeLoading,
    prompt,
    closeAll,
  };
})();
