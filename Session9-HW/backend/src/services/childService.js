const AGE_LIMIT_MESSAGE = 'این اپ برای کودکان ۰ تا ۷ سال طراحی شده';

function parseBirthDate(birthDate) {
  if (!birthDate || typeof birthDate !== 'string') return null;

  const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function calculateAge(birthDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

function deriveAgeGroup(age) {
  if (age <= 2) return '0-2';
  if (age <= 5) return '3-5';
  return '6-7';
}

function validateChildInput(name, birthDateStr) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  if (!trimmedName) {
    return { error: 'لطفاً نام فرزند را وارد کنید', status: 400 };
  }

  const birthDate = parseBirthDate(birthDateStr);
  if (!birthDate) {
    return { error: 'تاریخ تولد معتبر نیست', status: 400 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  birthDate.setHours(0, 0, 0, 0);

  if (birthDate > today) {
    return { error: 'تاریخ تولد نمی‌تواند در آینده باشد', status: 400 };
  }

  const age = calculateAge(birthDate);

  if (age < 0 || age > 7) {
    return { error: AGE_LIMIT_MESSAGE, status: 400 };
  }

  return {
    name: trimmedName,
    birthDate: birthDateStr,
    age,
    ageGroup: deriveAgeGroup(age),
  };
}

module.exports = {
  AGE_LIMIT_MESSAGE,
  calculateAge,
  deriveAgeGroup,
  validateChildInput,
};
