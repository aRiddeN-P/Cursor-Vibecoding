/* ============================================================
   Dakhlyar — Forgot Password page (3-step wizard)
   Step 1: email      → POST /api/auth/forgot-password
   Step 2: 6-digit OTP → POST /api/auth/verify-otp (type=reset_password)
   Step 3: new password → POST /api/auth/reset-password
   On success → redirect to /?password_reset=1
   ============================================================ */

(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  function toFa(n) { return String(n).replace(/[0-9]/g, (d) => FA_DIGITS[+d]); }
  function fmtMMSS(s) {
    s = Math.max(0, s | 0);
    return `${toFa(String(Math.floor(s/60)).padStart(2,'0'))}:${toFa(String(s%60).padStart(2,'0'))}`;
  }
  function showToast(msg, type = 'success', t = 4000) {
    const el = $('#toast'); if (!el) return;
    el.textContent = msg;
    el.className = 'toast show' + (type === 'error' ? ' error' : '');
    setTimeout(() => { el.className = 'toast'; }, t);
  }
  function setError(inp, errEl, msg) {
    if (msg) {
      inp.classList.add('is-invalid'); inp.classList.remove('is-valid');
      errEl.textContent = msg; errEl.classList.add('show');
    } else {
      inp.classList.remove('is-invalid');
      errEl.textContent = ''; errEl.classList.remove('show');
    }
  }
  function setValid(inp) { inp.classList.remove('is-invalid'); inp.classList.add('is-valid'); }

  async function apiPost(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body || {}),
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { ok: res.ok, status: res.status, data: data || {} };
  }

  // ---------- show/hide password ----------
  $$('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById(btn.dataset.toggle);
      if (!inp) return;
      if (inp.type === 'password') { inp.type = 'text'; btn.textContent = 'پنهان'; }
      else { inp.type = 'password'; btn.textContent = 'نمایش'; }
    });
  });

  // ---------- Stepper ----------
  const steps = {
    1: { panel: $('#fp_step1'), dot: $('#fp_dot1') },
    2: { panel: $('#fp_step2'), dot: $('#fp_dot2') },
    3: { panel: $('#fp_step3'), dot: $('#fp_dot3') },
  };
  function goToStep(n) {
    for (let i = 1; i <= 3; i++) {
      steps[i].panel.classList.toggle('active', i === n);
      steps[i].dot.classList.remove('active', 'done');
      if (i < n) steps[i].dot.classList.add('done');
      else if (i === n) steps[i].dot.classList.add('active');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  let emailValue = '';

  // ============================================================
  //                   STEP 1 — Email
  // ============================================================

  const emailInp = $('#fp_email');
  emailInp.addEventListener('input', () => setError(emailInp, $('#fp_emailError'), ''));

  $('#fp_sendBtn').addEventListener('click', async () => {
    const email = emailInp.value.trim();
    setError(emailInp, $('#fp_emailError'), '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(emailInp, $('#fp_emailError'), 'آدرس ایمیل معتبر نیست');
      return;
    }

    const btn = $('#fp_sendBtn');
    btn.disabled = true; btn.textContent = 'در حال ارسال...';
    const loadingToken = window.DakhlyarModal
      ? window.DakhlyarModal.loading({ message: 'در حال ارسال کد بازیابی…' })
      : null;
    try {
      const { status, data } = await apiPost('/api/auth/forgot-password', { email });
      if (status === 200) {
        emailValue = email;
        setValid(emailInp);
        $('#fp_emailHint').textContent = email;
        goToStep(2);
        startOtpCountdown();
        $$('#fp_otpRow .otp-input')[0]?.focus();
        showToast(data.message || 'کد بازیابی به ایمیل شما ارسال شد', 'success');
      } else if (status === 404) {
        setError(emailInp, $('#fp_emailError'), data.message || 'حسابی با این ایمیل یافت نشد');
      } else if (status === 422) {
        setError(emailInp, $('#fp_emailError'), data.message || 'آدرس ایمیل معتبر نیست');
      } else if (window.DakhlyarModal) {
        window.DakhlyarModal.alert({ message: data.message || 'خطای سرور', subType: 'error' });
      } else {
        showToast(data.message || 'خطای سرور', 'error');
      }
    } catch (e) {
      console.error(e);
      if (window.DakhlyarModal) {
        window.DakhlyarModal.alert({ message: 'خطای ارتباط با سرور', subType: 'error' });
      } else {
        showToast('خطای ارتباط با سرور', 'error');
      }
    } finally {
      if (loadingToken) window.DakhlyarModal.closeLoading(loadingToken);
      btn.disabled = false; btn.textContent = 'ارسال کد بازیابی';
    }
  });

  // ============================================================
  //                   STEP 2 — OTP
  // ============================================================

  const otpInputs = $$('#fp_otpRow .otp-input');
  otpInputs.forEach((inp, idx) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (inp.value) {
        inp.classList.add('filled');
        if (idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
      } else {
        inp.classList.remove('filled');
      }
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !inp.value && idx > 0) {
        otpInputs[idx - 1].focus();
      }
    });
    inp.addEventListener('paste', (e) => {
      const data = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      const digits = data.replace(/[^0-9]/g, '').slice(0, 6).split('');
      if (!digits.length) return;
      e.preventDefault();
      digits.forEach((d, i) => {
        if (otpInputs[i]) {
          otpInputs[i].value = d;
          otpInputs[i].classList.add('filled');
        }
      });
      otpInputs[Math.min(digits.length, otpInputs.length - 1)].focus();
    });
  });

  let otpTimer = null;
  function startOtpCountdown() {
    if (otpTimer) clearInterval(otpTimer);
    let remaining = 180;
    const el = $('#fp_countdown');
    const resend = $('#fp_resendBtn');
    resend.disabled = true;
    el.parentElement.classList.remove('zero');
    el.textContent = fmtMMSS(remaining);
    otpTimer = setInterval(() => {
      remaining -= 1;
      el.textContent = fmtMMSS(remaining);
      if (remaining <= 0) {
        clearInterval(otpTimer); otpTimer = null;
        el.parentElement.classList.add('zero');
        resend.disabled = false;
      }
    }, 1000);
  }

  $('#fp_resendBtn').addEventListener('click', async () => {
    if (!emailValue) return;
    const btn = $('#fp_resendBtn');
    btn.disabled = true;
    const loadingToken = window.DakhlyarModal
      ? window.DakhlyarModal.loading({ message: 'در حال ارسال مجدد کد…' })
      : null;
    try {
      const { status, data } = await apiPost('/api/auth/forgot-password', { email: emailValue });
      if (loadingToken) window.DakhlyarModal.closeLoading(loadingToken);
      if (status === 200) {
        otpInputs.forEach((i) => { i.value = ''; i.classList.remove('filled'); });
        otpInputs[0].focus();
        startOtpCountdown();
        showToast('کد جدید ارسال شد', 'success');
      } else {
        if (window.DakhlyarModal) {
          window.DakhlyarModal.alert({
            title: 'ارسال کد ناموفق بود',
            message: data.message || 'ارسال کد ناموفق بود',
            subType: 'error',
          });
        } else {
          showToast(data.message || 'ارسال کد ناموفق بود', 'error');
        }
        btn.disabled = false;
      }
    } catch (e) {
      if (loadingToken) window.DakhlyarModal.closeLoading(loadingToken);
      console.error(e);
      if (window.DakhlyarModal) {
        window.DakhlyarModal.alert({ message: 'خطای ارتباط با سرور', subType: 'error' });
      } else {
        showToast('خطای ارتباط با سرور', 'error');
      }
      btn.disabled = false;
    }
  });

  $('#fp_backBtn2').addEventListener('click', () => {
    if (otpTimer) { clearInterval(otpTimer); otpTimer = null; }
    goToStep(1);
  });

  $('#fp_verifyBtn').addEventListener('click', async () => {
    const code = otpInputs.map((i) => i.value).join('');
    const errEl = $('#fp_otpError');
    errEl.classList.remove('show'); errEl.textContent = '';
    if (!/^[0-9]{6}$/.test(code)) {
      errEl.textContent = 'کد ۶ رقمی را کامل وارد کنید';
      errEl.classList.add('show');
      return;
    }
    const btn = $('#fp_verifyBtn');
    btn.disabled = true; btn.textContent = 'در حال بررسی...';
    try {
      const { status, data } = await apiPost('/api/auth/verify-otp', {
        email: emailValue,
        code,
        type: 'reset_password',
      });
      if (status === 200 && data.verified) {
        if (otpTimer) { clearInterval(otpTimer); otpTimer = null; }
        goToStep(3);
        setTimeout(() => $('#fp_pass').focus(), 200);
      } else {
        errEl.textContent = data.message || 'کد وارد شده اشتباه است';
        errEl.classList.add('show');
      }
    } catch (e) {
      console.error(e);
      showToast('خطای ارتباط با سرور', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'تایید کد';
    }
  });

  // ============================================================
  //                STEP 3 — New password + submit
  // ============================================================

  const passInp = $('#fp_pass');
  const passInp2 = $('#fp_pass2');
  const checklist = $('#fp_checklist');
  const strengthBar = $('#fp_strength');
  const matchEl = $('#fp_matchIndicator');

  function evalRules(p) {
    return {
      length: p.length >= 8,
      upper: /[A-Z]/.test(p),
      digit: /[0-9]/.test(p),
      special: /[!@#$%^&*]/.test(p),
    };
  }
  function renderStrength() {
    const p = passInp.value;
    const rules = evalRules(p);
    $$('li[data-rule]', checklist).forEach((li) => {
      li.classList.toggle('ok', !!rules[li.dataset.rule]);
    });
    const score = Object.values(rules).filter(Boolean).length;
    strengthBar.classList.remove('s1', 's2', 's3', 's4');
    if (score >= 1) strengthBar.classList.add('s' + score);
  }
  function renderMatch() {
    const a = passInp.value;
    const b = passInp2.value;
    if (!b) { matchEl.textContent = ''; matchEl.className = 'match-indicator'; return; }
    if (a === b) { matchEl.textContent = '✓ رمز عبور و تکرار آن یکسان هستند'; matchEl.className = 'match-indicator ok'; }
    else { matchEl.textContent = '✗ رمز عبور و تکرار آن یکسان نیستند'; matchEl.className = 'match-indicator bad'; }
  }
  passInp.addEventListener('input', () => { renderStrength(); renderMatch(); });
  passInp2.addEventListener('input', renderMatch);

  $('#fp_backBtn3').addEventListener('click', () => {
    goToStep(2);
    startOtpCountdown();
  });

  $('#fp_resetBtn').addEventListener('click', async () => {
    const password = passInp.value;
    const confirm = passInp2.value;
    const rules = evalRules(password);
    const allOk = Object.values(rules).every(Boolean);
    if (!allOk) { showToast('رمز عبور با شرایط مطابقت ندارد', 'error'); return; }
    if (password !== confirm) {
      matchEl.textContent = '✗ رمز عبور و تکرار آن یکسان نیستند';
      matchEl.className = 'match-indicator bad';
      return;
    }

    const btn = $('#fp_resetBtn');
    btn.disabled = true; btn.textContent = 'در حال تغییر...';
    try {
      const { status, data } = await apiPost('/api/auth/reset-password', {
        email: emailValue,
        new_password: password,
        confirm_password: confirm,
      });
      if (status === 200 && data.success) {
        showToast(data.message || 'رمز عبور با موفقیت تغییر یافت', 'success');
        setTimeout(() => { location.href = '/?password_reset=1'; }, 700);
      } else {
        showToast(data.message || 'تغییر رمز عبور ناموفق بود', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('خطای ارتباط با سرور', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'تغییر رمز عبور';
    }
  });
})();
