export const AGE_GROUPS = ['0-2', '3-5', '6-7'];

export const AGE_GROUP_LABELS = {
  '0-2': '۰ تا ۲ سال',
  '3-5': '۳ تا ۵ سال',
  '6-7': '۶ تا ۷ سال',
};

export function ageGroupPillsHtml({ selected, name = 'age-group', idPrefix = 'age' } = {}) {
  return `
    <div class="age-group-pills" role="radiogroup" aria-label="گروه سنی">
      ${AGE_GROUPS.map(
        (group) => `
        <button
          type="button"
          class="age-group-pill ${selected === group ? 'age-group-pill--active' : ''}"
          data-age-group="${group}"
          aria-pressed="${selected === group ? 'true' : 'false'}"
        >
          <input
            type="radio"
            name="${name}"
            value="${group}"
            id="${idPrefix}-${group}"
            class="age-group-pill__input"
            ${selected === group ? 'checked' : ''}
            tabindex="-1"
          />
          <span>${AGE_GROUP_LABELS[group]}</span>
        </button>
      `
      ).join('')}
    </div>
  `;
}

export function bindAgeGroupPills(sectionEl, { onChange, initial } = {}) {
  let selected = initial || null;
  const pills = sectionEl.querySelectorAll('.age-group-pill');

  function setSelected(group) {
    if (!AGE_GROUPS.includes(group)) return;
    selected = group;
    pills.forEach((pill) => {
      const isActive = pill.dataset.ageGroup === group;
      pill.classList.toggle('age-group-pill--active', isActive);
      pill.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      const input = pill.querySelector('input');
      if (input) input.checked = isActive;
    });
    onChange?.(group);
  }

  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      setSelected(pill.dataset.ageGroup);
    });
  });

  if (initial) {
    setSelected(initial);
  }

  return {
    get: () => selected,
    set: setSelected,
  };
}
