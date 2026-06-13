(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function clearSvg(svgId) {
    const svg = document.getElementById(svgId);
    if (svg) svg.innerHTML = '';
    return svg;
  }

  function drawAdminBarChart(svgId, data, options = {}) {
    const svg = clearSvg(svgId);
    if (!svg || !data || !data.length) return;

    const width = options.width || svg.clientWidth || 400;
    const height = options.height || 200;
    const padL = 36;
    const padR = 12;
    const padT = 12;
    const padB = 36;
    const barColor = options.barColor || '#1A5C3A';
    const maxValue = options.maxValue || Math.max(...data.map(d => d.value), 1);
    const chartW = width - padL - padR;
    const chartH = height - padT - padB;
    const barW = Math.min(48, chartW / data.length - 8);

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i;
      const val = Math.round(maxValue * (1 - i / 4));
      el('line', { x1: padL, y1: y, x2: width - padR, y2: y, stroke: '#E2E8F0', 'stroke-width': 0.5 }, svg);
      el('text', {
        x: padL - 6, y: y + 4, 'text-anchor': 'end', fill: '#94A3B8', 'font-size': 9,
      }, svg).textContent = window.AdminAPI ? AdminAPI.pd(val) : val;
    }

    data.forEach((item, i) => {
      const x = padL + (chartW / data.length) * i + (chartW / data.length - barW) / 2;
      const targetH = (item.value / maxValue) * chartH;
      const y = padT + chartH - targetH;
      const color = item.color || barColor;

      const rect = el('rect', {
        x, y: padT + chartH, width: barW, height: 0,
        fill: color, rx: 4,
      }, svg);

      requestAnimationFrame(() => {
        rect.setAttribute('y', y);
        rect.setAttribute('height', targetH);
        rect.style.transition = 'y 0.6s ease, height 0.6s ease';
      });

      if (options.showValues !== false) {
        el('text', {
          x: x + barW / 2, y: y - 4, 'text-anchor': 'middle', fill: '#475569', 'font-size': 9,
        }, svg).textContent = window.AdminAPI ? AdminAPI.pd(item.value) : item.value;
      }

      el('text', {
        x: x + barW / 2, y: height - 8, 'text-anchor': 'middle', fill: '#64748B', 'font-size': 9,
      }, svg).textContent = item.label;
    });
  }

  function fullDonutPath(cx, cy, outerR, innerR) {
    return [
      `M ${cx} ${cy - outerR}`,
      `A ${outerR} ${outerR} 0 1 1 ${cx} ${cy + outerR}`,
      `A ${outerR} ${outerR} 0 1 1 ${cx} ${cy - outerR}`,
      `M ${cx} ${cy - innerR}`,
      `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy + innerR}`,
      `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR}`,
    ].join(' ');
  }

  function drawAdminDonutChart(svgId, data, options = {}) {
    const svg = clearSvg(svgId);
    if (!svg || !data || !data.length) return;

    const size = options.size || 200;
    const cx = size / 2;
    const cy = size / 2 - 8;
    const outerR = Math.min(cx, cy) - 10;
    const innerR = outerR * 0.58;
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const slices = data.filter((d) => d.value > 0);

    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

    if (slices.length === 1) {
      const path = el('path', {
        d: fullDonutPath(cx, cy, outerR, innerR),
        fill: slices[0].color,
        'fill-rule': 'evenodd',
        opacity: 0,
      }, svg);
      requestAnimationFrame(() => {
        path.style.transition = 'opacity 0.5s ease';
        path.setAttribute('opacity', 1);
      });
    } else {
      let angle = -Math.PI / 2;
      slices.forEach((item) => {
        const slice = (item.value / total) * Math.PI * 2;
        const x1 = cx + outerR * Math.cos(angle);
        const y1 = cy + outerR * Math.sin(angle);
        angle += slice;
        const x2 = cx + outerR * Math.cos(angle);
        const y2 = cy + outerR * Math.sin(angle);
        const ix1 = cx + innerR * Math.cos(angle - slice);
        const iy1 = cy + innerR * Math.sin(angle - slice);
        const ix2 = cx + innerR * Math.cos(angle);
        const iy2 = cy + innerR * Math.sin(angle);
        const large = slice > Math.PI ? 1 : 0;

        const path = el('path', {
          d: `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`,
          fill: item.color,
          opacity: 0,
        }, svg);

        requestAnimationFrame(() => {
          path.style.transition = 'opacity 0.5s ease';
          path.setAttribute('opacity', 1);
        });
      });
    }

    const centerLabel = options.centerLabel || 'کل';
    const centerVal = options.centerValue != null ? options.centerValue : total;
    el('text', { x: cx, y: cy - 4, class: 'donut-center-label' }, svg).textContent = centerLabel;
    el('text', { x: cx, y: cy + 14, class: 'donut-center-value' }, svg).textContent =
      window.AdminAPI ? AdminAPI.pd(centerVal) : centerVal;

    const oldLegend = document.getElementById(svgId + '-legend');
    if (oldLegend) oldLegend.remove();
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    legend.id = svgId + '-legend';
    svg.parentElement?.appendChild(legend);

    data.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'chart-legend-item';
      row.innerHTML = `<span class="chart-legend-dot" style="background:${item.color}"></span>${item.label} (${window.AdminAPI ? AdminAPI.pd(item.value) : item.value})`;
      legend.appendChild(row);
    });
  }

  function drawAdminLineChart(svgId, data, options = {}) {
    const svg = clearSvg(svgId);
    if (!svg || !data || !data.length) return;

    const width = options.width || svg.clientWidth || 400;
    const height = options.height || 200;
    const padL = 36;
    const padR = 12;
    const padT = 16;
    const padB = 36;
    const lineColor = options.lineColor || '#1A5C3A';
    const maxValue = options.maxValue || Math.max(...data.map(d => d.value), 1);
    const chartW = width - padL - padR;
    const chartH = height - padT - padB;

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const points = data.map((item, i) => {
      const x = padL + (chartW / Math.max(data.length - 1, 1)) * i;
      const y = padT + chartH - (item.value / maxValue) * chartH;
      return { x, y, ...item };
    });

    if (points.length > 1) {
      let areaD = `M ${points[0].x} ${padT + chartH} L ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const cur = points[i];
        const cpx = (prev.x + cur.x) / 2;
        areaD += ` C ${cpx} ${prev.y}, ${cpx} ${cur.y}, ${cur.x} ${cur.y}`;
      }
      areaD += ` L ${points[points.length - 1].x} ${padT + chartH} Z`;

      el('path', { d: areaD, fill: lineColor, opacity: 0.12 }, svg);

      let lineD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const cur = points[i];
        const cpx = (prev.x + cur.x) / 2;
        lineD += ` C ${cpx} ${prev.y}, ${cpx} ${cur.y}, ${cur.x} ${cur.y}`;
      }
      const linePath = el('path', {
        d: lineD, fill: 'none', stroke: lineColor, 'stroke-width': 2.5,
        'stroke-linecap': 'round',
      }, svg);
      const len = linePath.getTotalLength?.() || 500;
      linePath.setAttribute('stroke-dasharray', len);
      linePath.setAttribute('stroke-dashoffset', len);
      requestAnimationFrame(() => {
        linePath.style.transition = 'stroke-dashoffset 0.8s ease';
        linePath.setAttribute('stroke-dashoffset', 0);
      });
    }

    const tooltip = el('text', {
      x: 0, y: 0, class: 'chart-tooltip', visibility: 'hidden',
    }, svg);

    points.forEach((p) => {
      const dot = el('circle', {
        cx: p.x, cy: p.y, r: 4, fill: '#fff', stroke: lineColor, 'stroke-width': 2,
        style: 'cursor:pointer',
      }, svg);

      dot.addEventListener('mouseenter', () => {
        tooltip.setAttribute('visibility', 'visible');
        tooltip.setAttribute('x', p.x);
        tooltip.setAttribute('y', p.y - 10);
        tooltip.setAttribute('text-anchor', 'middle');
        tooltip.textContent = `${p.label}: ${window.AdminAPI ? AdminAPI.pd(p.value) : p.value}`;
      });
      dot.addEventListener('mouseleave', () => {
        tooltip.setAttribute('visibility', 'hidden');
      });

      el('text', {
        x: p.x, y: height - 8, 'text-anchor': 'middle', fill: '#64748B', 'font-size': 9,
      }, svg).textContent = p.label;
    });
  }

  window.drawAdminBarChart = drawAdminBarChart;
  window.drawAdminDonutChart = drawAdminDonutChart;
  window.drawAdminLineChart = drawAdminLineChart;
})();
