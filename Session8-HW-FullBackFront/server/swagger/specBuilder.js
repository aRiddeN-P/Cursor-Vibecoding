'use strict';

const baseSpec = require('./swaggerConfig');
const faLocale = require('./locales/fa');
const enLocale = require('./locales/en');
const { localizeOperationEn } = require('./localizeEn');

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function isAdminPath(path) {
  return path.startsWith('/api/admin');
}

function filterPaths(allPaths, scope) {
  const filtered = {};
  for (const [path, item] of Object.entries(allPaths || {})) {
    const admin = isAdminPath(path);
    if (scope === 'admin' && admin) filtered[path] = item;
    if (scope === 'app' && !admin) filtered[path] = item;
  }
  return filtered;
}

function collectTags(paths) {
  const used = new Set();
  for (const methods of Object.values(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method)) continue;
      (op.tags || []).forEach((t) => used.add(t));
    }
  }
  return used;
}

function localizeOperation(method, path, op, locale) {
  if (locale === 'fa') return op;
  return localizeOperationEn(method, path, op);
}

function localizePaths(paths, locale) {
  if (locale === 'fa') return paths;

  const out = {};
  for (const [path, methods] of Object.entries(paths)) {
    out[path] = {};
    for (const [method, op] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method)) {
        out[path][method] = op;
        continue;
      }
      out[path][method] = localizeOperation(method, path, op, locale);
    }
  }
  return out;
}

function buildTags(scope, usedFaTags, locale) {
  const faTags = scope === 'admin' ? faLocale.ADMIN_TAGS : faLocale.APP_TAGS;
  const filtered = faTags.filter((t) => usedFaTags.has(t.name));
  if (locale === 'fa') return filtered;

  const enTags = scope === 'admin' ? enLocale.ADMIN_TAGS : enLocale.APP_TAGS;
  const enByName = new Map(enTags.map((t) => [t.name, t]));
  return filtered.map((faTag) => {
    const enName = enLocale.TAG_MAP[faTag.name] || faTag.name;
    return enByName.get(enName) || { name: enName, description: faTag.description };
  });
}

function buildComponents(locale) {
  const components = JSON.parse(JSON.stringify(baseSpec.components || {}));
  if (locale === 'en' && components.schemas?.ErrorResponse?.properties?.message) {
    components.schemas.ErrorResponse.properties.message.description =
      'Error message returned by the API (always in Persian at runtime)';
    components.schemas.ErrorResponse.properties.message.example = 'Server error';
  }
  if (locale === 'fa' && components.schemas?.ErrorResponse?.properties?.message) {
    components.schemas.ErrorResponse.properties.message.description = 'پیام خطا به زبان فارسی';
    components.schemas.ErrorResponse.properties.message.example = 'خطای سرور';
  }
  return components;
}

/**
 * @param {'fa'|'en'} locale
 * @param {'app'|'admin'} scope
 */
function buildSpec(locale, scope) {
  const localePack = locale === 'en' ? enLocale : faLocale;
  const meta = localePack.META[scope];

  const faPaths = filterPaths(baseSpec.paths, scope);
  const faUsedTags = collectTags(faPaths);
  const tags = buildTags(scope, faUsedTags, locale);
  const paths = localizePaths(faPaths, locale);

  return {
    openapi: baseSpec.openapi || '3.0.3',
    info: {
      title: meta.title,
      description: meta.description,
      version: baseSpec.info?.version || '1.0.0',
      contact: baseSpec.info?.contact || { name: locale === 'en' ? 'Dakhlyar Team' : 'تیم دخلیار' },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: locale === 'en' ? 'Development server' : 'سرور توسعه',
      },
    ],
    tags,
    paths,
    components: buildComponents(locale),
  };
}

module.exports = { buildSpec };
