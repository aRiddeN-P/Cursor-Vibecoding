'use strict';

/**
 * Normalize Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII 0-9.
 */
function normalizeDigits(value) {
  if (value == null) return '';
  return String(value)
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .trim();
}

module.exports = { normalizeDigits };
