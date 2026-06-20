import { SERVER_BASE } from '../api/config.js';
import { generateStoryAudio, getStory } from '../api/stories.js';
import { getVoiceProfiles } from '../api/voice.js';
import { getSelectedVoiceId, setSelectedVoiceId } from '../utils/voicePreference.js';
import { showApiError } from '../utils/show-error.js';
import { showErrorModal } from '../components/modal.js';
import { loadingHtml } from '../components/loading.js';
import { backButtonHtml, bindBackButton } from '../components/back-button.js';

export function renderCalmPlayback(container, { storyId, onBack }) {
  let audio = null;
  let animFrame = null;
  let story = null;
  let voiceProfiles = [];
  let selectedVoiceId = getSelectedVoiceId();
  let loadingAudio = false;

  container.innerHTML = `
    <div class="screen screen--with-chrome screen--framed">
      ${backButtonHtml()}
      <div class="playback">
        <div class="playback__header">
          <span class="playback__emoji" id="story-emoji">📖</span>
          <h2 class="playback__title" id="story-title">...</h2>
        </div>
        <div class="voice-pills" id="voice-pills" hidden></div>
        <div id="audio-loading">${loadingHtml('در حال آماده‌سازی صدا...')}</div>
        <div class="waveform" id="waveform" aria-hidden="true">
          ${Array.from({ length: 7 })
            .map(() => '<span class="waveform__bar"></span>')
            .join('')}
        </div>
        <button type="button" class="playback__play" id="play-btn" aria-label="پخش">
          <span id="play-icon">▶</span>
        </button>
        <div class="playback__progress">
          <div class="playback__progress-fill" id="progress-fill"></div>
        </div>
        <p class="playback__time" id="time-label">۰:۰۰ / ۰:۰۰</p>
      </div>
    </div>
  `;

  const playBtn = container.querySelector('#play-btn');
  const playIcon = container.querySelector('#play-icon');
  const progressFill = container.querySelector('#progress-fill');
  const timeLabel = container.querySelector('#time-label');
  const waveform = container.querySelector('#waveform');
  const voicePillsEl = container.querySelector('#voice-pills');
  const audioLoadingEl = container.querySelector('#audio-loading');

  function formatTime(sec) {
    if (!Number.isFinite(sec)) return '۰:۰۰';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  }

  function updateProgress() {
    if (!audio) return;
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    progressFill.style.width = `${pct}%`;
    timeLabel.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  }

  function animateWaveform(active) {
    const bars = waveform.querySelectorAll('.waveform__bar');
    if (!active) {
      cancelAnimationFrame(animFrame);
      bars.forEach((b) => {
        b.style.height = '20%';
      });
      waveform.classList.remove('waveform--active');
      return;
    }

    waveform.classList.add('waveform--active');
    const tick = () => {
      bars.forEach((bar) => {
        bar.style.height = `${20 + Math.random() * 80}%`;
      });
      animFrame = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(animFrame);
    tick();
  }

  function setPlaying(playing) {
    playIcon.textContent = playing ? '⏸' : '▶';
    animateWaveform(playing);
  }

  bindBackButton(container, () => {
    audio?.pause();
    animateWaveform(false);
    onBack();
  });

  function renderVoicePills() {
    const pills = [
      { id: 'default', label: 'صدای پیش‌فرض', voiceId: null },
      ...voiceProfiles.map((profile) => ({
        id: String(profile.id),
        label: `صدای ${profile.name}`,
        voiceId: profile.elevenlabs_voice_id,
      })),
    ];

    voicePillsEl.innerHTML = pills
      .map(
        (pill) => `
        <button
          type="button"
          class="voice-pill ${selectedVoiceId === pill.id ? 'voice-pill--active' : ''}"
          data-voice-id="${pill.id}"
          ${loadingAudio ? 'disabled' : ''}
        >
          ${pill.label}
        </button>
      `
      )
      .join('');

    voicePillsEl.hidden = false;

    voicePillsEl.querySelectorAll('.voice-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextId = btn.dataset.voiceId;
        if (nextId === selectedVoiceId || loadingAudio) return;

        selectedVoiceId = nextId;
        setSelectedVoiceId(nextId);
        renderVoicePills();
        loadAudio();
      });
    });
  }

  function getApiVoiceId() {
    if (selectedVoiceId === 'default') return null;
    const profile = voiceProfiles.find((p) => String(p.id) === selectedVoiceId);
    return profile?.elevenlabs_voice_id || null;
  }

  async function loadAudio() {
    if (!story) return;

    loadingAudio = true;
    audioLoadingEl.hidden = false;
    playBtn.disabled = true;
    renderVoicePills();

    audio?.pause();
    setPlaying(false);
    audio = null;

    try {
      const apiVoiceId = getApiVoiceId();
      const { audio_url: audioPath } = await generateStoryAudio(story.id, apiVoiceId);
      audio = new Audio(`${SERVER_BASE}${audioPath}`);

      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('loadedmetadata', updateProgress);
      audio.addEventListener('ended', () => setPlaying(false));

      playBtn.disabled = false;
    } catch (err) {
      await showApiError(err);
    } finally {
      loadingAudio = false;
      audioLoadingEl.hidden = true;
      renderVoicePills();
    }
  }

  playBtn.addEventListener('click', async () => {
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        await showErrorModal('پخش صدا ممکن نشد');
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  });

  Promise.all([getStory(storyId), getVoiceProfiles()])
    .then(async ([storyRes, voiceRes]) => {
      story = storyRes.story;
      voiceProfiles = voiceRes.voice_profiles || [];

      container.querySelector('#story-emoji').textContent = story.emoji || '📖';
      container.querySelector('#story-title').textContent = story.title;

      if (!voiceProfiles.some((p) => String(p.id) === selectedVoiceId)) {
        selectedVoiceId = 'default';
        setSelectedVoiceId('default');
      }

      renderVoicePills();
      await loadAudio();
    })
    .catch(async (err) => {
      audioLoadingEl.innerHTML = '';
      await showApiError(err);
    });
}
