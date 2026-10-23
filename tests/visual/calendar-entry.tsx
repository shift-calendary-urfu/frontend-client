// Isolated visual fixtures. Production entry points never import this file.
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { App } from "../../src/App";
import { api, type Employee, type Shift } from "../../src/api";
import { calendarFixture } from "../fixtures/calendar";

const fixture = calendarFixture();
const screen = location.hash.slice(1) || "calendar";
const NativeDate = Date;
window.Date = new Proxy(NativeDate, {
  construct: (target, args) =>
    Reflect.construct(target, args.length ? args : ["2025-01-28T12:00:00"]),
});
document.documentElement.style.setProperty("--calendar-safe-top", "44px");
document.documentElement.style.setProperty("--calendar-safe-bottom", "34px");
const nativeInsets = document.createElement("style");
nativeInsets.textContent = ".bottom-nav{padding-bottom:34px}";
document.head.append(nativeInsets);
fixture.state.points = [
  {
    ...fixture.state.points[0],
    work_start_time: "10:00",
    work_end_time: "16:00",
  },
];
fixture.state.employees = ["Никита", "Дима", "Паша"].map(
  (name, index) =>
    ({
      id: 101 + index,
      user_id: 21 + index,
      workplace_id: 11,
      role: "employee",
      is_active: true,
      user: {
        id: 21 + index,
        first_name: name,
        second_name: "Тестовый",
        phone: `+7999000000${index}`,
      },
    }) as Employee,
);
fixture.state.shifts = [];
let nextId = 501;
const patterns: Record<number, number[]> = {
  1: [0, 1],
  10: [0, 1, 2],
  15: [0, 1, 2],
  16: [0, 1, 2],
  17: [1, 2],
  21: [0, 1, 2],
  22: [0, 1, 2],
};
if (screen !== "calendar") patterns[28] = [0, 1, 2];
for (const [day, people] of Object.entries(patterns)) {
  for (const person of people) {
    const employee = fixture.state.employees[person];
    const times = [
      ["10:00", "17:00"],
      ["09:00", "23:30"],
      ["17:00", "23:30"],
    ][person];
    fixture.state.shifts.push({
      id: nextId++,
      workplace_id: 11,
      employee_id: employee.id,
      date: `2025-01-${day.padStart(2, "0")}`,
      start_time: times[0],
      end_time: times[1],
      notes: null,
      first_name: employee.user.first_name,
      second_name: employee.user.second_name,
      third_name: null,
    } as Shift);
  }
}
const editShift = fixture.state.shifts.find(
  (shift) => shift.date === "2025-01-28" && shift.employee_id === 101,
);
const routes: Record<string, string> = {
  calendar: "/calendar?workplace=11&month=2025-01",
  day: "/calendar/2025-01-28?workplace=11",
  add: "/calendar/2025-01-28/shift/add?workplace=11",
  edit: `/calendar/2025-01-28/shift/${editShift?.id}/edit?workplace=11`,
  copy: "/calendar/2025-01-28/duplicate?workplace=11",
};
window.fetch = async (input, init) => {
  const result = fixture.respond(
    String(input),
    init?.method,
    typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
  );
  return new Response(JSON.stringify(result.json), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
};
await api.login("visual@example.test", "VisualFixture123");
createRoot(document.getElementById("root")!).render(
  <MemoryRouter initialEntries={[routes[screen] || routes.calendar]}>
    <App />
  </MemoryRouter>,
);
