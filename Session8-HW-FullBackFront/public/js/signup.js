/* ============================================================
   Dakhlyar — Signup page (3-step wizard)
   Step 1: profile fields, on-blur duplicate check, Jalali date picker, age >= 18
   Step 2: 6-box OTP, 3:00 countdown, resend
   Step 3: live strength bar, checklist, confirm-match indicator
   ============================================================ */

(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  function toFa(n) { return String(n).replace(/[0-9]/g, (d) => FA_DIGITS[+d]); }
  function toEn(str) {
    return String(str ?? '')
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  }
  function fmtMMSS(s) {
    s = Math.max(0, s | 0);
    return `${toFa(String(Math.floor(s/60)).padStart(2,'0'))}:${toFa(String(s%60).padStart(2,'0'))}`;
  }
  function showToast(msg, type = 'success', t = 4000) {
    const el = $('#toast');
    if (!el) return;
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

  // ---------- Step navigation ----------
  const steps = {
    1: { panel: $('#step1'), dot: $('#dot1') },
    2: { panel: $('#step2'), dot: $('#dot2') },
    3: { panel: $('#step3'), dot: $('#dot3') },
  };
  let currentStep = 1;

  function goToStep(n) {
    for (let i = 1; i <= 3; i++) {
      steps[i].panel.classList.toggle('active', i === n);
      steps[i].dot.classList.remove('active', 'done');
      if (i < n) steps[i].dot.classList.add('done');
      else if (i === n) steps[i].dot.classList.add('active');
    }
    currentStep = n;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ============================================================
  //                       STEP 1 — Profile
  // ============================================================

  const su_mobile = $('#su_mobile');
  const su_email = $('#su_email');
  const su_nid = $('#su_nid');
  const su_birth = $('#su_birth');
  const su_birth_iso = $('#su_birth_iso');
  const su_invite = $('#su_invite');

  // ---------- Phase 3-C: optional invite code field ----------
  // We keep two pieces of state:
  //   inviteCodeRaw  : the latest value the user typed (UPPERCASE, no spaces)
  //   inviteValidated: the most-recently-confirmed valid code (or '')
  // We only POST /api/referral/apply with `inviteValidated`, never with the
  // raw value, so a half-typed code can never accidentally be applied.
  let inviteCodeRaw = '';
  let inviteValidated = '';
  let lastInviteValidationRequestId = 0;
  const INVITE_REGEX = /^DKHL-\d+$/;
  const su_inviteOk = $('#su_inviteOk');
  const su_inviteError = $('#su_inviteError');

  function clearInviteFeedback() {
    su_invite.classList.remove('is-invalid', 'is-valid');
    su_inviteError.textContent = '';
    su_inviteError.classList.remove('show');
    su_inviteOk.style.display = 'none';
    su_inviteOk.textContent = '';
  }

  if (su_invite) {
    su_invite.addEventListener('input', () => {
      // normalize: uppercase, strip whitespace + Persian/Arabic digits → ASCII
      let v = (su_invite.value || '')
        .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
        .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
        .replace(/\s+/g, '')
        .toUpperCase();
      if (v !== su_invite.value) su_invite.value = v;
      inviteCodeRaw = v;
      inviteValidated = '';
      clearInviteFeedback();
    });

    su_invite.addEventListener('blur', async () => {
      const v = inviteCodeRaw.trim();
      if (!v) { clearInviteFeedback(); return; }
      if (!INVITE_REGEX.test(v)) {
        inviteValidated = '';
        su_invite.classList.add('is-invalid');
        su_inviteError.textContent = 'فرمت کد دعوت صحیح نیست — نمونه: DKHL-12';
        su_inviteError.classList.add('show');
        su_inviteOk.style.display = 'none';
        return;
      }

      const reqId = ++lastInviteValidationRequestId;
      try {
        const res = await fetch(`/api/referral/validate/${encodeURIComponent(v)}`, {
          credentials: 'same-origin',
        });
        let data = null; try { data = await res.json(); } catch (_) {}
        // Drop stale responses (user typed something else in the meantime)
        if (reqId !== lastInviteValidationRequestId) return;
        if (res.ok && data && data.valid) {
          inviteValidated = v;
          su_invite.classList.remove('is-invalid');
          su_invite.classList.add('is-valid');
          su_inviteError.textContent = '';
          su_inviteError.classList.remove('show');
          su_inviteOk.textContent = `✓ دعوت‌کننده: ${data.inviter_name || 'کاربر دخلیار'}`;
          su_inviteOk.style.display = 'block';
        } else {
          inviteValidated = '';
          su_invite.classList.add('is-invalid');
          su_inviteOk.style.display = 'none';
          su_inviteError.textContent = (data && data.message) || 'کد دعوت معتبر نیست';
          su_inviteError.classList.add('show');
        }
      } catch (_) {
        if (reqId !== lastInviteValidationRequestId) return;
        inviteValidated = '';
        su_invite.classList.add('is-invalid');
        su_inviteOk.style.display = 'none';
        su_inviteError.textContent = 'خطای ارتباط با سرور — کد دعوت بررسی نشد';
        su_inviteError.classList.add('show');
      }
    });
  }

  su_mobile.addEventListener('input', () => {
    su_mobile.value = toEn(su_mobile.value).replace(/[^0-9]/g, '').slice(0, 11);
    setError(su_mobile, $('#su_mobileError'), '');
  });
  su_nid.addEventListener('input', () => {
    su_nid.value = toEn(su_nid.value).replace(/[^0-9]/g, '').slice(0, 10);
    setError(su_nid, $('#su_nidError'), '');
  });
  su_email.addEventListener('input', () => {
    setError(su_email, $('#su_emailError'), '');
  });

  // --- Jalali (Shamsi) date picker ---
  // NOTE: this uses persian-datepicker v1.2.0 (jQuery plugin) loaded from CDN.
  // We must use window.jQuery explicitly to avoid clashing with our local `$` helper.
  let birthIsoSelected = '';
  const jq = window.jQuery;

  if (jq && typeof jq.fn.persianDatepicker === 'function' && typeof window.persianDate === 'function') {
    // محدوده مجاز: از امروز تا ۱۲۰ سال قبل
    const maxAllowed = new window.persianDate().valueOf();
    const minAllowed = new window.persianDate().subtract('year', 120).valueOf();
    // نمای پیش‌فرض تقویم در اولین باز شدن (۲۵ سال قبل برای تجربه بهتر)
    const defaultJalaliView = new window.persianDate().subtract('year', 25).valueOf();

    jq(su_birth).persianDatepicker({
      format: 'YYYY/MM/DD',
      autoClose: true,
      initialValue: false,
      initialValueType: 'persian',
      persianDigit: true,
      observer: true,
      minDate: minAllowed,
      maxDate: maxAllowed,
      navigator: {
        text: { btnNextText: '›', btnPrevText: '‹' },
      },
      toolbox: {
        calendarSwitch: { enabled: false },
        todayButton: { enabled: false },
        submitButton: { enabled: false },
      },
      onSelect: function (unix) {
        const gDate = new Date(unix);
        const y = gDate.getFullYear();
        const m = String(gDate.getMonth() + 1).padStart(2, '0');
        const d = String(gDate.getDate()).padStart(2, '0');
        birthIsoSelected = `${y}-${m}-${d}`;
        su_birth_iso.value = birthIsoSelected;
        setError(su_birth, $('#su_birthError'), '');
        validateAge();
      },
    });

    // در اولین focus، اگر هنوز تاریخی انتخاب نشده، تقویم را روی ۲۵ سال قبل باز کن
    su_birth.addEventListener('focus', () => {
      if (!birthIsoSelected) {
        const dp = jq(su_birth).data('datepicker');
        if (dp && dp.navigate) {
          try { dp.navigate(defaultJalaliView); } catch (_) {}
        }
      }
    });
  } else {
    console.warn('persianDatepicker not loaded, falling back to manual YYYY-MM-DD entry');
    su_birth.readOnly = false;
    su_birth.placeholder = 'YYYY-MM-DD (میلادی)';
    su_birth.addEventListener('input', () => {
      birthIsoSelected = su_birth.value.trim();
      su_birth_iso.value = birthIsoSelected;
      validateAge();
    });
  }

  function computeAge(iso) {
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(iso)) return null;
    const b = new Date(iso + 'T00:00:00Z');
    if (isNaN(b.getTime())) return null;
    const now = new Date();
    let age = now.getUTCFullYear() - b.getUTCFullYear();
    const m = now.getUTCMonth() - b.getUTCMonth();
    if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age -= 1;
    return age;
  }

  function validateAge() {
    const age = computeAge(birthIsoSelected);
    if (age === null) {
      setError(su_birth, $('#su_birthError'), 'تاریخ تولد را انتخاب کنید');
      return false;
    }
    if (age < 0) {
      setError(su_birth, $('#su_birthError'), 'تاریخ تولد نمی‌تواند در آینده باشد');
      return false;
    }
    if (age > 120) {
      setError(
        su_birth,
        $('#su_birthError'),
        'تاریخ تولد معتبر نیست — حداکثر سن مجاز ۱۲۰ سال است'
      );
      return false;
    }
    setError(su_birth, $('#su_birthError'), '');
    setValid(su_birth);
    return true;
  }

  // --- on-blur duplicate check ---
  async function checkDuplicates(payload) {
    try {
      const { data } = await apiPost('/api/auth/check-duplicates', payload);
      return data || {};
    } catch (_) { return {}; }
  }

  su_mobile.addEventListener('blur', async () => {
    const v = su_mobile.value.trim();
    if (!v) return;
    if (!/^09[0-9]{9}$/.test(v)) {
      setError(su_mobile, $('#su_mobileError'), 'فرمت شماره موبایل معتبر نیست');
      return;
    }
    const r = await checkDuplicates({ mobile: v });
    if (r.mobile_taken) setError(su_mobile, $('#su_mobileError'), 'این شماره موبایل قبلاً ثبت شده است');
    else setValid(su_mobile);
  });

  su_email.addEventListener('blur', async () => {
    const v = su_email.value.trim();
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError(su_email, $('#su_emailError'), 'آدرس ایمیل معتبر نیست');
      return;
    }
    const r = await checkDuplicates({ email: v });
    if (r.email_taken) setError(su_email, $('#su_emailError'), 'این ایمیل قبلاً ثبت شده است');
    else setValid(su_email);
  });

  su_nid.addEventListener('blur', async () => {
    const v = su_nid.value.trim();
    if (!v) return;
    if (!/^[0-9]{10}$/.test(v)) {
      setError(su_nid, $('#su_nidError'), 'کد ملی باید ۱۰ رقم عددی باشد');
      return;
    }
    const r = await checkDuplicates({ national_id: v });
    if (r.national_id_taken) setError(su_nid, $('#su_nidError'), 'این کد ملی قبلاً ثبت شده است');
    else setValid(su_nid);
  });

  // --- Step 1 NEXT: validate + send OTP ---
  $('#step1NextBtn').addEventListener('click', async () => {
    const mobile = su_mobile.value.trim();
    const email = su_email.value.trim();
    const nid = su_nid.value.trim();
    const birthIso = birthIsoSelected;

    let ok = true;
    if (!/^09[0-9]{9}$/.test(mobile)) {
      setError(su_mobile, $('#su_mobileError'), 'فرمت شماره موبایل معتبر نیست'); ok = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(su_email, $('#su_emailError'), 'آدرس ایمیل معتبر نیست'); ok = false;
    }
    if (!/^[0-9]{10}$/.test(nid)) {
      setError(su_nid, $('#su_nidError'), 'کد ملی باید ۱۰ رقم عددی باشد'); ok = false;
    }
    if (!validateAge()) ok = false;
    if (!ok) return;

    const dup = await checkDuplicates({ mobile, email, national_id: nid });
    let dupHit = false;
    if (dup.mobile_taken) { setError(su_mobile, $('#su_mobileError'), 'این شماره موبایل قبلاً ثبت شده است'); dupHit = true; }
    if (dup.email_taken) { setError(su_email, $('#su_emailError'), 'این ایمیل قبلاً ثبت شده است'); dupHit = true; }
    if (dup.national_id_taken) { setError(su_nid, $('#su_nidError'), 'این کد ملی قبلاً ثبت شده است'); dupHit = true; }
    if (dupHit) return;

    const btn = $('#step1NextBtn');
    btn.disabled = true; btn.textContent = 'در حال ارسال کد...';
    const loadingToken = window.DakhlyarModal
      ? window.DakhlyarModal.loading({ message: 'در حال ارسال کد تایید…' })
      : null;
    try {
      const { status, data } = await apiPost('/api/auth/send-otp', { email, type: 'signup' });
      if (status === 200) {
        $('#su_emailHint').textContent = email;
        goToStep(2);
        startOtpCountdown();
        $$('#su_otpRow .otp-input')[0]?.focus();
      } else if (window.DakhlyarModal) {
        window.DakhlyarModal.alert({
          title: 'ارسال کد ناموفق بود',
          message: data.message || 'ارسال کد ناموفق بود',
          subType: 'error',
        });
      } else {
        showToast(data.message || 'ارسال کد ناموفق بود', 'error');
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
      btn.disabled = false; btn.textContent = 'ادامه';
    }
  });

  // ============================================================
  //                       STEP 2 — OTP
  // ============================================================

  const otpInputs = $$('#su_otpRow .otp-input');
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
    const el = $('#su_countdown');
    const resend = $('#su_resendBtn');
    resend.disabled = true;
    el.parentElement.classList.remove('zero');
    el.textContent = fmtMMSS(remaining);
    otpTimer = setInterval(() => {
      remaining -= 1;
      el.textContent = fmtMMSS(remaining);
      if (remaining <= 0) {
        clearInterval(otpTimer);
        otpTimer = null;
        el.parentElement.classList.add('zero');
        resend.disabled = false;
      }
    }, 1000);
  }

  $('#su_resendBtn').addEventListener('click', async () => {
    const email = su_email.value.trim();
    const btn = $('#su_resendBtn');
    btn.disabled = true;
    const loadingToken = window.DakhlyarModal
      ? window.DakhlyarModal.loading({ message: 'در حال ارسال مجدد کد…' })
      : null;
    try {
      const { status, data } = await apiPost('/api/auth/send-otp', { email, type: 'signup' });
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
      showToast('خطای ارتباط با سرور', 'error');
      btn.disabled = false;
    }
  });

  $('#step2BackBtn').addEventListener('click', () => {
    if (otpTimer) { clearInterval(otpTimer); otpTimer = null; }
    goToStep(1);
  });

  $('#step2NextBtn').addEventListener('click', async () => {
    const code = otpInputs.map((i) => i.value).join('');
    const errEl = $('#su_otpError');
    errEl.classList.remove('show'); errEl.textContent = '';
    if (!/^[0-9]{6}$/.test(code)) {
      errEl.textContent = 'کد ۶ رقمی را کامل وارد کنید';
      errEl.classList.add('show');
      return;
    }
    const btn = $('#step2NextBtn');
    btn.disabled = true; btn.textContent = 'در حال بررسی...';
    try {
      const { status, data } = await apiPost('/api/auth/verify-otp', {
        email: su_email.value.trim(),
        code,
        type: 'signup',
      });
      if (status === 200 && data.verified) {
        if (otpTimer) { clearInterval(otpTimer); otpTimer = null; }
        goToStep(3);
        setTimeout(() => $('#su_pass').focus(), 200);
      } else {
        errEl.textContent = data.message || 'کد وارد شده اشتباه است';
        errEl.classList.add('show');
      }
    } catch (e) {
      console.error(e);
      showToast('خطای ارتباط با سرور', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'تایید و ادامه';
    }
  });

  // ============================================================
  //                STEP 3 — Password + submit
  // ============================================================

  const passInp = $('#su_pass');
  const passInp2 = $('#su_pass2');
  const checklist = $('#su_checklist');
  const strengthBar = $('#su_strength');
  const matchEl = $('#su_matchIndicator');

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

  $('#step3BackBtn').addEventListener('click', () => {
    goToStep(2);
    startOtpCountdown();
  });

  $('#step3SubmitBtn').addEventListener('click', async () => {
    const password = passInp.value;
    const confirm = passInp2.value;
    const rules = evalRules(password);
    const allOk = Object.values(rules).every(Boolean);
    if (!allOk) {
      showToast('رمز عبور با شرایط مطابقت ندارد', 'error');
      return;
    }
    if (password !== confirm) {
      matchEl.textContent = '✗ رمز عبور و تکرار آن یکسان نیستند';
      matchEl.className = 'match-indicator bad';
      return;
    }

    const btn = $('#step3SubmitBtn');
    btn.disabled = true; btn.textContent = 'در حال ثبت...';
    try {
      const { status, data } = await apiPost('/api/auth/register', {
        mobile: su_mobile.value.trim(),
        email: su_email.value.trim(),
        national_id: su_nid.value.trim(),
        birth_date: birthIsoSelected,
        password,
        confirm_password: confirm,
      });
      if (status === 200 && data.success) {
        // Phase 3-C — attach referral if a validated invite code is present.
        // Failure of this call must NEVER block registration success; we just
        // log it and let the user move on. Validation already happened on
        // blur, so most users hit the happy path here.
        if (inviteValidated && data.user_id) {
          try {
            await apiPost('/api/referral/apply', {
              invitee_user_id: data.user_id,
              invite_code: inviteValidated,
            });
          } catch (refErr) {
            console.warn('[signup] referral apply failed (non-blocking)', refErr);
          }
        }
        showToast('ثبت‌نام با موفقیت انجام شد', 'success');
        setTimeout(() => { location.href = '/?registered=1'; }, 700);
      } else {
        showToast(data.message || 'ثبت‌نام ناموفق بود', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('خطای ارتباط با سرور', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'تکمیل ثبت‌نام';
    }
  });
})();
