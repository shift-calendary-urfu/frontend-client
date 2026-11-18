import type { CalendarReport } from "../../src/api";
import { calendarFixture } from "./calendar";

export const octoberReport: CalendarReport = {
  workplace_id: 11,
  period: "2026-10",
  total_hours: 21.5,
  total_shifts: 3,
  employees: [
    {
      employee_id: 101,
      full_name: "Петров Пётр",
      hours_worked: 21.5,
      full_shifts_count: 1,
      full_shifts_hours: 12,
    },
    {
      employee_id: 102,
      full_name: "Смирнова Анна",
      hours_worked: 0,
      full_shifts_count: 0,
      full_shifts_hours: 0,
    },
  ],
};
export const excelMediaType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function reportFixture() {
  const calendar = calendarFixture();
  const reports: Record<string, CalendarReport> = {
    "11-2026-10": structuredClone(octoberReport),
  };
  function respond(
    url: string,
    method = "GET",
    body?: Record<string, unknown>,
  ) {
    const parsed = new URL(url, "http://test");
    if (parsed.pathname.endsWith("/shifts/reports/calendar")) {
      const workplace = Number(parsed.searchParams.get("workplace_id"));
      const month = Number(parsed.searchParams.get("month"));
      const year = Number(parsed.searchParams.get("year"));
      const period = `${year}-${String(month).padStart(2, "0")}`;
      if (!workplace || month < 1 || month > 12 || year < 2000 || year > 2100)
        throw new Error("Invalid report parameters");
      return {
        status: 200,
        json: reports[`${workplace}-${period}`] || {
          workplace_id: workplace,
          period,
          total_hours: 0,
          total_shifts: 0,
          employees: [],
        },
      };
    }
    return calendar.respond(url, method, body);
  }
  return { ...calendar, reports, respond };
}
