const toIsoDate = (date) => date.toISOString().slice(0, 10);
const addCalendarDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const nextMonday = (date) => addCalendarDays(date, (8 - date.getDay()) % 7);
const easterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
};
const holidayCache = new Map();
const holidays = (year) => {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const dates = new Set();
  const fixed = (month, day) => dates.add(toIsoDate(new Date(year, month - 1, day)));
  const moved = (month, day) => dates.add(toIsoDate(nextMonday(new Date(year, month - 1, day))));
  [[1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25]].forEach(([month, day]) => fixed(month, day));
  [[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]].forEach(([month, day]) => moved(month, day));
  const easter = easterDate(year);
  [-3, -2, 43, 64, 71].forEach((offset) => dates.add(toIsoDate(addCalendarDays(easter, offset))));
  holidayCache.set(year, dates);
  return dates;
};
const isColombiaBusinessDay = (date) => date.getDay() >= 1 && date.getDay() <= 5 && !holidays(date.getFullYear()).has(toIsoDate(date));
const addColombiaBusinessDays = (value, days) => {
  const raw = String(value || '').slice(0, 10);
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error('Fecha base inválida.');
  let pending = Math.max(0, Math.trunc(Number(days) || 0));
  while (pending > 0) {
    date.setDate(date.getDate() + 1);
    if (isColombiaBusinessDay(date)) pending -= 1;
  }
  return toIsoDate(date);
};

module.exports = { addColombiaBusinessDays, isColombiaBusinessDay };
