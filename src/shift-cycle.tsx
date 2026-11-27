import { useId } from "react";
import type { Shift, ShiftCalendar, ShiftDuplicate } from "./api";
import { dateLabel, monthCells, monthLabel } from "./calendar-utils";
import { Notice } from "./ui";

const presets = {
  "2/2": [2, 2],
  "1/1": [1, 1],
} as const;

export type ShiftCycle = {
  mode: "manual" | keyof typeof presets | "custom";
  workdays: string;
  daysOff: string;
};

const options: { mode: ShiftCycle["mode"]; title: string }[] = [
  { mode: "manual", title: "Вручную" },
  { mode: "2/2", title: "2 через 2" },
  { mode: "1/1", title: "1 через 1" },
  { mode: "custom", title: "Свой график" },
];

export const initialShiftCycle: ShiftCycle = {
  mode: "manual",
  workdays: "3",
  daysOff: "1",
};

type CyclePlan = { dates: string[]; error: string };

// UTC midnights let us count calendar days across daylight-saving changes.
function dayNumber(date: string) {
  return Date.parse(date) / 86_400_000;
}

export function planShiftCycle(
  cycle: ShiftCycle,
  sourceDate: string,
  month: string,
): CyclePlan {
  if (cycle.mode === "manual") return { dates: [], error: "" };

  const [work, rest] =
    cycle.mode === "custom"
      ? [cycle.workdays, cycle.daysOff].map((value) =>
          /^\d+$/.test(value) ? Number(value) : NaN,
        )
      : presets[cycle.mode];
  const length = work + rest;
  if (!Number.isSafeInteger(length) || work < 1 || rest < 0)
    return {
      dates: [],
      error: "Укажите целые числа. Минимум один рабочий день и ноль выходных.",
    };

  const source = dayNumber(sourceDate);
  const dates = monthCells(month).filter((date): date is string => {
    if (!date || date === sourceDate) return false;
    const offset = (dayNumber(date) - source) % length;
    return (offset < 0 ? offset + length : offset) < work;
  });
  return {
    dates,
    error: dates.length
      ? ""
      : "В этом месяце нет дат для копирования по выбранному циклу.",
  };
}

function slotKey(shift: Shift) {
  const [start, end] = [shift.start_time, shift.end_time].map((time) =>
    time.length === 5 ? `${time}:00` : time,
  );
  return `${shift.employee_id}/${start}/${end}`;
}

export function planMonthlyCopies(
  dates: string[],
  sources: Shift[],
  calendar: ShiftCalendar,
) {
  const copies = new Map<string, Shift[]>();
  const batches = new Map<string, ShiftDuplicate>();
  let count = 0;
  for (const date of dates) {
    const seen = new Set((calendar[date] ?? []).map(slotKey));
    const missing = sources.filter((source) => {
      const key = slotKey(source);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    copies.set(date, missing);
    count += missing.length;
    if (!missing.length) continue;

    // The existing API copies every requested shift onto every requested date.
    const shiftIds = missing.map(({ id }) => id);
    const group = shiftIds.join(",");
    const batch = batches.get(group);
    if (batch) batch.dates.push(date);
    else batches.set(group, { shift_ids: shiftIds, dates: [date] });
  }
  return { copies, batches: Array.from(batches.values()), count };
}

export function ShiftCycleEditor({
  value,
  plan,
  sourceDate,
  month,
  onChange,
}: {
  value: ShiftCycle;
  plan: CyclePlan;
  sourceDate: string;
  month: string;
  onChange: (value: ShiftCycle) => void;
}) {
  const group = useId();
  const repeating = value.mode !== "manual";
  const modeTitle =
    value.mode === "custom"
      ? plan.error
        ? "Свой график"
        : `${value.workdays}/${value.daysOff}`
      : value.mode;

  return (
    <details className="calendar-extra shift-cycle">
      <summary>
        Автозаполнение
        {repeating && ` · ${modeTitle}`}
      </summary>
      <div className="shift-cycle-panel">
        <fieldset className="shift-cycle-patterns">
          <legend className="sr-only">График</legend>
          {options.map(({ mode, title }) => (
            <label key={mode}>
              <input
                className="sr-only"
                type="radio"
                name={group}
                checked={value.mode === mode}
                onChange={() => onChange({ ...value, mode })}
              />
              <span>{title}</span>
            </label>
          ))}
        </fieldset>
        {repeating && (
          <>
            <p className="hint">
              На весь {monthLabel(month)} · исходный день {dateLabel(sourceDate)}
            </p>
            {value.mode === "custom" && (
              <div className="shift-cycle-fields">
                <label className="field">
                  <span>Рабочих дней подряд</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={value.workdays}
                    onChange={(event) =>
                      onChange({ ...value, workdays: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Выходных подряд</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={value.daysOff}
                    onChange={(event) =>
                      onChange({ ...value, daysOff: event.target.value })
                    }
                  />
                </label>
              </div>
            )}
            <Notice text={plan.error} error />
            {!!plan.dates.length && (
              <details className="shift-cycle-preview">
                <summary>Даты копирования · {plan.dates.length}</summary>
                <ul className="shift-cycle-dates" aria-label="Даты по графику">
                  {plan.dates.map((date) => (
                    <li key={date}>
                      <time dateTime={date}>{dateLabel(date)}</time>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </details>
  );
}
