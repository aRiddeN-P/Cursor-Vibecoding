'use strict';

const responsePhrases = require('./locales/responsePhrases.en');
const schemaPhrases = require('./locales/schemaPhrases.en');
const examplePhrases = require('./locales/examplePhrases.en');
const opDescriptions = require('./locales/opDescriptions.en');
const operationsEn = require('./locales/operations.en');
const { TAG_MAP } = require('./locales/en');

const phrases = { ...responsePhrases, ...schemaPhrases, ...examplePhrases };

function translateString(text) {
  if (typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!/[\u0600-\u06FF]/.test(trimmed)) return trimmed;
  return phrases[trimmed] || trimmed;
}

function localizeNode(node) {
  if (node == null) return node;
  if (typeof node === 'string') return translateString(node);
  if (Array.isArray(node)) return node.map((item) => localizeNode(item));
  if (typeof node === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'description' || key === 'summary') {
        out[key] = typeof value === 'string' ? translateString(value) : localizeNode(value);
      } else if (key === 'example' && typeof value === 'string' && /[\u0600-\u06FF]/.test(value)) {
        out[key] = translateString(value);
      } else {
        out[key] = localizeNode(value);
      }
    }
    return out;
  }
  return node;
}

function localizeOperationEn(method, path, op) {
  const key = `${method.toUpperCase()} ${path}`;
  const tr = operationsEn[key] || {};
  const next = localizeNode(JSON.parse(JSON.stringify(op)));

  if (tr.summary) next.summary = tr.summary;
  if (opDescriptions[key]) {
    next.description = opDescriptions[key];
  } else if (tr.description) {
    next.description = tr.description;
  }
  if (op.tags) next.tags = op.tags.map((t) => TAG_MAP[t] || t);

  return next;
}

module.exports = { translateString, localizeOperationEn, localizeNode };
