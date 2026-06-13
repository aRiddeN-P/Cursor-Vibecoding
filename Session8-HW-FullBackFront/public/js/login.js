/* ============================================================
   Dakhlyar — Login page frontend
   - Form submission with inline errors
   - Lockout banner with live MM:SS countdown
   - Success toast on ?registered=1 or ?password_reset=1
   - "فراموشی رمز عبور" is now a link to /forgot-password.html
   ============================================================ */

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);

  const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  function toFa(n) { return String(n).replace(/[0-9]/g, (d) => FA_DIGITS[+d]); }
  function toEn(str) {
    return String(str ?? '')
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  }
  function fmtMMSS(totalSec) {
    const s = Math.max(0, totalSec | 0);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${toFa(mm)}:${toFa(ss)}`;
  }

  function showToast(message, type = 'success', timeout = 4500) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = message;
    t.className = 'toast show' + (type === 'error' ? ' error' : '');
    setTimeout(() => { t.className = 'toast'; }, timeout);
  }

  function setError(inputEl, errorEl, message) {
    if (message) {
      inputEl.classList.add('is-invalid');
      errorEl.textContent = message;
      errorEl.classList.add('show');
    } else {
      inputEl.classList.remove('is-invalid');
      errorEl.textContent = '';
      errorEl.classList.remove('show');
    }
  }

  async function apiPost(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body || {}),
    });
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    return { ok: res.ok, status: res.status, data: data || {} };
  }

  // ---------- success toasts from query params ----------
  const params = new URLSearchParams(location.search);
  if (params.get('registered') === '1') {
    showToast('ثبت‌نام با موفقیت انجام شد. وارد شوید', 'success', 5000);
  } else if (params.get('password_reset') === '1') {
    showToast('رمز عبور با موفقیت تغییر یافت. اکنون وارد شوید', 'success', 5000);
  }
  if (params.has('registered') || params.has('password_reset')) {
    if (history.replaceState) {
      history.replaceState({}, '', location.pathname);
    }
  }

  // ---------- show/hide password ----------
  $('#togglePass')?.addEventListener('click', () => {
    const inp = $('#password');
    const btn = $('#togglePass');
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = 'پنهان'; }
    else { inp.type = 'password'; btn.textContent = 'نمایش'; }
  });

  // ---------- Mobile + password input cleanup ----------
  const mobileInput = $('#mobile');
  mobileInput?.addEventListener('input', () => {
    mobileInput.value = toEn(mobileInput.value).replace(/[^0-9]/g, '').slice(0, 11);
    setError(mobileInput, $('#mobileError'), '');
  });
  $('#password')?.addEventListener('input', () => {
    setError($('#password'), $('#passwordError'), '');
  });

  // ---------- Lockout state ----------
  let lockTimer = null;

  function startLockout(remainingSeconds, baseMessage) {
    stopLockout();
    const submitBtn = $('#submitBtn');
    const banner = $('#lockBanner');
    const passInput = $('#password');
    const mobileInp = $('#mobile');

    submitBtn.disabled = true;
    passInput.disabled = true;
    mobileInp.disabled = true;
    banner.classList.add('show');

    let remaining = remainingSeconds;
    const render = () => {
      banner.innerHTML = `${baseMessage} — زمان باقی‌مانده: <strong>${fmtMMSS(remaining)}</strong>`;
    };
    render();

    lockTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) { stopLockout(); return; }
      render();
    }, 1000);
  }

  function stopLockout() {
    if (lockTimer) { clearInterval(lockTimer); lockTimer = null; }
    $('#submitBtn').disabled = false;
    $('#password').disabled = false;
    $('#mobile').disabled = false;
    $('#lockBanner').classList.remove('show');
    $('#lockBanner').innerHTML = '';
  }

  // ---------- Login submit ----------
  $('#loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mobile = toEn($('#mobile').value.trim());
    const password = $('#password').value;

    setError($('#mobile'), $('#mobileError'), '');
    setError($('#password'), $('#passwordError'), '');

    if (!/^09[0-9]{9}$/.test(mobile)) {
      setError($('#mobile'), $('#mobileError'), 'فرمت شماره موبایل معتبر نیست');
      return;
    }
    if (!password) {
      setError($('#password'), $('#passwordError'), 'رمز عبور را وارد کنید');
      return;
    }

    const submitBtn = $('#submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'در حال ورود...';

    try {
      const { status, data } = await apiPost('/api/auth/login', { mobile, password });

      if (status === 200 && data.success) {
        showToast('ورود موفق — در حال انتقال...', 'success', 2000);
        setTimeout(() => { location.href = '/dashboard'; }, 700);
        return;
      }

      if (status === 423) {
        startLockout(
          data.remaining_seconds || 600,
          data.message || 'حساب شما به مدت ۱۰ دقیقه قفل شده است'
        );
        return;
      }

      if (status === 422) {
        setError($('#mobile'), $('#mobileError'), data.message || 'فرمت شماره موبایل معتبر نیست');
        return;
      }

      if (status === 404) {
        setError(
          $('#mobile'),
          $('#mobileError'),
          data.message || 'حسابی با این شماره موبایل ثبت نشده است'
        );
        return;
      }

      if (status === 401) {
        const extra = typeof data.attempts_left === 'number'
          ? ` (${toFa(data.attempts_left)} تلاش باقی‌مانده)`
          : '';
        setError(
          $('#password'),
          $('#passwordError'),
          (data.message || 'رمز عبور اشتباه است') + extra
        );
        return;
      }

      showToast(data.message || 'خطای سرور', 'error');
    } catch (err) {
      console.error(err);
      showToast('خطای ارتباط با سرور', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'ورود';
    }
  });
})();
