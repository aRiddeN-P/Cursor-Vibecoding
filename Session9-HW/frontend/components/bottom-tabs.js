export function bottomTabsHtml(active = 'home') {
  return `
    <nav class="bottom-tabs" aria-label="ناوبری اصلی">
      <button type="button" class="bottom-tab ${active === 'home' ? 'bottom-tab--active' : ''}" data-tab="home">
        <span class="bottom-tab__icon" aria-hidden="true">🌙</span>
        <span class="bottom-tab__label">خانه</span>
      </button>
      <button type="button" class="bottom-tab ${active === 'settings' ? 'bottom-tab--active' : ''}" data-tab="settings">
        <span class="bottom-tab__icon" aria-hidden="true">⚙️</span>
        <span class="bottom-tab__label">تنظیمات</span>
      </button>
    </nav>
  `;
}

export function bindBottomTabs(container, { onHome, onSettings }) {
  container.querySelector('[data-tab="home"]')?.addEventListener('click', onHome);
  container.querySelector('[data-tab="settings"]')?.addEventListener('click', onSettings);
}
