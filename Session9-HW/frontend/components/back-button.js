export function backButtonHtml(label = 'بازگشت') {
  return `<button type="button" class="screen-back" aria-label="${label}">→ ${label}</button>`;
}

export function bindBackButton(container, onBack) {
  container.querySelector('.screen-back')?.addEventListener('click', onBack);
}
