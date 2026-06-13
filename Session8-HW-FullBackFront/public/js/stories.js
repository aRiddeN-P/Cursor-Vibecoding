/* ============================================================
   Dakhlyar — StoryPlayer
   Fullscreen, Instagram-style story player with:
     - per-story progress bar (5s) at the top
     - hold-to-pause / release-to-resume
     - tap left 30% → prev, tap right 70% → next
     - close (×) → mark seen + close
   Auto-marks seen when the last story finishes naturally.
   Exposes window.StoryPlayer.
   ============================================================ */

(function () {
  'use strict';

  const STORY_DURATION_MS = 5000;
  const HOLD_THRESHOLD_MS = 200;

  // ---------- Inject self-contained CSS once ----------
  const STYLE_ID = 'dakhlyar-story-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .dak-story-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: #000;
        display: none;
        align-items: center;
        justify-content: center;
        user-select: none;
        -webkit-user-select: none;
        touch-action: manipulation;
      }
      .dak-story-overlay.open { display: flex; }

      .dak-story-progress {
        position: absolute;
        top: 12px;
        left: 12px;
        right: 12px;
        display: flex;
        gap: 4px;
        z-index: 2;
        direction: ltr;
      }
      .dak-story-progress .bar {
        flex: 1;
        height: 3px;
        background: rgba(255,255,255,0.3);
        border-radius: 2px;
        overflow: hidden;
      }
      .dak-story-progress .bar > .fill {
        display: block;
        height: 100%;
        width: 0%;
        background: #fff;
      }
      .dak-story-progress .bar.done > .fill { width: 100%; }
      .dak-story-progress .bar.active > .fill {
        animation: dak-story-fill linear forwards;
        animation-duration: ${STORY_DURATION_MS}ms;
      }
      @keyframes dak-story-fill {
        from { width: 0%; }
        to   { width: 100%; }
      }

      .dak-story-close {
        position: absolute;
        top: 18px;
        left: 18px;
        z-index: 3;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(0,0,0,0.45);
        color: #fff;
        border: 0;
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: inherit;
      }
      .dak-story-close:hover { background: rgba(0,0,0,0.7); }

      .dak-story-image-wrap {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
        background: #000;
      }
      .dak-story-image-wrap img {
        max-width: 100%;
        max-height: 100vh;
        object-fit: contain;
        display: block;
        pointer-events: none;
      }

      .dak-story-zones {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: flex;
      }
      .dak-story-zones .zone-prev { width: 30%; }
      .dak-story-zones .zone-next { width: 70%; }
      .dak-story-zones .zone-prev,
      .dak-story-zones .zone-next {
        height: 100%;
        background: transparent;
      }

      @media (min-width: 720px) {
        .dak-story-image-wrap img {
          max-width: 420px;
          border-radius: 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================================
  //                       StoryPlayer
  // ============================================================

  class StoryPlayer {
    /**
     * @param {Array<{id:number, order_index:number, image_url:string}>} stories
     * @param {{onClose?: Function, markSeenUrl?: string}} options
     */
    constructor(stories, options = {}) {
      this.stories = Array.isArray(stories) ? stories.slice() : [];
      this.options = Object.assign({
        markSeenUrl: '/api/stories/mark-seen',
        onClose: null,
      }, options);

      this.currentIndex = 0;
      this.timer = null;
      this.pausedAt = 0;
      this.remainingTime = STORY_DURATION_MS;
      this.isHolding = false;
      this.startedAt = 0;
      this.isOpen = false;
      this.markedSeen = false;
      this.holdStartTime = 0;

      this._els = {};
      injectStyles();
      this._buildDom();
    }

    // ---------- DOM ----------

    _buildDom() {
      const overlay = document.createElement('div');
      overlay.className = 'dak-story-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', 'استوری معرفی دخلیار');

      const progress = document.createElement('div');
      progress.className = 'dak-story-progress';

      const imageWrap = document.createElement('div');
      imageWrap.className = 'dak-story-image-wrap';
      const img = document.createElement('img');
      img.alt = '';
      imageWrap.appendChild(img);

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'dak-story-close';
      closeBtn.setAttribute('aria-label', 'بستن');
      closeBtn.textContent = '×';

      const zones = document.createElement('div');
      zones.className = 'dak-story-zones';
      const zonePrev = document.createElement('div');
      zonePrev.className = 'zone-prev';
      const zoneNext = document.createElement('div');
      zoneNext.className = 'zone-next';
      // RTL: visually, "right" is زون آخر. We keep prev=right-side, next=left-side
      // by reading the zones right-to-left. But specs say tap-left=prev, tap-right=next.
      // Since the overlay is rendered with default LTR flex (ignoring page dir),
      // zone-prev sits on the left and zone-next on the right — which matches spec.
      zones.appendChild(zonePrev);
      zones.appendChild(zoneNext);

      overlay.appendChild(imageWrap);
      overlay.appendChild(progress);
      overlay.appendChild(closeBtn);
      overlay.appendChild(zones);
      document.body.appendChild(overlay);

      this._els = { overlay, progress, img, closeBtn, zones, zonePrev, zoneNext };

      // ---------- Listeners ----------

      closeBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.finish();
      });

      // Hold-to-pause on the zones layer.
      const onDown = (e) => {
        e.preventDefault();
        this.holdStartTime = Date.now();
        this.pause();
      };
      const onUpPrev = (e) => this._onUpInZone(e, 'prev');
      const onUpNext = (e) => this._onUpInZone(e, 'next');
      const onCancel = () => { if (this.isHolding) this.resume(); };

      zonePrev.addEventListener('pointerdown', onDown);
      zoneNext.addEventListener('pointerdown', onDown);
      zonePrev.addEventListener('pointerup', onUpPrev);
      zoneNext.addEventListener('pointerup', onUpNext);
      zonePrev.addEventListener('pointercancel', onCancel);
      zoneNext.addEventListener('pointercancel', onCancel);
      zonePrev.addEventListener('pointerleave', onCancel);
      zoneNext.addEventListener('pointerleave', onCancel);

      // Keyboard support: ← prev, → next, Esc close, space toggle pause.
      this._onKey = (e) => {
        if (!this.isOpen) return;
        if (e.key === 'Escape') { this.finish(); return; }
        if (e.key === 'ArrowLeft') { this.prev(); return; }
        if (e.key === 'ArrowRight') { this.next(); return; }
        if (e.key === ' ') {
          e.preventDefault();
          if (this.isHolding) this.resume(); else this.pause();
        }
      };
    }

    _onUpInZone(_e, side) {
      const dur = Date.now() - this.holdStartTime;
      if (dur < HOLD_THRESHOLD_MS) {
        // It was a tap, not a hold.
        if (side === 'prev') this.prev();
        else this.next();
      } else {
        // It was a hold — just resume.
        if (this.isHolding) this.resume();
      }
    }

    // ---------- Public ----------

    open() {
      if (!this.stories.length) {
        this.finish();
        return;
      }
      this.isOpen = true;
      this.currentIndex = 0;
      this._els.overlay.classList.add('open');
      document.documentElement.style.overflow = 'hidden';
      document.addEventListener('keydown', this._onKey);
      this._renderProgressBars();
      this.goToStory(0);
    }

    close() {
      this._clearTimer();
      this._els.overlay.classList.remove('open');
      document.documentElement.style.overflow = '';
      document.removeEventListener('keydown', this._onKey);
      this.isOpen = false;
      if (typeof this.options.onClose === 'function') {
        try { this.options.onClose(); } catch (_) {}
      }
    }

    /** Mark as seen on the server then close. Safe to call multiple times. */
    async finish() {
      if (!this.markedSeen) {
        this.markedSeen = true;
        try {
          await fetch(this.options.markSeenUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          });
        } catch (err) {
          console.warn('[StoryPlayer] mark-seen failed:', err);
        }
      }
      this.close();
    }

    next() {
      if (this.currentIndex >= this.stories.length - 1) {
        this.finish();
        return;
      }
      this.goToStory(this.currentIndex + 1);
    }

    prev() {
      if (this.currentIndex <= 0) {
        // On first story, a "left" tap closes per spec.
        this.finish();
        return;
      }
      this.goToStory(this.currentIndex - 1);
    }

    goToStory(index) {
      this._clearTimer();
      this.currentIndex = Math.max(0, Math.min(index, this.stories.length - 1));
      this.remainingTime = STORY_DURATION_MS;
      this.isHolding = false;
      this._renderImage();
      this._renderProgressBars();
      this._startTimer(STORY_DURATION_MS);
    }

    pause() {
      if (!this.isOpen || this.isHolding) return;
      this.isHolding = true;
      this.pausedAt = Date.now();
      this.remainingTime = Math.max(0, this.remainingTime - (this.pausedAt - this.startedAt));
      this._clearTimer();
      const activeFill = this._els.progress.querySelector('.bar.active > .fill');
      if (activeFill) activeFill.style.animationPlayState = 'paused';
    }

    resume() {
      if (!this.isOpen || !this.isHolding) return;
      this.isHolding = false;
      const activeFill = this._els.progress.querySelector('.bar.active > .fill');
      if (activeFill) activeFill.style.animationPlayState = 'running';
      this._startTimer(this.remainingTime);
    }

    // ---------- Internal ----------

    _clearTimer() {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }

    _startTimer(ms) {
      this.startedAt = Date.now();
      this._clearTimer();
      this.timer = setTimeout(() => this.next(), Math.max(0, ms));
    }

    _renderImage() {
      const story = this.stories[this.currentIndex];
      if (!story) return;
      // Pre-load: avoid showing the previous frame until new image arrives.
      const img = this._els.img;
      img.style.visibility = 'hidden';
      img.onload = () => { img.style.visibility = 'visible'; };
      img.onerror = () => { img.style.visibility = 'visible'; };
      img.src = story.image_url;
    }

    _renderProgressBars() {
      const wrap = this._els.progress;
      wrap.innerHTML = '';
      this.stories.forEach((_, i) => {
        const bar = document.createElement('div');
        bar.className = 'bar';
        const fill = document.createElement('span');
        fill.className = 'fill';
        bar.appendChild(fill);
        if (i < this.currentIndex) bar.classList.add('done');
        else if (i === this.currentIndex) bar.classList.add('active');
        wrap.appendChild(bar);
      });
    }
  }

  // Expose globally.
  window.StoryPlayer = StoryPlayer;
})();
