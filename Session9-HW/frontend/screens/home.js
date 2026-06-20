import { getChildren } from '../api/children.js';
import { getSelectedChild, setSelectedChild } from '../utils/child.js';
import { showApiError } from '../utils/show-error.js';
import { loadingHtml } from '../components/loading.js';
import { childBannerHtml, bindChildBanner } from '../components/child-banner.js';
import { bottomTabsHtml, bindBottomTabs } from '../components/bottom-tabs.js';

const LOGO_HTML = `
  <div class="logo-mark">
    <div class="logo-mark__icon" aria-hidden="true">🌙</div>
    <span>لالایی</span>
  </div>
`;

export function renderHome(container, { onSelectMode, onChangeChild, onAddChild, onSettings, onHome }) {
  let child = getSelectedChild();

  container.innerHTML = `
    <div class="screen screen--scroll screen--with-tabs screen--framed">
      <div class="auth-card auth-card--wide">
        ${LOGO_HTML}
        ${child ? childBannerHtml(child) : ''}
        <h2 class="auth-card__title">سلام! امشب برای کدوم بچه قصه می‌خوای؟</h2>
        <p class="auth-card__subtitle">آماده‌ای برای یک قصه خواب‌آور؟</p>
        <div id="home-body">
          ${child ? '' : loadingHtml('در حال آماده‌سازی...')}
        </div>
      </div>
      ${bottomTabsHtml('home')}
    </div>
  `;

  bindBottomTabs(container, { onHome, onSettings });
  bindChildBanner(container, onChangeChild);

  const homeBody = container.querySelector('#home-body');

  function showReadyState() {
    child = getSelectedChild();
    const banner = container.querySelector('#child-banner');
    if (banner && child) {
      banner.querySelector('.child-banner__name').textContent = child.name;
    } else if (child) {
      container.querySelector('.auth-card')?.insertAdjacentHTML(
        'afterbegin',
        childBannerHtml(child)
      );
      bindChildBanner(container, onChangeChild);
    }

    homeBody.innerHTML = `
      <button type="button" class="btn-primary" id="go-mode-btn">انتخاب نوع قصه 🌙</button>
    `;
    homeBody.querySelector('#go-mode-btn').addEventListener('click', onSelectMode);
  }

  if (child) {
    showReadyState();
    return;
  }

  getChildren()
    .then(({ children }) => {
      if (children.length === 1) {
        setSelectedChild(children[0]);
        showReadyState();
        return;
      }

      if (!children.length) {
        homeBody.innerHTML = `
          <p class="calm-hint">هنوز فرزندی ثبت نشده.</p>
          <button type="button" class="btn-primary" id="add-child-btn">افزودن فرزند</button>
        `;
        homeBody.querySelector('#add-child-btn').addEventListener('click', onAddChild);
        return;
      }

      onChangeChild();
    })
    .catch((err) => {
      homeBody.innerHTML = '';
      showApiError(err);
    });
}
