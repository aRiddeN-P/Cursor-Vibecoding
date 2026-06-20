/**
 * Creates and mounts the reusable starfield background.
 * ~80 stars with random position, size, twinkle duration (2–5s), and delay.
 *
 * @param {HTMLElement} [container=document.body] - Parent element to append into
 * @returns {HTMLElement} The starfield root element
 */
export function createStarfield(container = document.body) {
  const STAR_COUNT = 80;
  const MIN_DURATION = 2;
  const MAX_DURATION = 5;

  const starfield = document.createElement('div');
  starfield.className = 'starfield';
  starfield.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < STAR_COUNT; i++) {
    const star = document.createElement('div');
    star.className = 'starfield__star';

    const size = Math.random() * 2.5 + 1;
    const duration = MIN_DURATION + Math.random() * (MAX_DURATION - MIN_DURATION);
    const delay = Math.random() * duration;

    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.setProperty('--twinkle-duration', `${duration.toFixed(2)}s`);
    star.style.setProperty('--twinkle-delay', `${delay.toFixed(2)}s`);

    starfield.appendChild(star);
  }

  container.insertBefore(starfield, container.firstChild);
  return starfield;
}
