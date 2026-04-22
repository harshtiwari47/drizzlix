function pad2(value) {
  return String(value).padStart(2, '0');
}

function toStartOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatDateKeyLocal(date = new Date()) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

export function parseDateKeyLocal(dateKey) {
  if (typeof dateKey !== 'string') return null;

  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime())
    || parsed.getFullYear() !== year
    || parsed.getMonth() + 1 !== month
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function getTodayDateKeyLocal() {
  return formatDateKeyLocal(new Date());
}

export function addDaysToDateKeyLocal(days, fromDate = new Date()) {
  const shift = Number(days || 0);
  const base = toStartOfLocalDay(fromDate);
  base.setDate(base.getDate() + shift);
  return formatDateKeyLocal(base);
}

export function isDateKeyOnOrBefore(dateKey, referenceDate = new Date()) {
  const parsed = parseDateKeyLocal(dateKey);
  if (!parsed) return false;

  const referenceStart = toStartOfLocalDay(referenceDate);
  return parsed.getTime() <= referenceStart.getTime();
}

export function getWeekdayLabelFromDateKey(dateKey, locale = 'en-US') {
  const parsed = parseDateKeyLocal(dateKey);
  if (!parsed) return '';
  return parsed.toLocaleDateString(locale, { weekday: 'short' });
}

export function getDayMonthLabelFromDateKey(dateKey, locale = 'en-US') {
  const parsed = parseDateKeyLocal(dateKey);
  if (!parsed) return '';
  return parsed.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}
