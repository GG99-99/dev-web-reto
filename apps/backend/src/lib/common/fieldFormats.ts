/** Dominican cédula: 000-0000000-0. */
export function isValidNationalId(value: string): boolean {
  return /^\d{3}-\d{7}-\d$/.test(value.trim());
}

/** Company RNC is 9 digits. */
export function isValidRnc(value: string): boolean {
  return /^\d{9}$/.test(value.trim());
}

/** Empty is allowed. A provided street number is digits only, up to 6. */
export function isValidStreetNumber(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || /^\d{1,6}$/.test(trimmed);
}

function isNanp(digits: string): boolean {
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits);
}

/**
 * Accepts a 10-digit national number (for example 809-555-0101 or (809) 555-0101)
 * and international numbers that include +.
 */
export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return false;
  if (trimmed.includes('+')) return /^[1-9]\d{7,14}$/.test(digits);
  if (digits.length === 11 && digits.startsWith('1')) return isNanp(digits.slice(1));
  if (digits.length === 10) return isNanp(digits);
  return false;
}
