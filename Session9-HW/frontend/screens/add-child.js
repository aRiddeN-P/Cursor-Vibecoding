import { createChild } from '../api/children.js';
import { friendlyAgeMessage } from '../utils/age.js';
import { showApiError } from '../utils/show-error.js';
import { createJalaliDatePicker } from '../components/jalali-date-picker.js';
import { formatJalali } from '../utils/jalali.js';
import { loadingHtml } from '../components/loading.js';
import { backButtonHtml, bindBackButton } from '../components/back-button.js';

const LOGO_HTML = `
  <div class="logo-mark">
    <div class="logo-mark__icon" aria-hidden="true">🌙</div>
    <span>لالایی</span>
  </div>
`;

export function renderAddChild(container, { onContinue, onBack }) {
  let savedChildren = [];
  let datePicker = null;

  container.innerHTML = `
    <div class="screen screen--with-chrome screen--framed">
      ${onBack ? backButtonHtml() : ''}
      ${LOGO_HTML}
      <div class="auth-card" id="add-child-root"></div>
    </div>
  `;

  if (onBack) {
    bindBackButton(container, onBack);
  }

  const root = container.querySelector('#add-child-root');

  function renderForm() {
    let birthDate = null;

    root.innerHTML = `
      <h2 class="auth-card__title">افزودن فرزند</h2>
      <p class="auth-card__subtitle">نام و تاریخ تولد فرزندتان را وارد کنید</p>
      <label class="field-label" for="child-name">نام فرزند</label>
      <input
        type="text"
        class="input-field input-field--rtl"
        id="child-name"
        placeholder="مثلاً آرش"
        autocomplete="name"
      />
      <label class="field-label">تاریخ تولد <span class="field-label__hint">(شمسی)</span></label>
      <div id="birth-picker-mount"></div>
      <button type="button" class="btn-primary" id="confirm-btn" disabled>تایید</button>
      ${savedChildren.length > 0 ? '<button type="button" class="btn-secondary" id="skip-continue-btn">ادامه</button>' : ''}
    `;

    const nameInput = root.querySelector('#child-name');
    const pickerMount = root.querySelector('#birth-picker-mount');
    const confirmBtn = root.querySelector('#confirm-btn');
    const skipBtn = root.querySelector('#skip-continue-btn');

    datePicker = createJalaliDatePicker({
      id: 'child-birth',
      placeholder: 'انتخاب تاریخ تولد',
      maxDate: new Date(),
      onChange: (iso) => {
        birthDate = iso;
        updateState();
      },
    });

    pickerMount.appendChild(datePicker.element);

    function updateState() {
      confirmBtn.disabled = !nameInput.value.trim() || !birthDate;
    }

    nameInput.addEventListener('input', updateState);

    confirmBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name || !birthDate) return;

      confirmBtn.disabled = true;
      root.insertAdjacentHTML('beforeend', loadingHtml('در حال ذخیره...'));

      try {
        const result = await createChild(name, birthDate);
        root.querySelector('.lalayi-loading')?.remove();
        savedChildren.push(result.child);
        renderSuccess(result.child);
      } catch (err) {
        root.querySelector('.lalayi-loading')?.remove();
        await showApiError(err);
        confirmBtn.disabled = false;
      }
    });

    skipBtn?.addEventListener('click', () => onContinue());

    nameInput.focus();
  }

  function renderSuccess(child) {
    root.innerHTML = `
      <div class="success-card">
        <p class="success-card__message">${friendlyAgeMessage(child.name, child.birth_date)}</p>
        <p class="success-card__birth">${formatJalali(child.birth_date, 'long')}</p>
        <button type="button" class="btn-primary" id="add-another-btn">افزودن فرزند دیگر</button>
        <button type="button" class="btn-secondary" id="continue-btn">ادامه</button>
      </div>
    `;

    root.querySelector('#add-another-btn').addEventListener('click', renderForm);
    root.querySelector('#continue-btn').addEventListener('click', () => onContinue());
  }

  renderForm();
}
