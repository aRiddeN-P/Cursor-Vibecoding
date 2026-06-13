/**
 * admin-date-picker.js
 * Persian (Jalali) datetime picker for the admin panel.
 * Wraps persian-datepicker (jQuery) — stores Gregorian ISO in input.dataset.iso.
 */
(function () {
  'use strict';

  const CDN = {
    css: 'https://cdn.jsdelivr.net/npm/persian-datepicker@1.2.0/dist/css/persian-datepicker.min.css',
    jquery: 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js',
    persianDate: 'https://cdn.jsdelivr.net/npm/persian-date@1.1.0/dist/persian-date.min.js',
    picker: 'https://cdn.jsdelivr.net/npm/persian-datepicker@1.2.0/dist/js/persian-datepicker.min.js',
  };

  let depsReady = null;

  function loadCss(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('failed to load ' + src));
      document.head.appendChild(script);
    });
  }

  function ensureDeps() {
    if (depsReady) return depsReady;
    loadCss(CDN.css);
    loadCss('/admin/css/admin-datepicker.css');
    depsReady = loadScript(CDN.jquery)
      .then(() => loadScript(CDN.persianDate))
      .then(() => loadScript(CDN.picker));
    return depsReady;
  }

  function $jq(input) {
    return window.jQuery(input);
  }

  function toUnix(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  function setIsoDataset(input, unix) {
    if (unix == null) {
      delete input.dataset.iso;
      return;
    }
    input.dataset.iso = new Date(unix).toISOString();
  }

  function parseVisibleValue(input) {
    const raw = window.AdminAPI
      ? AdminAPI.normalizeDigits(String(input.value || '').trim())
      : String(input.value || '').trim();
    if (!raw || typeof window.persianDate !== 'function') return null;

    const match = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (!match) return null;

    try {
      const pd = new window.persianDate([
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        Number(match[4] || 0),
        Number(match[5] || 0),
      ]);
      return pd.toCalendar('gregorian').toDate().toISOString();
    } catch {
      return null;
    }
  }

  function fireChange(input) {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function destroy(input) {
    if (!input || !window.jQuery) return;
    const $ = $jq(input);
    if ($.data('datepicker')) {
      $.persianDatepicker('destroy');
    }
    delete input.dataset.iso;
  }

  async function init(input, opts = {}) {
    if (!input || input.disabled) return;
    await ensureDeps();

    destroy(input);

    const unixDefault = toUnix(opts.value);
    const $ = $jq(input);

    const options = {
      format: opts.format || 'YYYY/MM/DD HH:mm',
      autoClose: true,
      observer: true,
      calendarType: 'persian',
      initialValue: unixDefault != null,
      initialValueType: 'gregorian',
      persianDigit: true,
      calendar: { persian: { locale: 'fa' } },
      toolbox: { calendarSwitch: { enabled: false } },
      timePicker: {
        enabled: opts.time !== false,
        meridiem: { enabled: false },
      },
      onSelect: (unix) => {
        setIsoDataset(input, unix);
        fireChange(input);
        if (typeof opts.onSelect === 'function') opts.onSelect(unix);
      },
    };

    if (opts.minDate != null) options.minDate = toUnix(opts.minDate);
    if (opts.maxDate != null) options.maxDate = toUnix(opts.maxDate);

    $.persianDatepicker(options);

    if (unixDefault != null) {
      setIsoDataset(input, unixDefault);
      $.persianDatepicker('setDate', unixDefault);
    }
  }

  function setValue(input, value) {
    if (!input) return;
    const unix = toUnix(value);
    if (unix == null) {
      input.value = '';
      delete input.dataset.iso;
      return;
    }
    setIsoDataset(input, unix);
    if (window.jQuery && $jq(input).data('datepicker')) {
      $jq(input).persianDatepicker('setDate', unix);
    }
    fireChange(input);
  }

  function getIso(input) {
    if (!input) return null;
    if (input.dataset.iso) return input.dataset.iso;

    const $ = window.jQuery ? $jq(input) : null;
    const state = $ && $.data('datepicker');
    if (state && state.selected && state.selected.unix) {
      const iso = new Date(state.selected.unix).toISOString();
      input.dataset.iso = iso;
      return iso;
    }

    const parsed = parseVisibleValue(input);
    if (parsed) {
      input.dataset.iso = parsed;
      return parsed;
    }
    return null;
  }

  function formatPreview(input) {
    const iso = getIso(input);
    if (!iso) return '';
    return window.AdminAPI
      ? AdminAPI.formatDateTime(iso)
      : new Date(iso).toLocaleString('fa-IR');
  }

  window.AdminDatePicker = {
    ensureDeps,
    init,
    setValue,
    getIso,
    destroy,
    formatPreview,
  };
})();
