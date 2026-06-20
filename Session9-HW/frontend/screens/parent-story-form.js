import { analyzeParentStory, submitParentStory } from '../api/stories.js';
import { getSelectedChild } from '../utils/child.js';
import { toPersianDigits } from '../utils/digits.js';
import { countWords } from '../utils/words.js';
import { ageGroupPillsHtml, bindAgeGroupPills, AGE_GROUP_LABELS } from '../utils/age-groups.js';
import { showApiError } from '../utils/show-error.js';
import { showErrorModal, showWarningModal } from '../components/modal.js';
import { loadingHtml } from '../components/loading.js';
import { backButtonHtml, bindBackButton } from '../components/back-button.js';

const MIN_WORDS = 50;
const MAX_TITLE = 100;
const TEXTAREA_MAX_HEIGHT = 240;

export function renderParentStoryForm(container, { onSuccess, onCancel }) {
  const child = getSelectedChild();
  const defaultAgeGroup = child?.age_group || '3-5';
  let submitting = false;
  let analyzing = false;

  container.innerHTML = `
    <div class="screen screen--scroll screen--with-chrome screen--framed">
      ${backButtonHtml('انصراف')}
      <div class="auth-card auth-card--wide">
        <h2 class="auth-card__title">✍️ قصه‌ات رو بنویس</h2>
        <p class="auth-card__subtitle">یک قصه دلخواه برای ${child?.name || 'فرزندت'}</p>

        <div id="form-body">
          <label class="field-label" for="story-title">عنوان قصه</label>
          <input
            type="text"
            class="input-field input-field--rtl"
            id="story-title"
            maxlength="${MAX_TITLE}"
            placeholder="مثلاً: خرگوشی که ستاره پیدا کرد"
          />
          <p class="story-form__counter" id="title-counter">۰ / ۱۰۰</p>

          <label class="field-label" for="story-content">متن قصه</label>
          <textarea
            class="story-textarea"
            id="story-content"
            placeholder="قصه‌ات رو اینجا بنویس... می‌تونه درباره هر چیزی باشه که دوست داری برای ${child?.name || 'فرزندت'} تعریف کنی 💛"
          ></textarea>
          <p class="story-form__counter" id="word-counter">${toPersianDigits(0)} کلمه</p>

          <details class="story-tips">
            <summary class="story-tips__toggle">💡 چند نکته برای نوشتن قصه خوب</summary>
            <ul class="story-tips__body">
              <li>جملات کوتاه بنویس — بچه‌ها جملات ساده رو بهتر می‌فهمن</li>
              <li>یه قهرمان کوچیک داشته باش — حیوون، بچه، یا حتی یه ستاره!</li>
              <li>پایان قصه شاد و آرام‌بخش باشه</li>
              <li>سعی کن بین ۱۰۰ تا ۲۰۰ کلمه باشه — نه خیلی کوتاه، نه خیلی بلند</li>
            </ul>
          </details>

          <section class="age-group-section" id="age-group-section" aria-labelledby="age-group-heading">
            <h3 class="age-group-section__title" id="age-group-heading">👶 این قصه برای چه سنی مناسبه؟</h3>
            <p class="age-group-section__hint">یکی از گزینه‌ها رو انتخاب کن — تو تصمیم نهایی رو می‌گیری</p>
            ${ageGroupPillsHtml({ selected: defaultAgeGroup })}
            <p class="age-group-section__selected" id="age-selected-label">
              انتخاب شده: ${AGE_GROUP_LABELS[defaultAgeGroup]}
            </p>
          </section>

          <div id="gemini-suggestion" hidden></div>

          <button type="button" class="btn-secondary" id="analyze-btn" disabled>دریافت پیشنهاد هوش مصنوعی ✨</button>
          <button type="button" class="btn-primary" id="save-btn" disabled>ذخیره قصه ✨</button>
          <button type="button" class="btn-secondary" id="cancel-btn">انصراف</button>
        </div>

        <div id="success-card" hidden></div>
      </div>
    </div>
  `;

  bindBackButton(container, onCancel);

  const titleInput = container.querySelector('#story-title');
  const contentInput = container.querySelector('#story-content');
  const titleCounter = container.querySelector('#title-counter');
  const wordCounter = container.querySelector('#word-counter');
  const saveBtn = container.querySelector('#save-btn');
  const analyzeBtn = container.querySelector('#analyze-btn');
  const cancelBtn = container.querySelector('#cancel-btn');
  const formBody = container.querySelector('#form-body');
  const successCard = container.querySelector('#success-card');
  const geminiSuggestionEl = container.querySelector('#gemini-suggestion');
  const ageGroupSection = container.querySelector('#age-group-section');
  const ageSelectedLabel = container.querySelector('#age-selected-label');

  const agePicker = bindAgeGroupPills(ageGroupSection, {
    initial: defaultAgeGroup,
    onChange: (group) => {
      ageSelectedLabel.textContent = `انتخاب شده: ${AGE_GROUP_LABELS[group]}`;
      ageGroupSection.classList.remove('age-group-section--highlight');
      geminiSuggestionEl.hidden = true;
      updateCounters();
    },
  });

  function resizeTextarea() {
    contentInput.style.height = 'auto';
    contentInput.style.height = `${Math.min(TEXTAREA_MAX_HEIGHT, Math.max(160, contentInput.scrollHeight))}px`;
  }

  function updateCounters() {
    const titleLen = titleInput.value.length;
    const words = countWords(contentInput.value);

    titleCounter.textContent = `${toPersianDigits(titleLen)} / ${toPersianDigits(MAX_TITLE)}`;
    wordCounter.textContent = `${toPersianDigits(words)} کلمه`;

    wordCounter.classList.toggle('story-form__counter--ok', words >= MIN_WORDS);
    wordCounter.classList.remove('story-form__counter--shake');

    const titleOk = titleInput.value.trim().length >= 3;
    const formReady = titleOk && words >= MIN_WORDS && !submitting;
    saveBtn.disabled = !formReady;
    analyzeBtn.disabled = !formReady || analyzing;
  }

  function focusAgeGroupSection() {
    ageGroupSection.classList.add('age-group-section--highlight');
    ageGroupSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function promptAgeGroupRequired() {
    focusAgeGroupSection();
    await showErrorModal('لطفاً گروه سنی مناسب قصه رو انتخاب کن', {
      title: 'گروه سنی رو انتخاب کن',
    });
  }

  function showGeminiSuggestion(group, { unavailable = false } = {}) {
    geminiSuggestionEl.hidden = false;

    if (unavailable) {
      geminiSuggestionEl.innerHTML = `
        <div class="gemini-suggestion">
          ⚠️ سرویس بررسی هوش مصنوعی الان در دسترس نیست. می‌تونی قصه رو ذخیره کنی اما تا تأیید، قابل استفاده نخواهد بود.
        </div>
      `;
      return;
    }

    geminiSuggestionEl.innerHTML = `
      <div class="gemini-suggestion">
        ✨ پیشنهاد هوش مصنوعی: <strong>${AGE_GROUP_LABELS[group]}</strong>
        — تو می‌تونی همین رو نگه داری یا گروه سنی دیگه‌ای انتخاب کنی.
      </div>
    `;
  }

  function showOverlay(message = 'داریم قصه‌ات رو جادویی می‌کنیم... ✨') {
    const overlay = document.createElement('div');
    overlay.className = 'story-form-overlay';
    overlay.id = 'submit-overlay';
    overlay.innerHTML = `
      ${loadingHtml(message)}
      <p class="story-form-overlay__sub">چند ثانیه صبر کن</p>
    `;
    document.body.appendChild(overlay);
  }

  function hideOverlay() {
    document.getElementById('submit-overlay')?.remove();
  }

  function showSuccess(story, pendingMessage) {
    formBody.hidden = true;
    successCard.hidden = false;

    const isPending = story.approval_status === 'pending';

    successCard.innerHTML = `
      <div class="story-success-card">
        <div class="story-success-card__emoji">${story.emoji || '📖'}</div>
        <p class="story-success-card__title">${story.title}</p>
        <p class="story-success-card__msg">${isPending ? 'قصه‌ات ذخیره شد! 🌙' : 'قصه‌ات ذخیره شد! 🎉'}</p>
        <p class="story-success-card__sub ${isPending ? 'story-success-card__sub--pending' : ''}">
          ${pendingMessage || (isPending ? 'وقتی سرویس بررسی در دسترس باشه، می‌تونی ازش استفاده کنی' : 'حالا می‌تونی برات پخش بشه')}
        </p>
      </div>
    `;

    setTimeout(() => onSuccess(story), isPending ? 2800 : 2000);
  }

  titleInput.addEventListener('input', updateCounters);

  contentInput.addEventListener('input', () => {
    resizeTextarea();
    updateCounters();
  });

  cancelBtn.addEventListener('click', onCancel);

  analyzeBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const words = countWords(content);

    if (title.length < 3 || words < MIN_WORDS) return;

    analyzing = true;
    analyzeBtn.disabled = true;
    showOverlay('داریم قصه‌ات رو بررسی می‌کنیم... 🔍');

    try {
      const result = await analyzeParentStory(title, content);
      hideOverlay();

      if (!result.gemini_available) {
        showGeminiSuggestion(null, { unavailable: true });
        await showWarningModal(
          result.message ||
            'سرویس بررسی هوش مصنوعی الان در دسترس نیست. می‌تونی قصه رو ذخیره کنی اما تا تأیید، قابل استفاده نخواهد بود.'
        );
        return;
      }

      const suggested = result.gemini_suggested_age_group;
      showGeminiSuggestion(suggested);
      agePicker.set(suggested);
      ageGroupSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      hideOverlay();

      if (err.data?.code === 'content_unsafe') {
        await showErrorModal(err.data.message || err.message);
        return;
      }

      await showApiError(err);
    } finally {
      analyzing = false;
      updateCounters();
    }
  });

  saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const words = countWords(content);
    const ageGroup = agePicker.get();

    if (title.length < 3) return;

    if (words < MIN_WORDS) {
      const needed = MIN_WORDS - words;
      await showErrorModal(`هنوز ${toPersianDigits(needed)} کلمه دیگه لازمه`);
      wordCounter.classList.add('story-form__counter--shake');
      return;
    }

    if (!ageGroup) {
      await promptAgeGroupRequired();
      return;
    }

    submitting = true;
    saveBtn.disabled = true;
    showOverlay();

    try {
      const result = await submitParentStory(title, content, child.id, ageGroup);
      hideOverlay();
      showSuccess(result.story, result.pending_message);
    } catch (err) {
      hideOverlay();
      submitting = false;
      updateCounters();

      if (err.data?.code === 'content_unsafe') {
        await showErrorModal(err.data.message || err.message);
        return;
      }

      if (err.data?.code === 'too_short') {
        const needed = MIN_WORDS - (err.data.words || words);
        await showErrorModal(`هنوز ${toPersianDigits(Math.max(needed, 1))} کلمه دیگه لازمه`);
        wordCounter.classList.add('story-form__counter--shake');
        return;
      }

      if (err.data?.code === 'invalid_age_group') {
        await promptAgeGroupRequired();
        return;
      }

      await showApiError(err);
    }
  });

  updateCounters();
  resizeTextarea();
  titleInput.focus();
}
