/**
 * مسیر یک درخواست وب — تعامل و انیمیشن
 */

/* ==========================================================================
   دادهٔ کدهای وضعیت HTTP
   ========================================================================== */

const HTTP_STATUS = {
  '1xx': {
    label: '1xx — اطلاعاتی',
    color: '1xx',
    codes: [
      { code: 100, name: 'Continue', desc: 'ادامه بده' },
      { code: 101, name: 'Switching Protocols', desc: 'تغییر پروتکل' },
      { code: 102, name: 'Processing', desc: 'در حال پردازش' },
      { code: 103, name: 'Early Hints', desc: 'راهنمایی زودهنگام' },
    ],
  },
  '2xx': {
    label: '2xx — موفق',
    color: '2xx',
    codes: [
      { code: 200, name: 'OK', desc: 'موفق' },
      { code: 201, name: 'Created', desc: 'ساخته شد' },
      { code: 202, name: 'Accepted', desc: 'پذیرفته شد' },
      { code: 203, name: 'Non-Authoritative Information', desc: 'اطلاعات غیرمستند' },
      { code: 204, name: 'No Content', desc: 'بدون محتوا' },
      { code: 205, name: 'Reset Content', desc: 'بازنشانی محتوا' },
      { code: 206, name: 'Partial Content', desc: 'محتوای جزئی' },
      { code: 207, name: 'Multi-Status', desc: 'چندوضعیتی' },
      { code: 208, name: 'Already Reported', desc: 'قبلاً گزارش شده' },
      { code: 226, name: 'IM Used', desc: 'IM استفاده شد' },
    ],
  },
  '3xx': {
    label: '3xx — انتقال',
    color: '3xx',
    codes: [
      { code: 300, name: 'Multiple Choices', desc: 'چند گزینه' },
      { code: 301, name: 'Moved Permanently', desc: 'انتقال دائمی' },
      { code: 302, name: 'Found', desc: 'یافت شد (انتقال موقت)' },
      { code: 303, name: 'See Other', desc: 'به دیگری مراجعه کن' },
      { code: 304, name: 'Not Modified', desc: 'تغییر نکرده' },
      { code: 305, name: 'Use Proxy', desc: 'از پروکسی استفاده کن' },
      { code: 307, name: 'Temporary Redirect', desc: 'انتقال موقت' },
      { code: 308, name: 'Permanent Redirect', desc: 'انتقال دائمی' },
    ],
  },
  '4xx': {
    label: '4xx — خطای کلاینت',
    color: '4xx',
    codes: [
      { code: 400, name: 'Bad Request', desc: 'درخواست نامعتبر' },
      { code: 401, name: 'Unauthorized', desc: 'احراز هویت لازم است' },
      { code: 402, name: 'Payment Required', desc: 'نیاز به پرداخت' },
      { code: 403, name: 'Forbidden', desc: 'دسترسی ممنوع' },
      { code: 404, name: 'Not Found', desc: 'پیدا نشد' },
      { code: 405, name: 'Method Not Allowed', desc: 'متد مجاز نیست' },
      { code: 406, name: 'Not Acceptable', desc: 'قابل قبول نیست' },
      { code: 407, name: 'Proxy Authentication Required', desc: 'احراز هویت پروکسی لازم است' },
      { code: 408, name: 'Request Timeout', desc: 'وقفهٔ زمانی درخواست' },
      { code: 409, name: 'Conflict', desc: 'تعارض' },
      { code: 410, name: 'Gone', desc: 'حذف شده' },
      { code: 411, name: 'Length Required', desc: 'طول لازم است' },
      { code: 412, name: 'Precondition Failed', desc: 'پیش‌شرط ناموفق' },
      { code: 413, name: 'Payload Too Large', desc: 'حجم بیش از حد' },
      { code: 414, name: 'URI Too Long', desc: 'آدرس بیش از حد طولانی' },
      { code: 415, name: 'Unsupported Media Type', desc: 'نوع رسانه پشتیبانی نمی‌شود' },
      { code: 416, name: 'Range Not Satisfiable', desc: 'بازه قابل ارضا نیست' },
      { code: 417, name: 'Expectation Failed', desc: 'انتظار برآورده نشد' },
      { code: 418, name: "I'm a teapot", desc: 'من یک قوری چای هستم 🫖' },
      { code: 421, name: 'Misdirected Request', desc: 'درخواست اشتباه هدایت شد' },
      { code: 422, name: 'Unprocessable Entity', desc: 'موجودیت غیرقابل پردازش' },
      { code: 423, name: 'Locked', desc: 'قفل شده' },
      { code: 424, name: 'Failed Dependency', desc: 'وابستگی ناموفق' },
      { code: 425, name: 'Too Early', desc: 'خیلی زود' },
      { code: 426, name: 'Upgrade Required', desc: 'ارتقا لازم است' },
      { code: 428, name: 'Precondition Required', desc: 'پیش‌شرط لازم است' },
      { code: 429, name: 'Too Many Requests', desc: 'درخواست بیش از حد' },
      { code: 431, name: 'Request Header Fields Too Large', desc: 'هدر بیش از حد بزرگ' },
      { code: 451, name: 'Unavailable For Legal Reasons', desc: 'به دلایل قانونی در دسترس نیست' },
    ],
  },
  '5xx': {
    label: '5xx — خطای سرور',
    color: '5xx',
    codes: [
      { code: 500, name: 'Internal Server Error', desc: 'خطای داخلی سرور' },
      { code: 501, name: 'Not Implemented', desc: 'پیاده‌سازی نشده' },
      { code: 502, name: 'Bad Gateway', desc: 'دروازهٔ نامعتبر' },
      { code: 503, name: 'Service Unavailable', desc: 'سرویس در دسترس نیست' },
      { code: 504, name: 'Gateway Timeout', desc: 'وقفهٔ زمانی دروازه' },
      { code: 505, name: 'HTTP Version Not Supported', desc: 'نسخهٔ HTTP پشتیبانی نمی‌شود' },
      { code: 506, name: 'Variant Also Negotiates', desc: 'مذاکرهٔ نسخه' },
      { code: 507, name: 'Insufficient Storage', desc: 'فضای ناکافی' },
      { code: 508, name: 'Loop Detected', desc: 'حلقه شناسایی شد' },
      { code: 510, name: 'Not Extended', desc: 'توسعه‌نیافته' },
      { code: 511, name: 'Network Authentication Required', desc: 'احراز هویت شبکه لازم است' },
    ],
  },
};

