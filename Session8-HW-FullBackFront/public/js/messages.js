/**
 * messages.js — Phase 3-D (replaces notifications.js)
 *
 * Inbox UI: lists the user's messages, lets them mark one (or all) as read,
 * expand long bodies, and delete READ messages. All native dialogs are
 * routed through `window.DakhlyarModal`.
 */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  // ── Type → badge config ─────────────────────────────────────────────
  const TYPE_META = {
    verification_request:        { cls: 'msg-badge--verification',         label: 'احراز هویت'      },
    verification_result:         { cls: 'msg-badge--verification',         label: 'احراز هویت'      },
    subscription_request:        { cls: 'msg-badge--subscription',         label: 'اشتراک'          },
    subscription_result:         { cls: 'msg-badge--subscription',         label: 'اشتراک'          },
    subscription_expiry_warning: { cls: 'msg-badge--subscription_expiry',  label: 'هشدار اشتراک'    },
    subscription_expired:        { cls: 'msg-badge--subscription_expired', label: 'انقضای اشتراک'   },
    admin_broadcast:             { cls: 'msg-badge--admin',                label: 'پیام سیستمی'     },
    admin_direct:                { cls: 'msg-badge--admin',                label: 'پیام سیستمی'     },
    referral:                    { cls: 'msg-badge--referral',             label: 'دعوت دوستان'    },
  };

  // ── Toast ────────────────────────────────────────────────────────────
  let toastTimer = null;
  function toast(msg, ms = 2000) {
    const el = $('#toast'); if (!el) return;
    el.textContent = msg; el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, ms);
  }

  async function fetchJson(url, opts = {}) {
    const res = await fetch(url, Object.assign({
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    }, opts));
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { status: res.status, ok: res.ok, data: data || {} };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── Back button ──────────────────────────────────────────────────────
  $('#backBtn').addEventListener('click', () => {
    history.length > 1 ? history.back() : (location.href = '/dashboard.html');
  });

  // ── Render ──────────────────────────────────────────────────────────
  function badgeFor(type, isExpired) {
    const meta = TYPE_META[type] || { cls: 'msg-badge--admin', label: 'پیام' };
    const parts = [`<span class="msg-badge ${meta.cls}">${meta.label}</span>`];
    if (isExpired) parts.push('<span class="msg-badge expired">منقضی شده</span>');
    return parts.join('');
  }

  function buildCard(m) {
    const card = document.createElement('div');
    card.className = 'msg-card ' + (m.is_read ? 'read' : 'unread') + (m.is_expired ? ' expired' : '');
    card.dataset.id = m.id;
    card.tabIndex = 0;

    const timeAgo = m.time_ago || (window.formatJalaliRelative ? window.formatJalaliRelative(m.created_at) : '');

    card.innerHTML = `
      <span class="msg-dot" aria-hidden="true"></span>
      <h4 class="msg-title">${escapeHtml(m.title || '')}</h4>
      <p class="msg-body">${escapeHtml(m.body || '')}</p>
      <div class="msg-footer">
        ${badgeFor(m.type, m.is_expired)}
        <span class="msg-time" title="${escapeHtml(window.formatJalaliDateTime ? window.formatJalaliDateTime(m.created_at) : '')}">${escapeHtml(timeAgo)}</span>
        ${m.is_read ? `<button class="msg-delete" data-id="${m.id}" aria-label="حذف">حذف</button>` : ''}
      </div>
    `;

    // Tap → expand + mark read
    card.addEventListener('click', async (ev) => {
      // Don't toggle when clicking the delete button
      if (ev.target && ev.target.closest('.msg-delete')) return;
      card.classList.toggle('expanded');
      if (!m.is_read) {
        const r = await fetchJson(`/api/messages/${m.id}/read`, { method: 'PATCH' });
        if (r.ok) {
          m.is_read = true;
          card.classList.remove('unread');
          card.classList.add('read');
          const del = document.createElement('button');
          del.className = 'msg-delete';
          del.dataset.id = m.id;
          del.textContent = 'حذف';
          card.querySelector('.msg-footer').appendChild(del);
          bindDelete(del, m, card);
        }
      }
    });

    const delBtn = card.querySelector('.msg-delete');
    if (delBtn) bindDelete(delBtn, m, card);

    return card;
  }

  function bindDelete(btn, m, card) {
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const ok = await (window.DakhlyarModal
        ? window.DakhlyarModal.confirm({
            title: 'حذف پیام',
            body: 'این پیام حذف شود؟ این عمل قابل بازگشت نیست.',
            confirmText: 'حذف',
            cancelText: 'انصراف',
            danger: true,
          })
        : Promise.resolve(true));
      if (!ok) return;
      const r = await fetchJson(`/api/messages/${m.id}`, { method: 'DELETE' });
      if (r.ok) {
        card.style.transition = 'opacity 0.2s, transform 0.2s';
        card.style.opacity = '0';
        card.style.transform = 'translateY(-6px)';
        setTimeout(() => card.remove(), 200);
      } else {
        toast(r.data.message || 'حذف انجام نشد');
      }
    });
  }

  // ── Load ────────────────────────────────────────────────────────────
  async function load() {
    const root = $('#messagesList');
    root.innerHTML = '<div class="muted" style="padding:14px;text-align:center">در حال بارگذاری…</div>';
    const r = await fetchJson('/api/messages');
    if (r.status === 401) { location.href = '/'; return; }
    if (!r.ok) {
      root.innerHTML = '<div class="msg-empty">خطا در دریافت پیام‌ها.</div>';
      return;
    }
    const items = (r.data && r.data.messages) || [];
    root.innerHTML = '';
    if (!items.length) {
      root.innerHTML = `
        <div class="msg-empty">
          <div class="msg-empty-ico" aria-hidden="true">✉</div>
          <div>پیامی وجود ندارد</div>
        </div>`;
      return;
    }
    items.forEach((m) => root.appendChild(buildCard(m)));

    // disable mark-all when nothing is unread
    const hasUnread = items.some((m) => !m.is_read);
    const btn = $('#markAllBtn');
    if (btn) btn.disabled = !hasUnread;
  }

  $('#markAllBtn').addEventListener('click', async () => {
    const btn = $('#markAllBtn');
    if (btn) btn.disabled = true;
    const r = await fetchJson('/api/messages/read-all', { method: 'PATCH' });
    if (r.ok) {
      const n = (r.data && r.data.updated_count) || 0;
      const faN = String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
      toast(n > 0 ? `${faN} پیام به‌عنوان خوانده‌شده علامت‌گذاری شد` : 'پیام نخوانده‌ای وجود نداشت');
      load();
    } else {
      if (btn) btn.disabled = false;
      toast(r.data.message || 'خطا');
    }
  });

  load();
})();
