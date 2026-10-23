import type { Employee, Profile, Shift, Workplace } from "../../src/api";

export const owner: Profile = {
  id: 1,
  first_name: "Иван",
  second_name: "Иванов",
  third_name: null,
  email: "ivan@example.com",
  phone: "+79991234567",
  is_active: true,
};
export const point: Workplace = {
  id: 11,
  owner_id: 1,
  name: "Машинная",
  address: "Машинная, 31Д",
  phone: null,
  description: null,
  workplace_type: "ozon",
  work_start_time: "09:00:00",
  work_end_time: "21:00:00",
};
export const employee: Employee = {
  id: 101,
  user_id: 5,
  workplace_id: 11,
  role: "admin",
  position: "Менеджер",
  is_active: true,
  user: {
    id: 5,
    first_name: "Пётр",
    second_name: "Петров",
    phone: "+79995553322",
  },
};
export const shift: Shift = {
  id: 301,
  workplace_id: 11,
  employee_id: 101,
  date: "2026-10-23",
  start_time: "09:00:00",
  end_time: "15:30:00",
  notes: "Открыть ПВЗ",
  first_name: "Пётр",
  second_name: "Петров",
  third_name: null,
};
export const tokens = {
  access_token: "access",
  refresh_token: "refresh",
  token_type: "Bearer",
};

// A stateful HTTP fixture shared by component and browser tests, never by the app.
export function calendarFixture() {
  const state = {
    me: structuredClone(owner),
    points: [structuredClone(point), { ...point, id: 12, name: "Центральная" }],
    employees: [
      structuredClone(employee),
      {
        ...employee,
        id: 102,
        user_id: 6,
        role: "employee" as const,
        user: {
          id: 6,
          first_name: "Анна",
          second_name: "Смирнова",
          phone: "+79995553333",
        },
      },
      {
        ...employee,
        id: 103,
        is_active: false,
        user: { ...employee.user, second_name: "Удалённая" },
      },
    ],
    shifts: [
      structuredClone(shift),
      {
        ...shift,
        id: 302,
        employee_id: 102,
        first_name: "Анна",
        second_name: "Смирнова",
        start_time: "15:30:00",
        end_time: "21:00:00",
        notes: null,
      },
    ],
  };
  let nextId = 400;
  function respond(raw: string, method = "GET", body?: Record<string, any>) {
    const url = new URL(raw, "http://test");
    const path = url.pathname.replace(/^\/backend/, "");
    const response = (json: unknown, status = 200) => ({ json, status });
    if (path === "/auth/login" || path === "/auth/refresh-token")
      return response(tokens);
    if (path === "/users/me") return response(state.me);
    if (path === "/workplaces/") return response(state.points);
    const detail = /^\/workplaces\/(\d+)(\/employees)?$/.exec(path);
    if (detail) {
      const item = state.points.find((item) => item.id === Number(detail[1]));
      if (!item) return response({ detail: "Workplace not found" }, 404);
      const employees = state.employees.filter(
        (employee) => employee.workplace_id === item.id && employee.is_active,
      );
      return response(detail[2] ? employees : { ...item, employees });
    }
    if (path.startsWith("/shifts/")) {
      const id = Number(url.searchParams.get("workplace_id"));
      if (!id) throw new Error("A shift request must specify workplace_id");
      const writable =
        state.points.some((p) => p.id === id && p.owner_id === state.me.id) ||
        state.employees.some(
          (e) =>
            e.workplace_id === id &&
            e.user_id === state.me.id &&
            e.is_active &&
            e.role === "admin",
        );
      if (method !== "GET" && !writable)
        return response({ detail: "Forbidden" }, 403);
      if (path === "/shifts/calendar/") {
        const from = url.searchParams.get("date_from"),
          to = url.searchParams.get("date_to");
        if (!from || !to)
          throw new Error(
            "A calendar request must specify date_from and date_to",
          );
        const found = state.shifts.filter(
          (s) => s.workplace_id === id && s.date >= from && s.date <= to,
        );
        if (!found.length)
          return response(
            {
              detail: `Shifts not found or not active between ${from} and ${to}`,
            },
            404,
          );
        const groups: Record<string, Shift[]> = {};
        for (const s of found) (groups[s.date] ||= []).push(s);
        return response(groups);
      }
      if (path === "/shifts/duplicate/" && method === "POST") {
        const sources = state.shifts.filter(
          (s) => s.workplace_id === id && body!.shift_ids.includes(s.id),
        );
        if (sources.length !== body!.shift_ids.length)
          return response(
            { detail: "Shifts not found or not active: [999]" },
            404,
          );
        const copies: Shift[] = body!.dates.flatMap((date: string) =>
          sources.map((s) => ({ ...s, id: nextId++, date })),
        );
        state.shifts.push(...copies);
        return response({
          count_duplicated_shifts_created: copies.length,
          workplace_id: id,
          period: { start_date: body!.dates[0], end_date: body!.dates.at(-1) },
          message: "Смены успешно скопированы",
        });
      }
      if (path === "/shifts/") {
        if (method === "POST") {
          const person = state.employees.find(
            (e) =>
              e.id === body!.employee_id &&
              e.workplace_id === id &&
              e.is_active,
          );
          if (!person)
            return response(
              { detail: "Employee not found or not active" },
              404,
            );
          const created = {
            ...body!,
            id: nextId++,
            workplace_id: id,
            first_name: person.user.first_name,
            second_name: person.user.second_name,
            third_name: null,
          } as Shift;
          state.shifts.push(created);
          return response(created, 201);
        }
        const date = url.searchParams.get("date");
        if (!date) throw new Error("A day request must specify date");
        const found = state.shifts.filter(
          (s) => s.workplace_id === id && s.date === date,
        );
        if (method === "DELETE") {
          state.shifts = state.shifts.filter(
            (s) => s.workplace_id !== id || s.date !== date,
          );
          return response({ message: "Смены успешно удалены" });
        }
        return found.length
          ? response(found)
          : response({ detail: "Shifts not found or not active" }, 404);
      }
      const match = /^\/shifts\/(\d+)$/.exec(path);
      if (match) {
        const s = state.shifts.find(
          (s) => s.id === Number(match[1]) && s.workplace_id === id,
        );
        if (!s)
          return response({ detail: "Shift not found or not active" }, 404);
        if (method === "PUT") Object.assign(s, body);
        if (method === "DELETE") {
          state.shifts = state.shifts.filter((item) => item.id !== s.id);
          return response({ message: "Смена успешно удалена" });
        }
        return response(s);
      }
    }
    throw new Error(`Unexpected endpoint: ${method} ${path}`);
  }
  return { state, respond };
}