/* ترتیب گره‌های مسیر اصلی (RTL: مرورگر → سرور) */
const PATH_NODES = ['browser', 'router', 'isp', 'backbone', 'edge', 'server'];

/* ==========================================================================
   وضعیت برنامه
   ========================================================================== */

const state = {
  animating: false,
  activeCode: null,
  filter: 'all',
  toastTimer: null,
};

/* ==========================================================================
   عناصر DOM
   ========================================================================== */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  timelineWrap: $('#timelineWrap'),
  timelineTrack: $('#timelineTrack'),
  nodesRow: $('#nodesRow'),
  packet: $('#packet'),
  dnsBranch: $('#dnsBranch'),
  btnPlay: $('#btnPlay'),
  btnReset: $('#btnReset'),
  statusGroups: $('#statusGroups'),
  toast: $('#toast'),
};

/* ==========================================================================
   رندر کارت‌های وضعیت
   ========================================================================== */

function renderStatusCards() {
  dom.statusGroups.innerHTML = '';

  Object.entries(HTTP_STATUS).forEach(([key, group]) => {
    const section = document.createElement('section');
    section.className = 'status-group';
    section.dataset.category = key;

    section.innerHTML = `
      <h3 class="status-group-title">${group.label}</h3>
      <div class="status-grid" role="list"></div>
    `;

    const grid = section.querySelector('.status-grid');

    group.codes.forEach((item) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'status-card';
      card.dataset.category = key;
      card.dataset.code = String(item.code);
      card.setAttribute('role', 'listitem');
      card.setAttribute(
        'aria-label',
        `کد ${item.code} — ${item.desc}`
      );
      card.innerHTML = `
        <span class="status-code">${item.code}</span>
        <div class="status-name">${item.name}</div>
        <div class="status-desc">${item.desc}</div>
      `;
      card.addEventListener('click', () => onStatusClick(item, key));
      grid.appendChild(card);
    });

    dom.statusGroups.appendChild(section);
  });

  applyFilter(state.filter);
}

