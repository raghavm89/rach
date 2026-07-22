'use strict';

/**
 * Integer money helpers.
 *
 * Everything here operates on the currency's MINOR unit (paise, cents) as a
 * JavaScript integer. No floats, anywhere. The audit found `0.15 * 7 * 100`
 * producing 104.99999999999999 and being sent to Razorpay as an order amount;
 * this module exists so that cannot happen again.
 *
 * Tax rates are basis points: 1800 bps = 18.00%.
 */

const MINOR_UNITS = {
  // Currencies with 2 decimal places cover everything Rachbase sells in today.
  DEFAULT: 2,
  JPY: 0,
  KRW: 0,
};

function minorUnitExponent(currency) {
  return MINOR_UNITS[String(currency || '').toUpperCase()] ?? MINOR_UNITS.DEFAULT;
}

/** Assert a value is a safe integer, with a useful message. */
function assertInt(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer in minor units, received: ${value}`);
  }
  return value;
}

/**
 * Apply a basis-point rate to a minor-unit amount.
 * Rounds half away from zero, which is the convention both Indian GST and US
 * sales tax use, and avoids the banker's-rounding surprise of toFixed().
 */
function applyRateBps(amountMinor, rateBps) {
  assertInt(amountMinor, 'amountMinor');
  assertInt(rateBps, 'rateBps');
  if (rateBps === 0) return 0;

  const product = amountMinor * rateBps;
  const sign = product < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(product) / 10000);
}

/**
 * Split a total tax amount into components (e.g. CGST/SGST) without losing or
 * inventing a minor unit. The remainder from integer division goes to the first
 * component, so the parts always sum exactly to the whole.
 */
function splitTax(totalMinor, parts) {
  assertInt(totalMinor, 'totalMinor');
  if (!parts.length) return [];

  const base = Math.floor(Math.abs(totalMinor) / parts.length);
  const sign = totalMinor < 0 ? -1 : 1;
  const out = parts.map((p) => ({ ...p, amount_minor: sign * base }));

  const distributed = base * parts.length;
  const remainder = Math.abs(totalMinor) - distributed;
  if (remainder > 0) out[0].amount_minor += sign * remainder;

  return out;
}

/** Convert a decimal major-unit string/number to minor units safely. */
function toMinor(major, currency = 'USD') {
  const exp = minorUnitExponent(currency);
  // Parse via string to avoid 0.15 * 100 = 15.000000000000002
  const str = typeof major === 'string' ? major.trim() : String(major);
  if (!/^-?\d+(\.\d+)?$/.test(str)) {
    throw new TypeError(`Cannot convert "${major}" to minor units`);
  }
  const negative = str.startsWith('-');
  const [whole, frac = ''] = str.replace('-', '').split('.');
  const padded = (frac + '0'.repeat(exp)).slice(0, exp);
  const value = Number(whole) * 10 ** exp + Number(padded || '0');
  return negative ? -value : value;
}

/** Format minor units for display. */
function formatMinor(amountMinor, currency = 'USD', locale = 'en-US') {
  const exp = minorUnitExponent(currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  }).format(amountMinor / 10 ** exp);
}

/** 1800 → "18%", 250 → "2.5%" */
function formatRateBps(rateBps) {
  const pct = rateBps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/\.?0+$/, '')}%`;
}

module.exports = {
  assertInt,
  applyRateBps,
  splitTax,
  toMinor,
  formatMinor,
  formatRateBps,
  minorUnitExponent,
};
