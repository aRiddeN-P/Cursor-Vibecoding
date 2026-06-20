import { createVoiceProfile, deleteVoiceProfile, getVoiceProfiles } from '../api/voice.js';
import { showApiError } from '../utils/show-error.js';
import { showErrorModal } from '../components/modal.js';
import { loadingHtml } from '../components/loading.js';

const SUGGESTED_NAMES = ['مامان', 'بابا'];
const MIN_RECORD_SEC = 30;
const MAX_RECORD_SEC = 300;

function toPersianDigits(value) {
  return String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

function formatTimer(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return toPersianDigits(`${m}:${String(s).padStart(2, '0')}`);
}

function getRecorderMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function mountVoiceSettings(mountEl) {
  let profiles = [];
  let recorder = null;
  let recordStream = null;
  let recordChunks = [];
  let recordTimer = null;
  let recordSeconds = 0;
  let previewBlob = null;
  let previewUrl = null;
  let previewAudio = null;

  mountEl.innerHTML = `
    <div id="voice-list">${loadingHtml('در حال بارگذاری صداها...')}</div>
    <div id="recorder-panel" hidden></div>
  `;

  const voiceListEl = mountEl.querySelector('#voice-list');
  const recorderPanelEl = mountEl.querySelector('#recorder-panel');

  async function setError(message) {
    if (!message) return;
    await showErrorModal(message);
  }

  function cleanupRecording() {
    if (recordTimer) {
      clearInterval(recordTimer);
      recordTimer = null;
    }

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }

    recordStream?.getTracks().forEach((track) => track.stop());
    recordStream = null;
    recorder = null;
    recordChunks = [];
    recordSeconds = 0;
  }

  function cleanupPreview() {
    previewAudio?.pause();
    previewAudio = null;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }

    previewBlob = null;
  }

  function renderVoiceList() {
    const slots = SUGGESTED_NAMES.map((name) => {
      const profile = profiles.find((p) => p.name === name);
      return { name, profile };
    });

    const extraProfiles = profiles.filter((p) => !SUGGESTED_NAMES.includes(p.name));

    voiceListEl.innerHTML = `
      <ul class="voice-list">
        ${slots
          .map(
            ({ name, profile }) => `
          <li class="voice-list__item">
            <span class="voice-list__name">
              ${profile ? `${name} ✅` : `${name} - ضبط نشده`}
            </span>
            ${
              profile
                ? `<button type="button" class="voice-list__delete" data-id="${profile.id}" aria-label="حذف ${name}">🗑</button>`
                : ''
            }
          </li>
        `
          )
          .join('')}
        ${extraProfiles
          .map(
            (profile) => `
          <li class="voice-list__item">
            <span class="voice-list__name">${profile.name} ✅</span>
            <button type="button" class="voice-list__delete" data-id="${profile.id}" aria-label="حذف ${profile.name}">🗑</button>
          </li>
        `
          )
          .join('')}
      </ul>
      <button type="button" class="btn-primary voice-record-btn" id="new-voice-btn">🎙 ضبط صدای جدید</button>
    `;

    voiceListEl.querySelector('#new-voice-btn').addEventListener('click', () => {
      voiceListEl.hidden = true;
      recorderPanelEl.hidden = false;
      renderRecorder('idle');
    });

    voiceListEl.querySelectorAll('.voice-list__delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        if (!Number.isInteger(id)) return;

        btn.disabled = true;

        try {
          await deleteVoiceProfile(id);
          profiles = profiles.filter((p) => p.id !== id);
          renderVoiceList();
        } catch (err) {
          await showApiError(err);
          btn.disabled = false;
        }
      });
    });
  }

  function renderRecorder(state) {
    const showIdle = state === 'idle';
    const showRecording = state === 'recording';
    const showPreview = state === 'preview';
    const showUploading = state === 'uploading';

    recorderPanelEl.innerHTML = `
      <div class="voice-recorder">
        <p class="voice-recorder__hint">
          برای بهترین نتیجه، در محیط ساکت و با لحن طبیعی صحبت کنید. می‌توانید یک پاراگراف از یک کتاب یا داستان دلخواه بخوانید.
        </p>

        ${
          showUploading
            ? `
          <div class="voice-recorder__loading">
            ${loadingHtml('در حال ساخت صدای جادویی... ✨')}
          </div>
        `
            : `
          <label class="voice-recorder__label" for="voice-name">نام صدا</label>
          <input
            type="text"
            id="voice-name"
            class="input-field voice-recorder__name"
            placeholder="مثلاً مامان یا بابا"
            value="${SUGGESTED_NAMES.find((n) => !profiles.some((p) => p.name === n)) || ''}"
            ${showRecording || showPreview ? 'disabled' : ''}
          />

          <div class="voice-recorder__timer" id="timer" ${showRecording || showPreview ? '' : 'hidden'}>
            ${formatTimer(showPreview ? recordSeconds : 0)}
          </div>

          ${
            showPreview
              ? `
            <audio class="voice-recorder__preview" id="preview-audio" controls src="${previewUrl}"></audio>
            <div class="voice-recorder__actions">
              <button type="button" class="btn-primary" id="confirm-btn">تأیید و ذخیره</button>
              <button type="button" class="btn-secondary" id="retry-btn">ضبط دوباره</button>
            </div>
          `
              : `
            <div class="voice-recorder__actions">
              ${
                showRecording
                  ? `<button type="button" class="btn-primary" id="stop-btn" disabled>توقف ضبط</button>`
                  : `<button type="button" class="btn-primary" id="start-btn">شروع ضبط</button>`
              }
              <button type="button" class="btn-secondary" id="cancel-record-btn">انصراف</button>
            </div>
          `
          }
        `
        }
      </div>
    `;

    if (showUploading) return;

    if (showIdle) {
      recorderPanelEl.querySelector('#start-btn').addEventListener('click', startRecording);
      recorderPanelEl.querySelector('#cancel-record-btn').addEventListener('click', exitRecorder);
    }

    if (showRecording) {
      const stopBtn = recorderPanelEl.querySelector('#stop-btn');
      const timerEl = recorderPanelEl.querySelector('#timer');
      timerEl.textContent = formatTimer(recordSeconds);

      stopBtn.addEventListener('click', stopRecording);
      recorderPanelEl.querySelector('#cancel-record-btn').addEventListener('click', () => {
        cleanupRecording();
        cleanupPreview();
        exitRecorder();
      });
    }

    if (showPreview) {
      previewAudio = recorderPanelEl.querySelector('#preview-audio');
      recorderPanelEl.querySelector('#confirm-btn').addEventListener('click', uploadRecording);
      recorderPanelEl.querySelector('#retry-btn').addEventListener('click', () => {
        cleanupPreview();
        renderRecorder('idle');
      });
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      await setError('مرورگر شما از ضبط صدا پشتیبانی نمی‌کند');
      return;
    }

    try {
      recordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getRecorderMimeType();

      recorder = mimeType
        ? new MediaRecorder(recordStream, { mimeType })
        : new MediaRecorder(recordStream);

      recordChunks = [];
      recordSeconds = 0;

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          recordChunks.push(event.data);
        }
      });

      recorder.addEventListener('stop', () => {
        const type = recorder.mimeType || 'audio/webm';
        previewBlob = new Blob(recordChunks, { type });
        previewUrl = URL.createObjectURL(previewBlob);
        renderRecorder('preview');
      });

      recorder.start(1000);
      renderRecorder('recording');

      const stopBtn = recorderPanelEl.querySelector('#stop-btn');
      const timerEl = recorderPanelEl.querySelector('#timer');

      recordTimer = setInterval(() => {
        recordSeconds += 1;
        timerEl.textContent = formatTimer(recordSeconds);

        if (recordSeconds >= MIN_RECORD_SEC) {
          stopBtn.disabled = false;
        }

        if (recordSeconds >= MAX_RECORD_SEC) {
          stopRecording();
        }
      }, 1000);
    } catch {
      await setError('دسترسی به میکروفون ممکن نشد');
      cleanupRecording();
    }
  }

  async function stopRecording() {
    if (!recorder || recorder.state === 'inactive') return;

    if (recordSeconds < MIN_RECORD_SEC) {
      await setError('حداقل ۳۰ ثانیه ضبط کنید');
      return;
    }

    if (recordTimer) {
      clearInterval(recordTimer);
      recordTimer = null;
    }

    recorder.stop();
    recordStream?.getTracks().forEach((track) => track.stop());
    recordStream = null;
  }

  async function uploadRecording() {
    const nameInput = recorderPanelEl.querySelector('#voice-name');
    const name = nameInput?.value.trim();

    if (!name) {
      await setError('نام صدا را وارد کنید');
      return;
    }

    if (!previewBlob) {
      await setError('فایل ضبط‌شده یافت نشد');
      return;
    }

    renderRecorder('uploading');

    try {
      const { voice_profile: profile } = await createVoiceProfile(name, previewBlob);
      profiles = [...profiles.filter((p) => p.name !== profile.name), profile];
      cleanupPreview();
      cleanupRecording();
      recorderPanelEl.hidden = true;
      voiceListEl.hidden = false;
      renderVoiceList();
    } catch (err) {
      renderRecorder('preview');
      await showApiError(err);
    }
  }

  function exitRecorder() {
    cleanupRecording();
    cleanupPreview();
    recorderPanelEl.hidden = true;
    voiceListEl.hidden = false;
  }

  getVoiceProfiles()
    .then(({ voice_profiles: list }) => {
      profiles = list || [];
      renderVoiceList();
    })
    .catch((err) => {
      showApiError(err);
    });

  return () => {
    cleanupRecording();
    cleanupPreview();
  };
}