function applyFilter(filter) {
  state.filter = filter;
  $$('.status-tab').forEach((tab) => {
    const isActive = tab.dataset.filter === filter;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  $$('.status-group').forEach((group) => {
    const cat = group.dataset.category;
    group.classList.toggle('hidden', filter !== 'all' && filter !== cat);
  });
}

/* ==========================================================================
   Toast
   ========================================================================== */

function showToast(message, category) {
  if (state.toastTimer) clearTimeout(state.toastTimer);

  dom.toast.textContent = message;
  dom.toast.className = 'toast show';
  if (category) dom.toast.classList.add(`theme-${category}`);

  state.toastTimer = setTimeout(() => {
    dom.toast.classList.remove('show');
  }, 3500);
}

/* ==========================================================================
   انیمیشن timeline
   ========================================================================== */

function getNodeElements() {
  return PATH_NODES.map((id) => document.querySelector(`[data-node="${id}"]`));
}

function clearNodeStates() {
  $$('.node').forEach((n) => {
    n.classList.remove('active', 'pulse');
  });
  dom.timelineWrap?.classList.remove(
    'theme-1xx', 'theme-2xx', 'theme-3xx', 'theme-4xx', 'theme-5xx', 'processing'
  );
  dom.dnsBranch?.classList.remove('querying');
  dom.packet?.classList.remove('visible', 'animating');
}

function isMobileLayout() {
  return window.matchMedia('(max-width: 768px)').matches;
}

/** موقعیت پکت روی گره (index) */
function positionPacketAtNode(nodeIndex) {
  const nodes = getNodeElements();
  const node = nodes[nodeIndex];
  if (!node || !dom.packet || !dom.timelineTrack) return;

  const trackRect = dom.timelineTrack.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();

  if (isMobileLayout()) {
    const top = nodeRect.top + nodeRect.height / 2 - trackRect.top - 7;
    dom.packet.style.top = `${top}px`;
    dom.packet.style.right = 'calc(50% - 7px)';
  } else {
    const right = trackRect.right - (nodeRect.left + nodeRect.width / 2) - 7;
    dom.packet.style.right = `${right}px`;
    dom.packet.style.top = 'calc(50% + 0.5rem)';
  }
}

function pulseNode(nodeIndex) {
  const nodes = getNodeElements();
  const node = nodes[nodeIndex];
  if (!node) return;
  node.classList.add('active', 'pulse');
  setTimeout(() => node.classList.remove('pulse'), 600);
}

function animateDnsQuery(duration = 800) {
  return new Promise((resolve) => {
    dom.dnsBranch?.classList.add('querying');
    const dnsNode = document.querySelector('[data-node="dns"]');
    dnsNode?.classList.add('active', 'pulse');
    setTimeout(() => {
      dom.dnsBranch?.classList.remove('querying');
      dnsNode?.classList.remove('active', 'pulse');
      resolve();
    }, duration);
  });
}

/** حرکت پکت از گره start تا end */
function animatePacketSegment(startIdx, endIdx, stepMs = 500) {
  return new Promise((resolve) => {
    const steps = Math.abs(endIdx - startIdx);
    if (steps === 0) {
      resolve();
      return;
    }

    const dir = endIdx > startIdx ? 1 : -1;
    let current = startIdx;
    let step = 0;

    const tick = () => {
      current += dir;
      step++;
      positionPacketAtNode(current);
      pulseNode(current);

      if (step < steps) {
        setTimeout(tick, stepMs);
      } else {
        resolve();
      }
    };

    setTimeout(tick, stepMs);
  });
}

/** پیمایش کامل مسیر (با DNS در ابتدا) */
async function playFullJourney(options = {}) {
  const { category = null, skipDns = false, manageLock = true } = options;

  if (manageLock) {
    if (state.animating) return;
    state.animating = true;
    dom.btnPlay.disabled = true;
  }

  if (category) dom.timelineWrap.classList.add(`theme-${category}`);

  dom.packet.classList.add('visible');
  positionPacketAtNode(0);
  pulseNode(0);

  if (!skipDns) await animateDnsQuery(900);

  const stepMs = 480;
  const lastIdx = PATH_NODES.length - 1;

  for (let i = 0; i < lastIdx; i++) {
    await animatePacketSegment(i, i + 1, stepMs);
  }

  if (manageLock) {
    state.animating = false;
    dom.btnPlay.disabled = false;
  }

  return lastIdx;
}

/** برگشت پکت از سرور به مرورگر */
async function animateReturn(fromIdx = PATH_NODES.length - 1) {
  const stepMs = 400;
  for (let i = fromIdx; i > 0; i--) {
    await animatePacketSegment(i, i - 1, stepMs);
  }
  pulseNode(0);
}

/* ==========================================================================
   رفتار کلیک روی کدهای وضعیت
   ========================================================================== */

function setActiveCard(code) {
  $$('.status-card').forEach((c) => {
    c.classList.toggle('active', c.dataset.code === String(code));
  });
  state.activeCode = code;
}

async function onStatusClick(item, category) {
  if (state.animating) return;

  state.animating = true;
  dom.btnPlay.disabled = true;

  setActiveCard(item.code);
  clearNodeStates();
  dom.timelineWrap.classList.add(`theme-${category}`);

  const code = item.code;
  const toastBase = `کد ${code} — ${item.desc}`;

  try {
    switch (category) {
      case '1xx': {
        dom.timelineWrap.classList.add('processing');
        showToast(`⏳ ${toastBase} — در حال پردازش...`, category);
        dom.packet.classList.add('visible');
        positionPacketAtNode(0);
        pulseNode(0);
        await animateDnsQuery(700);
        await animatePacketSegment(0, 2, 400);
        break;
      }

      case '2xx': {
        showToast(`✅ سرور پاسخ ${code} برگرداند — ${item.desc}`, category);
        await playFullJourney({ category: '2xx', manageLock: false });
        await animateReturn();
        showToast(`✅ پاسخ ${code} به مرورگر رسید!`, category);
        break;
      }

      case '3xx': {
        showToast(`↪️ ${toastBase} — هدایت به مقصد جدید`, category);
        await playFullJourney({ category: '3xx', manageLock: false });
        document.querySelector('[data-node="edge"]')?.classList.add('active', 'pulse');
        showToast(`↪️ پکت به آدرس جدید هدایت شد (${code})`, category);
        break;
      }

      case '4xx': {
        showToast(`⚠️ ${toastBase} — خطای کلاینت`, category);
        await playFullJourney({ category: '4xx', manageLock: false });
        document.querySelector('[data-node="server"]')?.classList.add('active');
        await animateReturn();
        showToast(`⚠️ سرور خطای ${code} برگرداند`, category);
        break;
      }

      case '5xx': {
        showToast(`❌ ${toastBase} — خطای سرور`, category);
        await playFullJourney({ category: '5xx', manageLock: false });
        const serverNode = document.querySelector('[data-node="server"]');
        serverNode?.classList.add('active', 'shake');
        setTimeout(() => serverNode?.classList.remove('shake'), 500);
        showToast(`❌ سرور با خطای ${code} از کار افتاد`, category);
        break;
      }
    }
  } finally {
    state.animating = false;
    dom.btnPlay.disabled = false;
  }
}

function resetTimeline() {
  if (state.animating) return;
  clearNodeStates();
  setActiveCard(null);
  dom.packet?.classList.remove('visible');
  if (state.toastTimer) clearTimeout(state.toastTimer);
  dom.toast?.classList.remove('show');
}

/* ==========================================================================
   رویدادها و راه‌اندازی
   ========================================================================== */

function bindEvents() {
  dom.btnPlay?.addEventListener('click', async () => {
    if (state.animating) return;
    clearNodeStates();
    showToast('🚀 شروع مسیر: URL → DNS → TCP → HTTP → سرور', null);
    await playFullJourney({ manageLock: true });
    showToast('📥 پاسخ HTTP دریافت شد', '2xx');
  });

  dom.btnReset?.addEventListener('click', resetTimeline);

  $$('.status-tab').forEach((tab) => {
    tab.addEventListener('click', () => applyFilter(tab.dataset.filter));
  });

  window.addEventListener('resize', () => {
    if (dom.packet?.classList.contains('visible')) {
      const activeNode = $$('.node.active');
      if (activeNode.length) {
        const idx = PATH_NODES.indexOf(activeNode[activeNode.length - 1].dataset.node);
        if (idx >= 0) positionPacketAtNode(idx);
      } else {
        positionPacketAtNode(0);
      }
    }
  });
}

function init() {
  renderStatusCards();
  bindEvents();
}

document.addEventListener('DOMContentLoaded', init);
