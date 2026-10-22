/**
 * Keystroke filters for form fields: characters that can never be valid are dropped as the user
 * types, so letters cannot even appear in the field. The API still validates every value.
 */

/** Digits, spaces, dashes and parentheses; "+" only as the first character. Max 20 characters. */
export function sanitizePhone(value: string): string {
  const cleaned = value.replace(/[^\d+\s\-()]/g, '');
  const plus = cleaned.trimStart().startsWith('+') ? '+' : '';
  return (plus + cleaned.replace(/\+/g, '').trimStart()).slice(0, 20);
}

/** Digits and a single decimal separator ("." or ","), at most 2 decimal places. */
export function sanitizeMoney(value: string): string {
  const cleaned = value.replace(/[^\d.,]/g, '').replace(/,/g, '.');
  const [integer = '', ...rest] = cleaned.split('.');
  if (rest.length === 0) return integer.slice(0, 10);
  return `${integer.slice(0, 10)}.${rest.join('').slice(0, 2)}`;
}
