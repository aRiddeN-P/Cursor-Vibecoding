import { getServiceUsage } from '../api/usage.js';
import { toPersianDigits } from '../utils/digits.js';

function formatNumber(value) {
  return toPersianDigits(Number(value || 0).toLocaleString('en-US'));
}

function usageBarClass(remaining, limit) {
  if (!limit) return '';
  const ratio = remaining / limit;
  if (ratio <= 0.1) return 'service-usage__bar-fill--low';
  if (ratio <= 0.35) return 'service-usage__bar-fill--mid';
  return '';
}

function renderBar(remaining, limit) {
  const pct = limit > 0 ? Math.min(100, Math.round((remaining / limit) * 100)) : 0;
  return `
    <div class="service-usage__bar" aria-hidden="true">
      <div class="service-usage__bar-fill ${usageBarClass(remaining, limit)}" style="width: ${pct}%"></div>
    </div>
  `;
}

function renderGeminiRows(gemini) {
  if (!gemini?.configured) {
    return `<p class="service-usage__unavailable">Gemini پیکربندی نشده</p>`;
  }

  const { limits, used, remaining } = gemini;

  return `
    <div class="service-usage__group">
      <p class="service-usage__group-title">🤖 Gemini</p>
      <div class="service-usage__row">
        <span class="service-usage__label">درخواست در دقیقه (RPM)</span>
        <span class="service-usage__value">${formatNumber(remaining.requests_per_minute)} از ${formatNumber(limits.rpm)}</span>
      </div>
      ${renderBar(remaining.requests_per_minute, limits.rpm)}
      <div class="service-usage__row">
        <span class="service-usage__label">درخواست در روز (RPD)</span>
        <span class="service-usage__value">${formatNumber(remaining.requests_per_day)} از ${formatNumber(limits.rpd)}</span>
      </div>
      ${renderBar(remaining.requests_per_day, limits.rpd)}
      <div class="service-usage__row">
        <span class="service-usage__label">توکن در دقیقه (TPM)</span>
        <span class="service-usage__value">${formatNumber(remaining.tokens_per_minute)} از ${formatNumber(limits.tpm)}</span>
      </div>
      ${renderBar(remaining.tokens_per_minute, limits.tpm)}
      <p class="service-usage__footnote">مصرف‌شده: ${formatNumber(used.requests_per_minute)} RPM · ${formatNumber(used.requests_per_day)} RPD · ${formatNumber(used.tokens_per_minute)} TPM</p>
    </div>
  `;
}

function renderElevenLabsRow(elevenlabs) {
  if (!elevenlabs?.configured) {
    return `<p class="service-usage__unavailable">ElevenLabs پیکربندی نشده</p>`;
  }

  if (!elevenlabs.available) {
    return `<p class="service-usage__unavailable">${elevenlabs.error || 'وضعیت ElevenLabs در دسترس نیست'}</p>`;
  }

  const { characters_remaining, character_limit, character_count } = elevenlabs;

  return `
    <div class="service-usage__group">
      <p class="service-usage__group-title">🎙 ElevenLabs</p>
      <div class="service-usage__row">
        <span class="service-usage__label">کاراکتر باقی‌مانده</span>
        <span class="service-usage__value">${formatNumber(characters_remaining)} از ${formatNumber(character_limit)}</span>
      </div>
      ${renderBar(characters_remaining, character_limit)}
      <p class="service-usage__footnote">مصرف‌شده: ${formatNumber(character_count)} کاراکتر</p>
    </div>
  `;
}

export function serviceUsageHtml() {
  return `<div class="service-usage" id="service-usage">${/* loading placeholder */''}</div>`;
}

export function mountServiceUsage(container, { refreshMs = 30000, showTitle = true } = {}) {
  const el = container.querySelector('#service-usage');
  if (!el) return;

  let timer = null;

  async function load() {
    try {
      const data = await getServiceUsage();
      el.innerHTML = `
        ${showTitle ? '<p class="service-usage__title">وضعیت سرویس‌ها</p>' : ''}
        ${renderGeminiRows(data.gemini)}
        ${renderElevenLabsRow(data.elevenlabs)}
      `;
    } catch {
      el.innerHTML = `<p class="service-usage__unavailable">وضعیت سرویس‌ها در دسترس نیست</p>`;
    }
  }

  load();

  if (refreshMs > 0) {
    timer = setInterval(load, refreshMs);
  }

  return () => {
    if (timer) clearInterval(timer);
  };
}
