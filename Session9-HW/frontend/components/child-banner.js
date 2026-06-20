export function childBannerHtml(child, { showChange = true } = {}) {
  if (!child) return '';

  const changeBtn = showChange
    ? `<button type="button" class="child-banner__change" id="change-child-btn">✏️ تغییر</button>`
    : '';

  return `
    <div class="child-banner" id="child-banner">
      <span class="child-banner__label">امشب برای:</span>
      <span class="child-banner__name">${child.name}</span>
      ${changeBtn}
    </div>
  `;
}

export function bindChildBanner(container, onChange) {
  container.querySelector('#change-child-btn')?.addEventListener('click', onChange);
}
