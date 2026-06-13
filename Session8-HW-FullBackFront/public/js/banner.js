(function () {
  'use strict';

  class DakhlyarBanner {
    constructor(banners, containerId) {
      this.banners = banners || [];
      this.container = document.getElementById(containerId);
      this.current = 0;
      this.timer = null;
      this.AUTO_ADVANCE_MS = 4000;
    }

    render() {
      if (!this.banners.length || !this.container) return;
      if (this.banners.length === 1) {
        this.renderSingle();
      } else {
        this.renderCarousel();
      }
    }

    renderSingle() {
      const b = this.banners[0];
      this.container.style.display = 'block';
      this.container.innerHTML = `
        <div class="banner-slide active">
          <img src="${b.image_url}" alt="بنر تبلیغاتی"
               loading="lazy" draggable="false" />
        </div>`;
      this.container.addEventListener('click', () => this.handleClick(b));
    }

    renderCarousel() {
      this.container.style.display = 'block';
      this.container.innerHTML = `
        <div class="banner-track" id="banner-track">
          ${this.banners.map((b, i) => `
            <div class="banner-slide ${i === 0 ? 'active' : ''}" data-idx="${i}">
              <img src="${b.image_url}" alt="بنر تبلیغاتی"
                   loading="${i === 0 ? 'eager' : 'lazy'}" draggable="false" />
            </div>`).join('')}
        </div>
        <div class="banner-dots">
          ${this.banners.map((_, i) =>
            `<span class="banner-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></span>`
          ).join('')}
        </div>`;

      this.bindEvents();
      this.startAutoAdvance();
    }

    bindEvents() {
      const track = document.getElementById('banner-track');
      if (!track) return;

      let startX = 0;
      track.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
      }, { passive: true });

      track.addEventListener('touchend', (e) => {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) {
          if (diff > 0) this.next();
          else this.prev();
        } else {
          this.handleClick(this.banners[this.current]);
        }
      });

      this.container.querySelectorAll('.banner-dot').forEach((dot) => {
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          this.goTo(Number(dot.dataset.idx));
        });
      });

      track.addEventListener('click', () => this.handleClick(this.banners[this.current]));
    }

    goTo(idx) {
      const slides = this.container.querySelectorAll('.banner-slide');
      const dots = this.container.querySelectorAll('.banner-dot');
      slides[this.current]?.classList.remove('active');
      dots[this.current]?.classList.remove('active');
      this.current = (idx + this.banners.length) % this.banners.length;
      slides[this.current]?.classList.add('active');
      dots[this.current]?.classList.add('active');
      this.restartAutoAdvance();
    }

    next() { this.goTo(this.current + 1); }
    prev() { this.goTo(this.current - 1); }

    startAutoAdvance() {
      this.timer = setInterval(() => this.next(), this.AUTO_ADVANCE_MS);
    }

    restartAutoAdvance() {
      clearInterval(this.timer);
      this.startAutoAdvance();
    }

    handleClick(banner) {
      if (!banner) return;
      fetch(`/api/banners/${banner.id}/click`, {
        method: 'POST',
        credentials: 'same-origin',
      }).catch(() => {});

      if (banner.link_type === 'internal') {
        window.location.href = banner.link_url;
      } else {
        window.open(banner.link_url, '_blank', 'noopener,noreferrer');
      }
    }

    destroy() {
      clearInterval(this.timer);
      if (this.container) {
        this.container.style.display = 'none';
        this.container.innerHTML = '';
      }
    }
  }

  window.DakhlyarBanner = DakhlyarBanner;
})();
