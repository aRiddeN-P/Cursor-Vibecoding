import { showConfirmModal } from '../components/modal.js';
import { clearToken } from '../utils/auth.js';
import { clearSelectedChild } from '../utils/child.js';

export function logoutButtonHtml() {
  return `<button type="button" class="screen-logout" aria-label="خروج">🚪 خروج</button>`;
}

export function bindLogoutButton(container, onLogout) {
  container.querySelector('.screen-logout')?.addEventListener('click', async () => {
    const confirmed = await showConfirmModal('برای خروج از حسابت مطمئنی؟', {
      confirmText: 'آره، خارج می‌شم',
      cancelText: 'نه، بمونم',
    });
    if (!confirmed) return;
    clearToken();
    clearSelectedChild();
    onLogout();
  });
}
