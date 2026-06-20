export const DAILY_LIMIT_MESSAGE =
  'امروز ۵ قصه تازه ساختی! فردا دوباره می‌تونیم قصه جدید بسازیم 🌙 — تا اون موقع می‌تونی از کتابخونه قصه‌ها لذت ببری';

export const AGE_LIMIT_MESSAGE = 'این اپ برای کودکان ۰ تا ۷ سال طراحی شده';

const OFFLINE_MESSAGE =
  'به نظر می‌رسه اینترنت قطعه — وقتی وصل شدی دوباره امتحان کن. 🌙';

const API_KEY_MESSAGE =
  'تنظیمات سرویس هنوز کامل نیست — لطفاً کمی بعد دوباره امتحان کنید. ✨';

const GEMINI_QUOTA_MESSAGE =
  'الان ظرفیت ساخت قصه پر شده — فردا دوباره می‌تونیم قصه تازه بسازیم. 🌙';

export const GEMINI_SERVICE_UNAVAILABLE_MESSAGE =
  'سرویس قصه تعاملی الان در دسترس نیست — کمی بعد دوباره امتحان کن. 🌙';

export const GEMINI_RATE_LIMIT_MESSAGE =
  'الان سرویس قصه‌گویی شلوغه — چند دقیقه دیگه دوباره امتحان کن. 🌙';

export const GEMINI_DAILY_LIMIT_MESSAGE =
  'امروز ظرفیت سرویس قصه‌گویی پر شده — فردا دوباره می‌تونیم قصه تعاملی بسازیم. 🌙';

const ELEVENLABS_QUOTA_MESSAGE =
  'الان ظرفیت ساخت صدا پر شده — کمی بعد دوباره امتحان کن یا از صدای پیش‌فرض استفاده کن. 🎙';

const GENERIC_MESSAGE = 'مشکلی پیش اومد — یک بار دیگه امتحان کن. 🌙';

function hasPersian(text) {
  return /[\u0600-\u06FF]/.test(text || '');
}

function rawMessage(err) {
  return [err?.data?.message, err?.message, err?.reason].filter(Boolean).join(' ');
}

function isNetworkError(err) {
  if (!navigator.onLine) return true;
  if (err?.code === 'network') return true;
  const msg = rawMessage(err).toLowerCase();
  return (
    err?.name === 'TypeError' &&
    (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed'))
  );
}

function isApiKeyError(err) {
  const msg = rawMessage(err).toLowerCase();
  return (
    err?.code === 'api_key' ||
    msg.includes('api key') ||
    msg.includes('not configured') ||
    msg.includes('invalid api key')
  );
}

function isQuotaError(err) {
  const msg = rawMessage(err).toLowerCase();
  return (
    err?.status === 429 ||
    err?.code === 'daily_limit' ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('exceeded') ||
    msg.includes('too many requests')
  );
}

function isElevenLabsError(err) {
  return /elevenlabs/i.test(rawMessage(err));
}

function isGeminiError(err) {
  return /gemini/i.test(rawMessage(err));
}

export function friendlyApiError(err) {
  if (!err) return GENERIC_MESSAGE;

  const backendMsg = err?.data?.message || err?.message || '';

  if (err?.code === 'service_unavailable' || err?.code === 'gemini_unavailable') {
    return backendMsg || GEMINI_SERVICE_UNAVAILABLE_MESSAGE;
  }

  if (err?.code === 'gemini_rate_limit') {
    return backendMsg || GEMINI_RATE_LIMIT_MESSAGE;
  }

  if (err?.code === 'gemini_daily_limit') {
    return backendMsg || GEMINI_DAILY_LIMIT_MESSAGE;
  }

  if (backendMsg === DAILY_LIMIT_MESSAGE || err?.status === 429 || err?.code === 'daily_limit') {
    return DAILY_LIMIT_MESSAGE;
  }

  if (backendMsg === AGE_LIMIT_MESSAGE) {
    return 'لالایی برای بچه‌های ۰ تا ۷ ساله طراحی شده — وقتی بزرگ‌تر شد دوباره سر بزن! 🌙';
  }

  if (backendMsg.includes('تاریخ تولد')) {
    return 'لطفاً یک تاریخ تولد درست انتخاب کنید.';
  }

  if (backendMsg.includes('نام')) {
    return 'اسم کوچولوت رو بنویس تا بشناسیمش! ✨';
  }

  if (hasPersian(backendMsg) && !backendMsg.includes('API') && !backendMsg.includes('Error')) {
    return backendMsg;
  }

  if (isNetworkError(err)) return OFFLINE_MESSAGE;
  if (isApiKeyError(err)) return API_KEY_MESSAGE;

  if (isQuotaError(err)) {
    if (isElevenLabsError(err)) return ELEVENLABS_QUOTA_MESSAGE;
    if (isGeminiError(err)) return GEMINI_QUOTA_MESSAGE;
    return GEMINI_QUOTA_MESSAGE;
  }

  if (isElevenLabsError(err)) return ELEVENLABS_QUOTA_MESSAGE;
  if (isGeminiError(err)) return GEMINI_QUOTA_MESSAGE;

  return GENERIC_MESSAGE;
}

export function interactiveErrorTitle(code) {
  switch (code) {
    case 'api_key':
    case 'service_unavailable':
    case 'gemini_unavailable':
      return 'سرویس در دسترس نیست';
    case 'gemini_rate_limit':
    case 'gemini_daily_limit':
    case 'daily_limit':
      return 'ظرفیت سرویس پر شده';
    default:
      return 'قصه تعاملی شروع نشد';
  }
}
