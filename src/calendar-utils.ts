// Calendar dates are local civil dates, never UTC timestamps.
export function dateString(date: Date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return dateString(date) === value ? date : null;
}
export function validMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value) && !!parseDate(`${value}-01`);
}
export function monthBounds(month: string) {
  const first = parseDate(`${month}-01`);
  if (!first) throw new Error("Некорректный месяц.");
  const last = new Date(first);
  last.setMonth(last.getMonth() + 1, 0);
  return { from: dateString(first), to: dateString(last) };
}
export function moveMonth(month: string, delta: number) {
  const date = parseDate(`${month}-01`);
  if (!date) return null;
  date.setMonth(date.getMonth() + delta);
  return date.getFullYear() >= 1 && date.getFullYear() <= 9999
    ? dateString(date).slice(0, 7)
    : null;
}
export function monthCells(month: string) {
  const { from, to } = monthBounds(month);
  const offset = (parseDate(from)!.getDay() + 6) % 7;
  const count = Number(to.slice(-2));
  return Array.from(
    { length: Math.ceil((offset + count) / 7) * 7 },
    (_, index) => {
      const day = index - offset + 1;
      return day > 0 && day <= count
        ? `${month}-${String(day).padStart(2, "0")}`
        : null;
    },
  );
}
export function dateLabel(value: string) {
  return (
    parseDate(value)?.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }) || value
  );
}
export function monthLabel(value: string) {
  return parseDate(`${value}-01`)!.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}
export function timeLabel(value: string) {
  return value.slice(0, 5);
}
export function validateTimes(start: string, end: string) {
  const time = /^(?:[01]\d|2[0-3]):(?:00|30)$/;
  if (!time.test(start) || !time.test(end))
    return "Укажите время с шагом 30 минут: например, 09:00 или 09:30.";
  if (end <= start)
    return "Конец смены должен быть позже начала. Ночные смены текущий API не поддерживает.";
  return "";
}
export function shiftName(shift: {
  second_name: string;
  first_name: string;
  third_name?: string | null;
}) {
  return [shift.second_name, shift.first_name, shift.third_name]
    .filter(Boolean)
    .join(" ");
}
export function calendarPath(workplace: number, month: string) {
  return `/calendar?workplace=${workplace}&month=${month}`;
}
export function dayPath(workplace: number, date: string) {
  return `/calendar/${date}?workplace=${workplace}`;
}
export function timeMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
export function timelineRange(
  shifts: { start_time: string; end_time: string }[],
) {
  return {
    from: Math.min(
      7 * 60,
      ...shifts.map(
        (shift) => Math.floor(timeMinutes(shift.start_time) / 60) * 60,
      ),
    ),
    to: Math.max(
      24 * 60,
      ...shifts.map(
        (shift) => Math.ceil(timeMinutes(shift.end_time) / 60) * 60,
      ),
    ),
  };
}
