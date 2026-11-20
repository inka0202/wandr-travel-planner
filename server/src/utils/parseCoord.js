import { ApiError } from './ApiError.js';

// Plain decimal only: no empty string (Number('') === 0), no whitespace,
// no hex/exponent/Infinity forms that Number() would also accept.
const DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/**
 * Parse a query-string coordinate and check its bounds.
 * Throws ApiError 400 `Invalid <label>` without echoing the input.
 */
export const parseCoord = (val, label, min, max) => {
  if (typeof val !== 'string' || !DECIMAL.test(val)) {
    throw new ApiError(400, `Invalid ${label}`, 'INVALID_COORD');
  }
  const num = Number(val);
  if (num < min || num > max) {
    throw new ApiError(400, `Invalid ${label}`, 'INVALID_COORD');
  }
  return num;
};
