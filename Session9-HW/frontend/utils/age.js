import { toPersianDigits } from './digits.js';

export function calculateAge(birthDateStr) {
  const [year, month, day] = birthDateStr.split('-').map(Number);
  const birth = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  birth.setHours(0, 0, 0, 0);

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
}

export function friendlyAgeMessage(name, birthDateStr) {
  const age = calculateAge(birthDateStr);

  if (age === 0) {
    return `${name} کمتر از ۱ سالش است 🎉`;
  }

  return `${name} ${toPersianDigits(age)} ساله است 🎉`;
}

import { friendlyApiError, AGE_LIMIT_MESSAGE } from './errors.js';

export { AGE_LIMIT_MESSAGE };

export function friendlyErrorMessage(err) {
  return friendlyApiError(err);
}
