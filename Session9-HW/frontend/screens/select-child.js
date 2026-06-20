import { getChildren } from '../api/children.js';
import { setSelectedChild } from '../utils/child.js';
import { showApiError } from '../utils/show-error.js';
import { loadingHtml } from '../components/loading.js';
import { backButtonHtml, bindBackButton } from '../components/back-button.js';

const LOGO_HTML = `
  <div class="logo-mark">
    <div class="logo-mark__icon" aria-hidden="true">🌙</div>
    <span>لالایی</span>
  </div>
`;

function ageGroupLabel(ageGroup) {
  const labels = { '0-2': '۰–۲', '3-5': '۳–۵', '6-7': '۶–۷' };
  return labels[ageGroup] || ageGroup;
}

export function renderSelectChild(container, { onChildSelected, onBack, onAddChild }) {
  container.innerHTML = `
    <div class="screen screen--scroll screen--with-chrome screen--framed">
      ${backButtonHtml()}
      <div class="auth-card auth-card--wide">
        ${LOGO_HTML}
        <h2 class="auth-card__title">انتخاب فرزند</h2>
        <p class="auth-card__subtitle">امشب قصه برای کدوم بچه‌ست؟</p>
        <div id="children-list">${loadingHtml('در حال بارگذاری...')}</div>
        <button type="button" class="link-back" id="add-child-btn">افزودن فرزند جدید</button>
      </div>
    </div>
  `;

  bindBackButton(container, onBack);

  const listEl = container.querySelector('#children-list');

  container.querySelector('#add-child-btn').addEventListener('click', onAddChild);

  getChildren()
    .then(({ children }) => {
      if (!children.length) {
        listEl.innerHTML = `<p class="calm-hint">هنوز فرزندی ثبت نشده.</p>`;
        return;
      }

      const gridClass = children.length > 1 ? 'children-list children-list--grid' : 'children-list';

      listEl.innerHTML = `
        <div class="${gridClass}">
          ${children
            .map(
              (child) => `
            <button type="button" class="child-card" data-id="${child.id}">
              <span class="child-card__emoji">👶</span>
              <span class="child-card__body">
                <span class="child-card__name">${child.name}</span>
                <span class="child-card__age">${ageGroupLabel(child.age_group)} سال</span>
              </span>
            </button>
          `
            )
            .join('')}
        </div>
      `;

      listEl.querySelectorAll('.child-card').forEach((btn) => {
        btn.addEventListener('click', () => {
          const child = children.find((c) => String(c.id) === btn.dataset.id);
          if (!child) return;
          setSelectedChild(child);
          onChildSelected(child);
        });
      });
    })
    .catch((err) => {
      listEl.innerHTML = '';
      showApiError(err);
    });
}
