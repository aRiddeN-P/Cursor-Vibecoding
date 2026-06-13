(function () {
  'use strict';

  function polar(cx, cy, r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(cx, cy, r, startAngle, endAngle) {
    const start = polar(cx, cy, r, endAngle);
    const end = polar(cx, cy, r, startAngle);
    const large = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
  }

  function drawDonut(containerId, data, centerText) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const size = 200;
    const cx = size / 2;
    const cy = size / 2;
    const r = 80;
    const ir = 52;
    let angle = 0;
    let paths = '';
    for (const d of data) {
      const sweep = (d.value / total) * 360;
      if (sweep <= 0) continue;
      paths += `<path d="${arcPath(cx, cy, r, angle, angle + sweep)}" fill="${d.color}"/>`;
      angle += sweep;
    }
    paths += `<circle cx="${cx}" cy="${cy}" r="${ir}" fill="var(--color-white,#fff)"/>`;
    wrap.innerHTML = `
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="نمودار دونات">
        ${paths}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="11" fill="var(--color-text-3)" font-family="Vazirmatn,sans-serif">مجموع</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--color-text-1)" font-family="Vazirmatn,sans-serif">${centerText || ''}</text>
      </svg>`;
  }

  function drawBars(svgId, data) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const w = 320;
    const h = 180;
    const pad = 30;
    const groupW = Math.floor((w - pad * 2) / Math.max(data.length, 1));
    const maxVal = Math.max(...data.flatMap((d) => [d.income || 0, d.expense || 0]), 1);
    let bars = '';
    data.forEach((d, i) => {
      const gx = pad + i * groupW + groupW * 0.15;
      const barW = groupW * 0.28;
      const incH = ((d.income || 0) / maxVal) * (h - 50);
      const expH = ((d.expense || 0) / maxVal) * (h - 50);
      const baseY = h - 28;
      bars += `<rect x="${gx}" y="${baseY - incH}" width="${barW}" height="${incH}" fill="#1A5C3A" rx="3">
        <animate attributeName="height" from="0" to="${incH}" dur="0.6s" fill="freeze"/>
        <animate attributeName="y" from="${baseY}" to="${baseY - incH}" dur="0.6s" fill="freeze"/>
      </rect>`;
      bars += `<rect x="${gx + barW + 4}" y="${baseY - expH}" width="${barW}" height="${expH}" fill="#DC2626" rx="3">
        <animate attributeName="height" from="0" to="${expH}" dur="0.6s" fill="freeze"/>
        <animate attributeName="y" from="${baseY}" to="${baseY - expH}" dur="0.6s" fill="freeze"/>
      </rect>`;
      bars += `<text x="${gx + barW}" y="${h - 8}" text-anchor="middle" font-size="9" fill="var(--color-text-3)" font-family="Vazirmatn">${d.label || ''}</text>`;
    });
    svg.innerHTML = bars;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  function drawScoreArc(svgId, score) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const size = 140;
    const cx = size / 2;
    const cy = size / 2;
    const r = 58;
    const circ = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, score));
    const dash = (pct / 100) * circ;
    const color = pct >= 80 ? '#1A5C3A' : pct >= 60 ? '#3B82F6' : pct >= 40 ? '#F59E0B' : '#DC2626';
    svg.innerHTML = `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E5E7EB" stroke-width="10"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="10"
        stroke-dasharray="${dash} ${circ}" stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})">
        <animate attributeName="stroke-dasharray" from="0 ${circ}" to="${dash} ${circ}" dur="0.8s" fill="freeze"/>
      </circle>`;
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  }

  function drawWeekBars(containerId, days) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    const max = Math.max(...days.map((d) => d.avg_expense), 1);
    wrap.innerHTML = days.map((d) => {
      const h = Math.round((d.avg_expense / max) * 100);
      const peak = d.day_name === days.reduce((a, b) => (b.avg_expense > a.avg_expense ? b : a)).day_name;
      return `<div class="rp-week-col ${peak === d.day_name ? 'peak' : ''}">
        <div class="rp-week-bar" style="height:${Math.max(4, h)}%"></div>
        <span class="rp-week-lbl">${d.day_name.slice(0, 3)}</span>
      </div>`;
    }).join('');
  }

  window.DakhlyarCharts = {
    drawDonut,
    drawBars,
    drawScoreArc,
    drawWeekBars,
  };
})();
