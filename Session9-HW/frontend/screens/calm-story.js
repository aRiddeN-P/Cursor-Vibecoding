import { getRemainingToday, getStories, getParentStories } from '../api/stories.js';
import { getSelectedChild } from '../utils/child.js';
import { toPersianDigits } from '../utils/digits.js';
import { AGE_GROUP_LABELS } from '../utils/age-groups.js';
import { showApiError } from '../utils/show-error.js';
import { showWarningModal } from '../components/modal.js';
import { loadingHtml } from '../components/loading.js';
import { backButtonHtml, bindBackButton } from '../components/back-button.js';
import { bottomTabsHtml, bindBottomTabs } from '../components/bottom-tabs.js';

const LOGO_HTML = `
  <div class="logo-mark">
    <div class="logo-mark__icon" aria-hidden="true">🌙</div>
    <span>لالایی</span>
  </div>
`;

const PENDING_MESSAGE =
  'این قصه هنوز تأیید نشده و نمی‌تونی ازش استفاده کنی. وقتی سرویس بررسی در دسترس باشه، دوباره امتحان کن 🌙';

export function renderCalmStory(container, { onSelectStory, onWriteStory, onBack, onSettings, onHome, initialTab = 'library' }) {
  const child = getSelectedChild();
  let activeTab = initialTab;
  let remainingToday = null;

  container.innerHTML = `
    <div class="screen screen--scroll screen--with-chrome screen--with-tabs screen--framed">
      ${backButtonHtml()}
      <div class="auth-card auth-card--wide">
        ${LOGO_HTML}
        <h2 class="auth-card__title">🌙 قصه آروم</h2>
        <p class="auth-card__subtitle">یک قصه برای ${child?.name || 'فرزندت'} انتخاب کن</p>
        <p class="remaining-badge" id="remaining-badge" hidden></p>
        <div class="story-tab-bar" id="story-tabs">
          <button type="button" class="story-tab story-tab--active" data-tab="library">کتابخونه</button>
          <button type="button" class="story-tab" data-tab="mine">قصه‌های من</button>
          <button type="button" class="story-tab" data-tab="add">+ اضافه کردن</button>
        </div>
        <div id="stories-list" class="story-grid story-grid--tablet">${loadingHtml('در حال بارگذاری قصه‌ها...')}</div>
      </div>
      ${bottomTabsHtml('home')}
    </div>
  `;

  bindBackButton(container, onBack);
  bindBottomTabs(container, { onHome, onSettings });

  const storiesEl = container.querySelector('#stories-list');
  const tabsEl = container.querySelector('#story-tabs');
  const remainingBadge = container.querySelector('#remaining-badge');

  function setActiveTab(tab) {
    activeTab = tab;
    tabsEl.querySelectorAll('.story-tab').forEach((btn) => {
      btn.classList.toggle('story-tab--active', btn.dataset.tab === tab);
    });
  }

  function updateRemainingBadge() {
    if (remainingToday === null) {
      remainingBadge.hidden = true;
      return;
    }
    if (remainingToday === 0) {
      remainingBadge.textContent = 'امروز سهمیه قصه تازه تمام شده 🌙';
      remainingBadge.classList.add('remaining-badge--empty');
    } else {
      remainingBadge.textContent = `${toPersianDigits(remainingToday)} قصه تازه دیگه برای امروز داری`;
      remainingBadge.classList.remove('remaining-badge--empty');
    }
    remainingBadge.hidden = false;
  }

  function renderStories(stories, { emptyMessage } = {}) {
    if (!stories.length) {
      storiesEl.innerHTML = `<p class="story-empty">${emptyMessage || 'قصه‌ای یافت نشد'}</p>`;
      return;
    }

    storiesEl.innerHTML = stories
      .map((s) => {
        const isPending = s.approval_status === 'pending';
        return `
      <button type="button" class="story-card ${isPending ? 'story-card--pending' : ''}" data-id="${s.id}" data-pending="${isPending}">
        <span class="story-card__emoji">${s.emoji || '📖'}</span>
        <span class="story-card__body">
          <span class="story-card__title">${s.title}</span>
          <span class="story-card__theme">${s.theme || ''}${s.age_group ? ` · ${AGE_GROUP_LABELS[s.age_group] || s.age_group}` : ''}</span>
          ${isPending ? '<span class="story-card__badge">⏳ در انتظار تأیید</span>' : ''}
        </span>
      </button>
    `;
      })
      .join('');

    storiesEl.querySelectorAll('.story-card').forEach((card) => {
      card.addEventListener('click', async () => {
        if (card.dataset.pending === 'true') {
          await showWarningModal(PENDING_MESSAGE, { title: 'قصه هنوز آماده نیست' });
          return;
        }
        onSelectStory(Number(card.dataset.id));
      });
    });
  }

  async function loadTab(tab) {
    setActiveTab(tab);
    storiesEl.innerHTML = loadingHtml('در حال بارگذاری قصه‌ها...');

    try {
      if (tab === 'library') {
        const { stories } = await getStories(child.age_group);
        renderStories(stories);
      } else if (tab === 'mine') {
        const { stories } = await getParentStories();
        renderStories(stories, {
          emptyMessage: 'هنوز قصه‌ای اضافه نکردی ✍️ — اولین قصه‌ات رو بنویس!',
        });
      }
    } catch (err) {
      storiesEl.innerHTML = '';
      await showApiError(err);
    }
  }

  tabsEl.querySelectorAll('.story-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'add') {
        onWriteStory();
        return;
      }
      loadTab(tab);
    });
  });

  getRemainingToday(child.id)
    .then((remainingRes) => {
      remainingToday = remainingRes.remaining_today;
      updateRemainingBadge();
    })
    .catch(() => {});

  setActiveTab(activeTab);
  if (activeTab === 'add') {
    onWriteStory();
  } else {
    loadTab(activeTab);
  }
}
