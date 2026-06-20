import { serviceUsageHtml, mountServiceUsage } from '../components/service-usage.js';
import { bottomTabsHtml, bindBottomTabs } from '../components/bottom-tabs.js';
import { mountVoiceSettings } from './voice-settings.js';
import { showConfirmModal } from '../components/modal.js';
import { clearToken } from '../utils/auth.js';
import { clearSelectedChild } from '../utils/child.js';

const LOGO_HTML = `
  <div class="logo-mark">
    <div class="logo-mark__icon" aria-hidden="true">🌙</div>
    <span>لالایی</span>
  </div>
`;

export function renderSettings(container, { onHome, onAddChild, onLogout }) {
  let cleanupVoice = null;

  container.innerHTML = `
    <div class="screen screen--scroll screen--with-tabs screen--framed">
      <div class="auth-card auth-card--wide">
        ${LOGO_HTML}
        <h2 class="auth-card__title">⚙️ تنظیمات</h2>
        <p class="auth-card__subtitle">مدیریت حساب، صدا و سرویس‌ها</p>

        <section class="settings-section">
          <h3 class="settings-section__title">وضعیت سرویس‌ها</h3>
          ${serviceUsageHtml()}
        </section>

        <section class="settings-section">
          <h3 class="settings-section__title">تنظیمات صدا 🎙</h3>
          <p class="settings-section__hint">صدای خودتان را ضبط کنید تا قصه‌ها با همان لحن خوانده شوند</p>
          <div id="voice-settings-mount"></div>
        </section>

        <section class="settings-section settings-section--actions">
          <button type="button" class="btn-secondary" id="add-child-btn">👶 افزودن فرزند جدید</button>
          <button type="button" class="btn-secondary settings-logout-btn" id="logout-btn">🚪 خروج از حساب</button>
        </section>
      </div>
      ${bottomTabsHtml('settings')}
    </div>
  `;

  bindBottomTabs(container, { onHome, onSettings: () => {} });
  mountServiceUsage(container, { showTitle: false });

  cleanupVoice = mountVoiceSettings(container.querySelector('#voice-settings-mount'));

  container.querySelector('#add-child-btn').addEventListener('click', onAddChild);

  container.querySelector('#logout-btn').addEventListener('click', async () => {
    const confirmed = await showConfirmModal('برای خروج از حسابت مطمئنی؟', {
      confirmText: 'آره، خارج می‌شم',
      cancelText: 'نه، بمونم',
    });
    if (!confirmed) return;
    cleanupVoice?.();
    clearToken();
    clearSelectedChild();
    onLogout();
  });

  return () => cleanupVoice?.();
}
