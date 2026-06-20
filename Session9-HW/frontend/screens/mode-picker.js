import { getSelectedChild } from '../utils/child.js';
import { backButtonHtml, bindBackButton } from '../components/back-button.js';
import { childBannerHtml, bindChildBanner } from '../components/child-banner.js';
import { bottomTabsHtml, bindBottomTabs } from '../components/bottom-tabs.js';

const LOGO_HTML = `
  <div class="logo-mark">
    <div class="logo-mark__icon" aria-hidden="true">🌙</div>
    <span>لالایی</span>
  </div>
`;

export function renderModePicker(container, { onCalm, onInteractive, onChangeChild, onBack, onSettings, onHome }) {
  const child = getSelectedChild();

  container.innerHTML = `
    <div class="screen screen--scroll screen--with-chrome screen--with-tabs screen--framed">
      ${backButtonHtml()}
      <div class="auth-card auth-card--wide">
        ${LOGO_HTML}
        ${child ? childBannerHtml(child) : ''}
        <h2 class="auth-card__title">سلام ${child?.name || 'عزیزم'}! 👋</h2>
        <p class="auth-card__subtitle">چه نوع قصه‌ای می‌خواهی؟</p>
        <div class="mode-cards mode-cards--grid">
          <button type="button" class="mode-card" id="calm-mode">
            <span class="mode-card__emoji">🌙</span>
            <span class="mode-card__title">قصه آروم</span>
            <span class="mode-card__desc">گوش دادن به قصه‌های خواب‌آور</span>
          </button>
          <button type="button" class="mode-card" id="interactive-mode">
            <span class="mode-card__emoji">💬</span>
            <span class="mode-card__title">قصه تعاملی</span>
            <span class="mode-card__desc">بپرس و با قصه‌گو حرف بزن</span>
          </button>
        </div>
      </div>
      ${bottomTabsHtml('home')}
    </div>
  `;

  bindBackButton(container, onBack);
  bindChildBanner(container, onChangeChild);
  bindBottomTabs(container, { onHome, onSettings });

  container.querySelector('#calm-mode').addEventListener('click', onCalm);
  container.querySelector('#interactive-mode').addEventListener('click', onInteractive);
}
