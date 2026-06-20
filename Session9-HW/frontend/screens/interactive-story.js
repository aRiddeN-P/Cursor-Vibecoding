import { WS_BASE } from '../api/config.js';
import { getRemainingToday, getStories, getParentStories } from '../api/stories.js';
import { getServiceUsage } from '../api/usage.js';
import { getSelectedChild } from '../utils/child.js';
import { toPersianDigits } from '../utils/digits.js';
import { getToken } from '../utils/auth.js';
import { createMicStreamer, createPcmPlayer } from '../utils/pcmAudio.js';
import {
  friendlyApiError,
  interactiveErrorTitle,
  GEMINI_SERVICE_UNAVAILABLE_MESSAGE,
} from '../utils/errors.js';
import { showApiError } from '../utils/show-error.js';
import { showErrorModal, showWarningModal, showMicPermissionModal } from '../components/modal.js';
import { loadingHtml } from '../components/loading.js';
import { backButtonHtml, bindBackButton } from '../components/back-button.js';
import { bottomTabsHtml, bindBottomTabs } from '../components/bottom-tabs.js';

const LOGO_HTML = `
  <div class="logo-mark">
    <div class="logo-mark__icon" aria-hidden="true">🌙</div>
    <span>لالایی</span>
  </div>
`;

export function renderInteractiveStory(container, { onBack, onSettings, onHome }) {
  const child = getSelectedChild();
  let remainingToday = null;
  let active = false;
  let ws = null;
  let mic = null;
  let player = null;
  let sourceMode = 'custom';
  let selectedStoryId = null;
  let libraryStories = [];
  let parentStories = [];
  let intentionalEnd = false;

  container.innerHTML = `
    <div class="screen screen--scroll interactive-screen screen--with-chrome screen--with-tabs screen--framed">
      ${backButtonHtml()}
      <div class="auth-card auth-card--wide">
        ${LOGO_HTML}
        <h2 class="auth-card__title">💬 قصه تعاملی</h2>
        <p class="auth-card__subtitle">بپرس و با قصه‌گو حرف بزن</p>
        <p class="remaining-badge" id="remaining-badge" hidden></p>
        <div id="setup-panel">
          <p class="interactive-note">این حالت با صدای هوش مصنوعی صحبت می‌کند 🤖✨</p>
          <div class="mode-tabs" id="source-tabs">
            <button type="button" class="mode-tab mode-tab--active" data-mode="custom">موضوع دلخواه</button>
            <button type="button" class="mode-tab" data-mode="library">از کتابخونه</button>
          </div>
          <div id="custom-panel">
            <label class="field-label" for="topic-input">موضوع قصه</label>
            <input
              type="text"
              class="input-field input-field--rtl"
              id="topic-input"
              placeholder="مثلاً خرگوش کوچولوی شجاع"
            />
            <div class="topic-picks" id="topic-picks">${loadingHtml('در حال بارگذاری...')}</div>
          </div>
          <div id="library-panel" hidden>
            <div class="interactive-library" id="library-list">${loadingHtml('در حال بارگذاری قصه‌ها...')}</div>
            <p class="interactive-section-label">قصه‌های من</p>
            <div class="interactive-library" id="parent-list"></div>
          </div>
          <button type="button" class="btn-primary" id="start-btn">شروع قصه تعاملی</button>
        </div>
        <div class="interactive-live" id="live-panel" hidden>
          <div class="interactive-live__orb interactive-live__orb--pulse" id="state-orb" aria-hidden="true">🌙</div>
          <p class="interactive-live__state" id="state-label">در حال گفتن قصه...</p>
          <p class="interactive-live__topic" id="active-topic"></p>
          <button type="button" class="btn-secondary" id="end-btn">پایان قصه</button>
        </div>
      </div>
      ${bottomTabsHtml('home')}
    </div>
  `;

  bindBackButton(container, () => {
    cleanupSession();
    onBack();
  });
  bindBottomTabs(container, { onHome, onSettings });

  const setupPanel = container.querySelector('#setup-panel');
  const livePanel = container.querySelector('#live-panel');
  const customPanel = container.querySelector('#custom-panel');
  const libraryPanel = container.querySelector('#library-panel');
  const libraryList = container.querySelector('#library-list');
  const parentList = container.querySelector('#parent-list');
  const remainingBadge = container.querySelector('#remaining-badge');
  const topicInput = container.querySelector('#topic-input');
  const topicPicks = container.querySelector('#topic-picks');
  const startBtn = container.querySelector('#start-btn');
  const endBtn = container.querySelector('#end-btn');
  const stateOrb = container.querySelector('#state-orb');
  const stateLabel = container.querySelector('#state-label');
  const activeTopicEl = container.querySelector('#active-topic');

  async function setError(message, { title, code } = {}) {
    if (!message) return;
    await showErrorModal(message, { title: title || interactiveErrorTitle(code) });
  }

  async function checkGeminiServiceAvailable() {
    try {
      const data = await getServiceUsage();
      const gemini = data?.gemini;

      if (!gemini?.configured) {
        return {
          ok: false,
          code: 'api_key',
          message: friendlyApiError({ code: 'api_key' }),
        };
      }

      if (gemini.remaining?.requests_per_day <= 0) {
        return {
          ok: false,
          code: 'gemini_daily_limit',
          message: friendlyApiError({ code: 'gemini_daily_limit' }),
        };
      }

      if (
        gemini.remaining?.requests_per_minute <= 0 ||
        gemini.remaining?.tokens_per_minute <= 0
      ) {
        return {
          ok: false,
          code: 'gemini_rate_limit',
          message: friendlyApiError({ code: 'gemini_rate_limit' }),
        };
      }

      return { ok: true };
    } catch {
      return { ok: true };
    }
  }

  function updateRemainingBadge() {
    if (remainingToday === null) {
      remainingBadge.hidden = true;
      return;
    }

    if (remainingToday === 0) {
      remainingBadge.textContent = 'امروز سهمیه قصه تازه تمام شده 🌙';
      remainingBadge.classList.add('remaining-badge--empty');
      startBtn.disabled = true;
    } else {
      remainingBadge.textContent = `${toPersianDigits(remainingToday)} قصه تازه دیگه برای امروز داری`;
      remainingBadge.classList.remove('remaining-badge--empty');
      startBtn.disabled = false;
    }

    remainingBadge.hidden = false;
  }

  function setSessionState(state) {
    const speaking = state === 'speaking';
    stateOrb.textContent = speaking ? '🌙' : '👂';
    stateOrb.classList.toggle('interactive-live__orb--speaking', speaking);
    stateOrb.classList.toggle('interactive-live__orb--listening', !speaking);
    stateLabel.textContent = speaking ? 'در حال گفتن قصه...' : 'در حال گوش دادن...';
  }

  function buildWsUrl({ topic, storyId }) {
    const token = getToken();
    const params = new URLSearchParams({
      token,
      child_id: String(child.id),
      age_group: child.age_group,
    });

    if (storyId) {
      params.set('story_id', String(storyId));
    } else {
      params.set('topic', topic);
    }

    return `${WS_BASE}/ws/interactive-story?${params.toString()}`;
  }

  function cleanupSession() {
    ws?.close();
    ws = null;
    mic?.stop();
    mic = null;
    player?.stop();
    player = null;
    active = false;
  }

  function renderStoryItems(stories, containerEl, { emptyMessage = 'قصه‌ای نیست' } = {}) {
    if (!stories.length) {
      containerEl.innerHTML = `<p class="story-empty">${emptyMessage}</p>`;
      return;
    }

    containerEl.innerHTML = stories
      .map(
        (story) => {
          const isPending = story.approval_status === 'pending';
          return `
        <button type="button" class="interactive-library__item ${selectedStoryId === story.id ? 'interactive-library__item--selected' : ''} ${isPending ? 'interactive-library__item--pending' : ''}" data-id="${story.id}" data-pending="${isPending}">
          <span class="interactive-library__emoji">${story.emoji || '📖'}</span>
          <span class="interactive-library__title">${story.title}</span>
          ${isPending ? '<span class="interactive-library__badge">⏳ در انتظار تأیید</span>' : ''}
        </button>
      `;
        }
      )
      .join('');

    containerEl.querySelectorAll('.interactive-library__item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.pending === 'true') {
          await showWarningModal(
            'این قصه هنوز تأیید نشده و نمی‌تونی ازش استفاده کنی. وقتی سرویس بررسی در دسترس باشه، دوباره امتحان کن 🌙',
            { title: 'قصه هنوز آماده نیست' }
          );
          return;
        }
        selectedStoryId = Number(btn.dataset.id);
        renderLibraryList();
      });
    });
  }

  function renderLibraryList() {
    renderStoryItems(libraryStories, libraryList);
    renderStoryItems(parentStories, parentList, {
      emptyMessage: 'هنوز قصه‌ای ننوشتی ✍️',
    });
  }

  function findSelectedStory() {
    return [...libraryStories, ...parentStories].find((s) => s.id === selectedStoryId);
  }

  function renderTopicPicks(stories) {
    const picks = [...new Set(stories.map((s) => s.theme).filter(Boolean))].slice(0, 6);

    topicPicks.innerHTML = picks
      .map(
        (theme) => `
        <button type="button" class="topic-pick" data-topic="${theme}">${theme}</button>
      `
      )
      .join('');

    topicPicks.querySelectorAll('.topic-pick').forEach((btn) => {
      btn.addEventListener('click', () => {
        topicInput.value = btn.dataset.topic;
      });
    });
  }

  container.querySelectorAll('.mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      sourceMode = tab.dataset.mode;
      container.querySelectorAll('.mode-tab').forEach((t) => {
        t.classList.toggle('mode-tab--active', t.dataset.mode === sourceMode);
      });
      customPanel.hidden = sourceMode !== 'custom';
      libraryPanel.hidden = sourceMode !== 'library';
    });
  });

  async function startSession() {
    const topic = topicInput.value.trim();
    if (sourceMode === 'custom' && !topic) {
      await setError('موضوع قصه را وارد کن', { title: 'یه چیزی کم شده' });
      return;
    }
    if (sourceMode === 'library' && !selectedStoryId) {
      await setError('یک قصه از کتابخونه انتخاب کن', { title: 'یه چیزی کم شده' });
      return;
    }

    const selectedStory = findSelectedStory();
    if (sourceMode === 'library' && selectedStory?.approval_status === 'pending') {
      await showWarningModal(
        'این قصه هنوز تأیید نشده و نمی‌تونی ازش استفاده کنی. وقتی سرویس بررسی در دسترس باشه، دوباره امتحان کن 🌙',
        { title: 'قصه هنوز آماده نیست' }
      );
      return;
    }

    const serviceCheck = await checkGeminiServiceAvailable();
    if (!serviceCheck.ok) {
      await setError(serviceCheck.message, { code: serviceCheck.code });
      return;
    }

    const micApproved = await showMicPermissionModal();
    if (!micApproved) return;

    startBtn.disabled = true;
    let startupErrorHandled = false;
    let connectTimeout = null;

    const loadingEl = document.createElement('div');
    loadingEl.innerHTML = loadingHtml('در حال آماده‌سازی...');
    setupPanel.appendChild(loadingEl);

    const removeLoading = () => loadingEl.remove();

    const resetToSetup = () => {
      clearTimeout(connectTimeout);
      removeLoading();
      cleanupSession();
      setupPanel.hidden = false;
      livePanel.hidden = true;
      startBtn.disabled = remainingToday === 0;
    };

    const failStartup = async (err) => {
      if (startupErrorHandled) return;
      startupErrorHandled = true;
      resetToSetup();
      const code = err?.code;
      await setError(friendlyApiError(err), { code });
    };

    const wsUrl =
      sourceMode === 'library'
        ? buildWsUrl({ storyId: selectedStoryId })
        : buildWsUrl({ topic });

    try {
      mic = await createMicStreamer((base64Chunk) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'audio', data: base64Chunk }));
        }
      });
      await mic.resume();
    } catch (err) {
      startBtn.disabled = remainingToday === 0;
      mic?.stop();
      mic = null;

      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        await showErrorModal(
          'بدون دسترسی میکروفون نمی‌شه قصه تعاملی داشت. از تنظیمات مرورگر اجازه بده و دوباره امتحان کن.',
          { title: 'دسترسی میکروفون داده نشد' }
        );
      } else {
        await setError(friendlyApiError(err));
      }
      return;
    }

    try {
      ws = new WebSocket(wsUrl);

      connectTimeout = setTimeout(() => {
        if (!active && !startupErrorHandled) {
          ws?.close();
          failStartup({
            code: 'service_unavailable',
            message: GEMINI_SERVICE_UNAVAILABLE_MESSAGE,
          });
        }
      }, 20000);

      ws.addEventListener('message', async (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === 'ready') {
          clearTimeout(connectTimeout);
          removeLoading();
          remainingToday = msg.remaining_today;
          updateRemainingBadge();

          player = createPcmPlayer(24000);
          await player.resume();

          active = true;
          setupPanel.hidden = true;
          livePanel.hidden = false;
          activeTopicEl.textContent =
            sourceMode === 'library'
              ? `قصه: ${selectedStory?.title || ''}`
              : `موضوع: ${topic}`;
          setSessionState('speaking');

          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'start' }));
          }
          return;
        }

        if (msg.type === 'remaining') {
          remainingToday = msg.remaining_today;
          updateRemainingBadge();
          return;
        }

        if (msg.type === 'audio' && msg.data) {
          player?.playBase64Pcm(msg.data);
          return;
        }

        if (msg.type === 'state') {
          setSessionState(msg.state);
          return;
        }

        if (msg.type === 'error') {
          clearTimeout(connectTimeout);
          if (msg.code === 'daily_limit') {
            remainingToday = 0;
            updateRemainingBadge();
          }

          if (active) {
            startupErrorHandled = true;
            await setError(
              friendlyApiError({
                message: msg.message,
                code: msg.code,
                status: msg.code === 'daily_limit' ? 429 : undefined,
              }),
              { code: msg.code }
            );
            endSession();
          } else {
            await failStartup({
              message: msg.message,
              code: msg.code,
              status: msg.code === 'daily_limit' ? 429 : undefined,
            });
          }
          return;
        }

        if (msg.type === 'close') {
          clearTimeout(connectTimeout);
          if (active) {
            startupErrorHandled = true;
            await setError('ارتباط با قصه‌گو قطع شد — می‌تونی دوباره شروع کنی.', {
              title: 'قصه تمام شد',
            });
            endSession();
          } else {
            await failStartup({
              code: 'service_unavailable',
              message: GEMINI_SERVICE_UNAVAILABLE_MESSAGE,
            });
          }
        }
      });

      ws.addEventListener('close', () => {
        if (intentionalEnd || startupErrorHandled) return;
        if (active) {
          setError('ارتباط با قصه‌گو قطع شد — می‌تونی دوباره شروع کنی.', {
            title: 'قصه تمام شد',
          }).then(() => endSession());
          return;
        }
        failStartup({
          code: 'service_unavailable',
          message: GEMINI_SERVICE_UNAVAILABLE_MESSAGE,
        });
      });

      ws.addEventListener('error', () => {
        failStartup({
          code: 'service_unavailable',
          message: GEMINI_SERVICE_UNAVAILABLE_MESSAGE,
        });
      });
    } catch (err) {
      await failStartup(err);
    }
  }

  function endSession() {
    intentionalEnd = true;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'end' }));
    }

    cleanupSession();
    setupPanel.hidden = false;
    livePanel.hidden = true;
    startBtn.disabled = remainingToday === 0;
    intentionalEnd = false;
  }

  startBtn.addEventListener('click', startSession);
  endBtn.addEventListener('click', endSession);

  Promise.all([getStories(child.age_group), getParentStories(), getRemainingToday(child.id)])
    .then(([storiesRes, parentRes, remainingRes]) => {
      libraryStories = storiesRes.stories || [];
      parentStories = parentRes.stories || [];
      remainingToday = remainingRes.remaining_today;
      updateRemainingBadge();
      renderTopicPicks(libraryStories);
      renderLibraryList();
    })
    .catch((err) => {
      showApiError(err);
    });
}
