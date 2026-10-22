/**
 * Display helpers. Money strings from the API are formatted by string manipulation only,
 * so no value ever passes through floating-point arithmetic in the browser.
 */
export function formatMoney(value: string): string {
  const [integer = '0', fraction = '00'] = value.split('.');
  const negative = integer.startsWith('-');
  const digits = negative ? integer.slice(1) : integer;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${negative ? '-' : ''}${grouped}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}

/** "2026-03-15" -> "15 Mar 2026" without timezone shifts (the value is a calendar date). */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** "2026-03" -> "March 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's date in the user's local timezone as YYYY-MM-DD. */
export function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The current month in the user's local timezone as YYYY-MM. */
export function currentMonth(): string {
  return todayIsoDate().slice(0, 7);
}

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
