export function loadingHtml(message = 'در حال بارگذاری...') {
  return `
    <div class="lalayi-loading" role="status" aria-live="polite">
      <div class="lalayi-loading__scene" aria-hidden="true">
        <span class="lalayi-loading__star lalayi-loading__star--1">✦</span>
        <span class="lalayi-loading__star lalayi-loading__star--2">✦</span>
        <span class="lalayi-loading__star lalayi-loading__star--3">✦</span>
        <span class="lalayi-loading__moon">🌙</span>
      </div>
      <p class="lalayi-loading__text">${message}</p>
    </div>
  `;
}

export function mountLoading(container, message) {
  const el = document.createElement('div');
  el.className = 'lalayi-loading-mount';
  el.innerHTML = loadingHtml(message);
  container.appendChild(el);
  return () => el.remove();
}
