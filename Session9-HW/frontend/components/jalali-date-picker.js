import { toPersianDigits } from '../utils/digits.js';
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  compareJalaali,
  dateToJalaali,
  formatJalali,
  isoToJalaali,
  jalaaliToDate,
  jalaaliToIso,
  jalaliMonthLength,
  todayJalaali,
} from '../utils/jalali.js';

/**
 * @param {object} options
 * @param {string} [options.id]
 * @param {string} [options.placeholder]
 * @param {Date} [options.maxDate]
 * @param {string|null} [options.value] - gregorian ISO
 * @param {(iso: string|null) => void} [options.onChange]
 */
export function createJalaliDatePicker(options = {}) {
  const {
    id = 'jalali-date',
    placeholder = 'انتخاب تاریخ تولد',
    maxDate = new Date(),
    value = null,
    onChange,
  } = options;

  const maxJalaali = dateToJalaali(maxDate);
  const today = todayJalaali();
  let selectedIso = value;
  let viewJy = today.jy;
  let viewJm = today.jm;
  let panelMode = 'days';
  let yearPageStart = today.jy - 5;
  let isOpen = false;

  const root = document.createElement('div');
  root.className = 'jalali-picker';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'jalali-picker__trigger';
  trigger.id = id;
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');

  const panel = document.createElement('div');
  panel.className = 'jalali-picker__panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'تقویم شمسی');

  root.appendChild(trigger);
  root.appendChild(panel);

  panel.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  function syncViewToSelection() {
    if (!selectedIso) return;
    const j = isoToJalaali(selectedIso);
    viewJy = j.jy;
    viewJm = j.jm;
    yearPageStart = Math.max(viewJy - 5, today.jy - 12);
  }

  function isDisabled(jy, jm, jd) {
    return compareJalaali({ jy, jm, jd }, maxJalaali) > 0;
  }

  function isMonthFullyFuture(jy, jm) {
    return compareJalaali({ jy, jm, jd: 1 }, maxJalaali) > 0;
  }

  function updateTrigger() {
    if (selectedIso) {
      trigger.innerHTML = `<span class="jalali-picker__icon">📅</span><span>${formatJalali(selectedIso, 'long')}</span>`;
      trigger.classList.remove('jalali-picker__trigger--placeholder');
    } else {
      trigger.innerHTML = `<span class="jalali-picker__icon">📅</span><span>${placeholder}</span>`;
      trigger.classList.add('jalali-picker__trigger--placeholder');
    }
  }

  function selectDate(jy, jm, jd) {
    if (isDisabled(jy, jm, jd)) return;
    selectedIso = jalaaliToIso(jy, jm, jd);
    onChange?.(selectedIso);
    close();
    updateTrigger();
  }

  function shiftMonth(delta) {
    viewJm += delta;
    if (viewJm > 12) {
      viewJm = 1;
      viewJy += 1;
    } else if (viewJm < 1) {
      viewJm = 12;
      viewJy -= 1;
    }
    renderPanel();
  }

  function shiftYear(delta) {
    viewJy += delta;
    yearPageStart += delta;
    renderPanel();
  }

  function shiftYearPage(delta) {
    yearPageStart += delta * 12;
    renderPanel();
  }

  function bindNav(prevSel, nextSel, onPrev, onNext) {
    panel.querySelector(prevSel)?.addEventListener('click', (e) => {
      e.preventDefault();
      onPrev();
    });
    panel.querySelector(nextSel)?.addEventListener('click', (e) => {
      e.preventDefault();
      onNext();
    });
  }

  function renderDaysView() {
    const monthLen = jalaliMonthLength(viewJy, viewJm);
    const firstWeekday = (jalaaliToDate(viewJy, viewJm, 1).getDay() + 1) % 7;
    const selectedJ = selectedIso ? isoToJalaali(selectedIso) : null;

    panel.innerHTML = `
      <div class="jalali-picker__header">
        <button type="button" class="jalali-picker__nav" data-nav="prev" aria-label="ماه قبل">‹</button>
        <button type="button" class="jalali-picker__title jalali-picker__title-btn" id="jalali-title">
          ${JALALI_MONTHS[viewJm - 1]} ${toPersianDigits(viewJy)}
        </button>
        <button type="button" class="jalali-picker__nav" data-nav="next" aria-label="ماه بعد">›</button>
      </div>
      <div class="jalali-picker__weekdays">
        ${JALALI_WEEKDAYS.map((d) => `<span class="jalali-picker__weekday">${d}</span>`).join('')}
      </div>
      <div class="jalali-picker__days" id="jalali-days"></div>
      <div class="jalali-picker__footer">
        <button type="button" class="jalali-picker__today-btn" id="jalali-today">امروز</button>
      </div>
    `;

    const daysEl = panel.querySelector('#jalali-days');

    for (let i = 0; i < firstWeekday; i++) {
      const empty = document.createElement('span');
      empty.className = 'jalali-picker__day jalali-picker__day--empty';
      daysEl.appendChild(empty);
    }

    for (let day = 1; day <= monthLen; day++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'jalali-picker__day';
      btn.textContent = toPersianDigits(day);

      if (today.jy === viewJy && today.jm === viewJm && today.jd === day) {
        btn.classList.add('jalali-picker__day--today');
      }
      if (
        selectedJ &&
        selectedJ.jy === viewJy &&
        selectedJ.jm === viewJm &&
        selectedJ.jd === day
      ) {
        btn.classList.add('jalali-picker__day--selected');
      }
      if (isDisabled(viewJy, viewJm, day)) btn.disabled = true;

      btn.addEventListener('click', () => selectDate(viewJy, viewJm, day));
      daysEl.appendChild(btn);
    }

    bindNav('[data-nav="prev"]', '[data-nav="next"]', () => shiftMonth(-1), () => shiftMonth(1));

    panel.querySelector('#jalali-title').addEventListener('click', () => {
      panelMode = 'months';
      yearPageStart = viewJy - 5;
      renderPanel();
    });

    panel.querySelector('#jalali-today').addEventListener('click', () => {
      selectDate(today.jy, today.jm, today.jd);
    });
  }

  function renderMonthsView() {
    panel.innerHTML = `
      <div class="jalali-picker__header">
        <button type="button" class="jalali-picker__nav" data-nav="prev" aria-label="سال قبل">‹</button>
        <button type="button" class="jalali-picker__title jalali-picker__title-btn" id="jalali-year-btn">
          ${toPersianDigits(viewJy)}
        </button>
        <button type="button" class="jalali-picker__nav" data-nav="next" aria-label="سال بعد">›</button>
      </div>
      <p class="jalali-picker__hint">انتخاب ماه</p>
      <div class="jalali-picker__months" id="jalali-months"></div>
      <div class="jalali-picker__footer">
        <button type="button" class="jalali-picker__today-btn" id="jalali-back-days">بازگشت به روزها</button>
      </div>
    `;

    const monthsEl = panel.querySelector('#jalali-months');

    JALALI_MONTHS.forEach((name, index) => {
      const jm = index + 1;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'jalali-picker__month';
      btn.textContent = name;

      if (viewJm === jm) btn.classList.add('jalali-picker__month--selected');
      if (today.jy === viewJy && today.jm === jm) btn.classList.add('jalali-picker__month--today');
      if (isMonthFullyFuture(viewJy, jm)) btn.disabled = true;

      btn.addEventListener('click', () => {
        viewJm = jm;
        panelMode = 'days';
        renderPanel();
      });

      monthsEl.appendChild(btn);
    });

    bindNav('[data-nav="prev"]', '[data-nav="next"]', () => shiftYear(-1), () => shiftYear(1));

    panel.querySelector('#jalali-year-btn').addEventListener('click', () => {
      yearPageStart = viewJy - 5;
      panelMode = 'years';
      renderPanel();
    });

    panel.querySelector('#jalali-back-days').addEventListener('click', () => {
      panelMode = 'days';
      renderPanel();
    });
  }

  function renderYearsView() {
    const years = Array.from({ length: 12 }, (_, i) => yearPageStart + i);

    panel.innerHTML = `
      <div class="jalali-picker__header">
        <button type="button" class="jalali-picker__nav" data-nav="prev" aria-label="سال‌های قبل">‹</button>
        <div class="jalali-picker__title">${toPersianDigits(years[0])} – ${toPersianDigits(years[11])}</div>
        <button type="button" class="jalali-picker__nav" data-nav="next" aria-label="سال‌های بعد">›</button>
      </div>
      <p class="jalali-picker__hint">انتخاب سال</p>
      <div class="jalali-picker__years" id="jalali-years"></div>
      <div class="jalali-picker__footer">
        <button type="button" class="jalali-picker__today-btn" id="jalali-back-months">بازگشت به ماه‌ها</button>
      </div>
    `;

    const yearsEl = panel.querySelector('#jalali-years');

    years.forEach((jy) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'jalali-picker__year';
      btn.textContent = toPersianDigits(jy);

      if (viewJy === jy) btn.classList.add('jalali-picker__year--selected');
      if (today.jy === jy) btn.classList.add('jalali-picker__year--today');
      if (jy > maxJalaali.jy) btn.disabled = true;

      btn.addEventListener('click', () => {
        viewJy = jy;
        panelMode = 'months';
        renderPanel();
      });

      yearsEl.appendChild(btn);
    });

    bindNav('[data-nav="prev"]', '[data-nav="next"]', () => shiftYearPage(-1), () => shiftYearPage(1));

    panel.querySelector('#jalali-back-months').addEventListener('click', () => {
      panelMode = 'months';
      renderPanel();
    });
  }

  function renderPanel() {
    if (panelMode === 'months') renderMonthsView();
    else if (panelMode === 'years') renderYearsView();
    else renderDaysView();
  }

  function open() {
    syncViewToSelection();
    panelMode = 'days';
    isOpen = true;
    panel.hidden = false;
    trigger.classList.add('jalali-picker__trigger--open');
    trigger.setAttribute('aria-expanded', 'true');
    renderPanel();
  }

  function close() {
    isOpen = false;
    panelMode = 'days';
    panel.hidden = true;
    trigger.classList.remove('jalali-picker__trigger--open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', () => {
    if (isOpen) close();
    else open();
  });

  document.addEventListener('click', (e) => {
    if (isOpen && !root.contains(e.target)) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      if (panelMode !== 'days') {
        panelMode = panelMode === 'years' ? 'months' : 'days';
        renderPanel();
      } else {
        close();
      }
    }
  });

  syncViewToSelection();
  updateTrigger();

  return {
    element: root,
    getValue: () => selectedIso,
    setValue: (iso) => {
      selectedIso = iso;
      syncViewToSelection();
      updateTrigger();
    },
    clear: () => {
      selectedIso = null;
      updateTrigger();
      onChange?.(null);
    },
  };
}
