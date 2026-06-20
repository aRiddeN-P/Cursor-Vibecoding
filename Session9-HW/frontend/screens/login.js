import { sendOtp, verifyOtp } from '../api/auth.js';
import { setToken } from '../utils/auth.js';
import { toEnglishDigits } from '../utils/digits.js';
import { showApiError } from '../utils/show-error.js';
import { loadingHtml } from '../components/loading.js';

const PHONE_PATTERN = /^09\d{9}$/;

export function renderLogin(container, { onSuccess }) {
  let step = 1;
  let phoneNumber = '';

  container.innerHTML = `
    <div class="screen">
      <div class="logo-mark">
        <div class="logo-mark__icon" aria-hidden="true">🌙</div>
        <span>لالایی</span>
      </div>
      <div class="auth-card" id="auth-card"></div>
    </div>
  `;

  const card = container.querySelector('#auth-card');

  function renderStep() {
    if (step === 1) {
      renderPhoneStep();
    } else {
      renderOtpStep();
    }
  }

  function renderPhoneStep() {
    card.innerHTML = `
      <h2 class="auth-card__title">ورود</h2>
      <p class="auth-card__subtitle">شماره موبایل خود را وارد کنید</p>
      <input
        type="tel"
        class="input-field"
        id="phone-input"
        placeholder="۰۹۱۲۳۴۵۶۷۸۹"
        inputmode="numeric"
        autocomplete="tel"
        maxlength="11"
      />
      <button type="button" class="btn-primary" id="send-btn" disabled>ارسال کد</button>
    `;

    const input = card.querySelector('#phone-input');
    const btn = card.querySelector('#send-btn');

    input.addEventListener('input', () => {
      const digits = toEnglishDigits(input.value).replace(/\D/g, '');
      input.value = digits;
      btn.disabled = !PHONE_PATTERN.test(digits);
    });

    btn.addEventListener('click', async () => {
      const digits = toEnglishDigits(input.value).replace(/\D/g, '');
      if (!PHONE_PATTERN.test(digits)) return;

      btn.disabled = true;
      card.insertAdjacentHTML('beforeend', loadingHtml('در حال ارسال کد...'));

      try {
        await sendOtp(digits);
        phoneNumber = digits;
        step = 2;
        renderStep();
      } catch (err) {
        card.querySelector('.lalayi-loading')?.remove();
        await showApiError(err);
        btn.disabled = false;
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !btn.disabled) btn.click();
    });

    input.focus();
  }

  function renderOtpStep() {
    card.innerHTML = `
      <h2 class="auth-card__title">کد تایید</h2>
      <p class="auth-card__subtitle">کد ۴ رقمی ارسال‌شده را وارد کنید</p>
      <div class="otp-row" id="otp-row">
        ${[0, 1, 2, 3].map((i) => `<input type="text" class="otp-digit" maxlength="1" inputmode="numeric" data-index="${i}" aria-label="رقم ${i + 1}" />`).join('')}
      </div>
      <button type="button" class="btn-primary" id="verify-btn" disabled>تایید</button>
      <button type="button" class="link-back" id="back-btn">شماره را اشتباه وارد کردم</button>
    `;

    const digits = card.querySelectorAll('.otp-digit');
    const verifyBtn = card.querySelector('#verify-btn');
    const backBtn = card.querySelector('#back-btn');

    function getOtpValue() {
      return Array.from(digits)
        .map((d) => toEnglishDigits(d.value).replace(/\D/g, ''))
        .join('');
    }

    function updateVerifyState() {
      verifyBtn.disabled = getOtpValue().length !== 4;
    }

    digits.forEach((input, index) => {
      input.addEventListener('input', () => {
        const val = toEnglishDigits(input.value).replace(/\D/g, '');
        input.value = val.slice(-1);

        if (val && index < digits.length - 1) {
          digits[index + 1].focus();
        }
        updateVerifyState();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
          digits[index - 1].focus();
        }
        if (e.key === 'Enter' && !verifyBtn.disabled) {
          verifyBtn.click();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = toEnglishDigits(e.clipboardData.getData('text')).replace(/\D/g, '').slice(0, 4);
        pasted.split('').forEach((ch, i) => {
          if (digits[i]) digits[i].value = ch;
        });
        const focusIndex = Math.min(pasted.length, 3);
        digits[focusIndex].focus();
        updateVerifyState();
      });
    });

    verifyBtn.addEventListener('click', async () => {
      const otp = getOtpValue();
      if (otp.length !== 4) return;

      verifyBtn.disabled = true;
      card.insertAdjacentHTML('beforeend', loadingHtml('در حال ورود...'));

      try {
        const result = await verifyOtp(phoneNumber, otp);
        setToken(result.token);
        onSuccess(result.is_new_user);
      } catch (err) {
        card.querySelector('.lalayi-loading')?.remove();
        await showApiError(err);
        verifyBtn.disabled = false;
      }
    });

    backBtn.addEventListener('click', () => {
      step = 1;
      renderStep();
    });

    digits[0].focus();
  }

  renderStep();
}
