import { expect, test } from "vitest";
import {
  initialShiftCycle,
  planMonthlyCopies,
  planShiftCycle,
} from "../src/shift-cycle";
import { shift } from "./fixtures/calendar";

test("2/2 заполняет весь февраль, включая 29-е, и исключает исходный день", () => {
  const cycle = { ...initialShiftCycle, mode: "2/2" as const };
  const plan = planShiftCycle(cycle, "2028-02-28", "2028-02");

  expect(plan.error).toBe("");
  expect(plan.dates).toEqual([
    "2028-02-01",
    "2028-02-04",
    "2028-02-05",
    "2028-02-08",
    "2028-02-09",
    "2028-02-12",
    "2028-02-13",
    "2028-02-16",
    "2028-02-17",
    "2028-02-20",
    "2028-02-21",
    "2028-02-24",
    "2028-02-25",
    "2028-02-29",
  ]);
  expect(
    planShiftCycle(cycle, "2028-02-28", "2028-03").dates.slice(0, 4),
  ).toEqual(["2028-03-03", "2028-03-04", "2028-03-07", "2028-03-08"]);
});

test("1/1 сохраняет шаг при переходе на летнее время", () => {
  const cycle = { ...initialShiftCycle, mode: "1/1" as const };
  const march = planShiftCycle(cycle, "2026-03-27", "2026-03");
  expect(march.dates).toHaveLength(15);
  expect(march.dates.slice(-4)).toEqual([
    "2026-03-23",
    "2026-03-25",
    "2026-03-29",
    "2026-03-31",
  ]);
  expect(planShiftCycle(cycle, "2026-03-27", "2026-04").dates[0]).toBe(
    "2026-04-02",
  );
});

test("3/1 даёт три рабочих дня подряд и позволяет настроить число выходных", () => {
  const cycle = { ...initialShiftCycle, mode: "custom" as const };
  const plan = planShiftCycle(cycle, "2026-10-23", "2026-10");
  expect(plan.dates).toHaveLength(22);
  expect(plan.dates.slice(-5)).toEqual([
    "2026-10-25",
    "2026-10-27",
    "2026-10-28",
    "2026-10-29",
    "2026-10-31",
  ]);
  expect(
    planShiftCycle({ ...cycle, daysOff: "0" }, "2026-10-23", "2026-10").dates,
  ).toHaveLength(30);
  expect(
    planShiftCycle({ ...cycle, workdays: "2.5" }, "2026-10-23", "2026-10")
      .error,
  ).toBeTruthy();
  expect(
    planShiftCycle(
      { ...cycle, workdays: "1", daysOff: "60" },
      "2026-10-23",
      "2026-10",
    ).error,
  ).toMatch(/нет дат/);
});

test("копирование группирует одинаковые наборы смен на даты и пропускает совпадения", () => {
  const second = { ...shift, id: 302, employee_id: 102 };
  const dates = ["2026-11-01", "2026-11-02", "2026-11-03"];
  const firstCopy = { ...shift, id: 345, start_time: "09:00" };
  const plan = planMonthlyCopies(dates, [shift, second], {
    [dates[0]]: [{ ...firstCopy, date: dates[0] }],
    [dates[2]]: [{ ...firstCopy, date: dates[2] }],
  });

  expect(plan.count).toBe(4);
  expect(plan.batches).toEqual([
    { shift_ids: [302], dates: [dates[0], dates[2]] },
    { shift_ids: [301, 302], dates: [dates[1]] },
  ]);
});
