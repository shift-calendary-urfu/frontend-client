import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../src/App";
import {
  api,
  logout,
  type Employee,
  type Profile,
  type Workplace,
} from "../src/api";

const owner: Profile = {
  id: 1,
  first_name: "Иван",
  second_name: "Иванов",
  third_name: null,
  email: "ivan@example.com",
  phone: "+79991234567",
  is_active: true,
};
const point: Workplace = {
  id: 11,
  owner_id: 1,
  name: "Машинная",
  address: "Машинная, 31Д",
  phone: null,
  description: null,
  workplace_type: "ozon",
  work_start_time: "09:00",
  work_end_time: "21:00",
};
const manager: Employee = {
  id: 101,
  user_id: 5,
  workplace_id: 11,
  role: "admin",
  position: "Менеджер",
  hire_date: "2026-10-20",
  is_active: true,
  user: {
    id: 5,
    first_name: "Пётр",
    second_name: "Петров",
    third_name: null,
    phone: "+79995553322",
  },
};
const other: Employee = {
  ...manager,
  id: 102,
  user_id: 6,
  role: "employee",
  position: null,
  user: {
    id: 6,
    first_name: "Анна",
    second_name: "Смирнова",
    phone: "+79995553333",
  },
};
const newcomer = {
  id: 7,
  first_name: "Дарья",
  second_name: "Соколова",
  phone: "89995550077",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const fetchMock = vi.fn();
let current: Profile;
let points: Workplace[];
let employees: Employee[];
let createFailure: { status: number; detail: string } | undefined;
let updateFailure: number | undefined;
const writes = () =>
  fetchMock.mock.calls.filter(([, init]) =>
    ["POST", "PUT", "DELETE"].includes(init.method),
  );
beforeEach(async () => {
  logout();
  current = { ...owner };
  points = [{ ...point }, { ...point, id: 12, name: "Центральная" }];
  employees = structuredClone([
    manager,
    other,
    {
      ...other,
      id: 103,
      is_active: false,
      user: { ...other.user, second_name: "Удалённая" },
    },
  ]);
  createFailure = undefined;
  updateFailure = undefined;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    if (url === "/backend/auth/login")
      return reply({
        access_token: "access",
        refresh_token: "refresh",
        token_type: "Bearer",
      });
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer access",
    );
    if (url === "/backend/users/me") return reply(current);
    if (url === "/backend/workplaces/")
      return reply(
        points.filter(
          (p) =>
            p.owner_id === current.id ||
            employees.some(
              (e) =>
                e.workplace_id === p.id &&
                e.user_id === current.id &&
                e.is_active,
            ),
        ),
      );
    const p = /^\/backend\/workplaces\/(\d+)(\/employees)?$/.exec(url);
    if (p) {
      const item = points.find((item) => item.id === Number(p[1]));
      if (!item) return reply({ detail: "Workplace not found" }, 404);
      const list = employees.filter(
        (e) => e.workplace_id === item.id && e.is_active,
      );
      return reply(p[2] ? list : { ...item, employees: list });
    }
    const path = new URL(url, "http://test");
    const match = /^\/backend\/employees\/(\d+)?$/.exec(path.pathname);
    if (match) {
      expect(path.searchParams.get("workplace_id")).toMatch(/^\d+$/);
      const workplaceId = Number(path.searchParams.get("workplace_id"));
      if (init.method === "POST") {
        if (createFailure)
          return reply({ detail: createFailure.detail }, createFailure.status);
        const data = JSON.parse(init.body as string);
        const user = [manager.user, other.user, newcomer].find(
          (user) => user.phone === data.phone,
        );
        if (!user)
          return reply(
            { detail: "User with this phone number not found" },
            404,
          );
        const existing = employees.find(
          (e) => e.workplace_id === workplaceId && e.user_id === user.id,
        );
        if (existing?.is_active)
          return reply(
            { detail: "Employee already exists in this workplace" },
            409,
          );
        const created: Employee = {
          id: existing?.id || 104,
          user_id: user.id,
          workplace_id: workplaceId,
          user,
          role: data.role,
          position: data.position,
          hire_date: "2026-10-21",
          is_active: true,
        };
        if (existing) Object.assign(existing, created);
        else employees.push(created);
        return reply(created, 201);
      }
      const employee = employees.find(
        (e) =>
          e.id === Number(match[1]) &&
          e.workplace_id === workplaceId &&
          e.is_active,
      );
      if (!employee) return reply({ detail: "Employee not found" }, 404);
      if (init.method === "PUT") {
        if (updateFailure)
          return reply(
            {
              detail:
                updateFailure === 404 ? "Employee not found" : "Forbidden",
            },
            updateFailure,
          );
        Object.assign(employee, JSON.parse(init.body as string));
      }
      if (init.method === "DELETE") {
        employee.is_active = false;
        return reply({ message: "Employee deactivated successfully" });
      }
      return reply(employee);
    }
    throw new Error(`Unexpected endpoint ${url}`);
  });
  await api.login(current.email, "Password123");
  fetchMock.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function start(path = "/employees?workplace=11") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return userEvent.setup();
}
function asManager(role: Employee["role"] = "admin", active = true) {
  current = { ...owner, ...manager.user, third_name: null };
  employees[0].role = role;
  employees[0].is_active = active;
}
async function openCreate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("link", {
      name: "Добавить сотрудника",
      exact: true,
    }),
  );
  await screen.findByLabelText("Телефон");
}

test.each(["/employees?workplace=11", "/workplaces/11"])(
  "все активные сотрудники доступны на %s",
  async (path) => {
    start(path);
    const list = await screen.findByRole("list", {
      name: "Список сотрудников",
    });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("Петров Пётр")).toBeTruthy();
    expect(within(list).getByText("Смирнова Анна")).toBeTruthy();
    expect(screen.queryByText("Удалённая Анна")).toBeNull();
  },
);
test.each(["/employees?workplace=11", "/workplaces/11"])(
  "создание из %s возвращает в обновлённый список и отправляет точный JSON",
  async (path) => {
    const user = start(path);
    await openCreate(user);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByLabelText("Имя и фамилия")).toBeNull();
    await user.type(screen.getByLabelText("Телефон"), newcomer.phone);
    await user.type(
      screen.getByLabelText("Должность (необязательно)"),
      "  Кассир  ",
    );
    await user.click(
      screen.getByRole("radio", { name: "Администратор", exact: true }),
    );
    await user.click(
      screen.getByRole("button", { name: "Создать", exact: true }),
    );
    await screen.findByText("Сотрудник добавлен.");
    await screen.findByText("Соколова Дарья");
    expect(writes()).toHaveLength(1);
    expect(writes()[0][0]).toBe("/backend/employees/?workplace_id=11");
    expect(JSON.parse(writes()[0][1].body)).toEqual({
      phone: newcomer.phone,
      role: "admin",
      position: "Кассир",
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      path.startsWith("/employees") ? "Сотрудники" : "Машинная",
    );
  },
);
test.each(["/employees?workplace=11", "/workplaces/11", "/workplaces/11/edit"])(
  "редактирование из %s меняет только роль и должность",
  async (path) => {
    const user = start(path);
    await user.click(
      await screen.findByRole("link", {
        name: "Редактировать сотрудника Петров Пётр",
      }),
    );
    const name = await screen.findByRole("textbox", { name: "Имя и фамилия" });
    expect(name.textContent).toBe("Петров Пётр");
    expect(name.getAttribute("aria-readonly")).toBe("true");
    expect(screen.getByRole("textbox", { name: "Телефон" }).getAttribute("aria-readonly")).toBe("true");
    expect(screen.getByText("Работает с 20.10.2026")).toBeTruthy();
    await user.clear(screen.getByLabelText("Должность (необязательно)"));
    await user.click(
      screen.getByRole("radio", { name: "Сотрудник", exact: true }),
    );
    await user.click(
      screen.getByRole("button", { name: "Сохранить", exact: true }),
    );
    if (path.endsWith("/edit")) await screen.findByDisplayValue("Машинная");
    else await screen.findByText("Изменения сотрудника сохранены.");
    await screen.findByText("Петров Пётр");
    expect(writes()).toHaveLength(1);
    expect(writes()[0][0]).toBe("/backend/employees/101?workplace_id=11");
    expect(writes()[0][1].method).toBe("PUT");
    expect(JSON.parse(writes()[0][1].body)).toEqual({
      role: "employee",
      position: null,
    });
    expect(screen.queryByText("Менеджер")).toBeNull();
  },
);
test.each(["/employees?workplace=11", "/workplaces/11"])(
  "удаление из %s требует подтверждения и обновляет список",
  async (path) => {
    const user = start(path);
    await user.click(
      await screen.findByRole("link", {
        name: "Редактировать сотрудника Петров Пётр",
      }),
    );
    const remove = await screen.findByRole("button", {
      name: "Удалить сотрудника",
      exact: true,
    });
    await user.click(remove);
    expect(screen.getByRole("alertdialog").textContent).toContain(
      "Его аккаунт сохранится",
    );
    const keep = screen.getByRole("button", { name: "Оставить", exact: true });
    const confirmButton = within(screen.getByRole("alertdialog")).getByRole(
      "button",
      { name: "Удалить", exact: true },
    );
    expect(document.activeElement).toBe(keep);
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(confirmButton);
    await user.keyboard("{Tab}");
    expect(document.activeElement).toBe(keep);
    await user.click(
      screen.getByRole("button", { name: "Оставить", exact: true }),
    );
    expect(document.activeElement).toBe(remove);
    await user.click(remove);
    await user.keyboard("{Escape}");
    expect(writes()).toHaveLength(0);
    await user.click(remove);
    const original = fetchMock.getMockImplementation()!;
    let release!: () => void;
    fetchMock.mockImplementation(async (url, init) => {
      const response = await original(url, init);
      return init.method === "DELETE"
        ? new Promise<Response>((resolve) => {
            release = () => resolve(response);
          })
        : response;
    });
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Удалить",
        exact: true,
      }),
    );
    const dialog = screen.getByRole("alertdialog");
    await waitFor(() => expect(dialog.getAttribute("aria-busy")).toBe("true"));
    const heading = within(dialog).getByRole("heading");
    expect(document.activeElement).toBe(heading);
    await user.keyboard("{Escape}{Tab}");
    expect(screen.getByRole("alertdialog")).toBe(dialog);
    expect(document.activeElement).toBe(heading);
    await act(async () => release());
    await screen.findByText("Сотрудник удалён из ПВЗ.");
    await screen.findByText("Смирнова Анна");
    expect(screen.queryByText("Петров Пётр")).toBeNull();
    expect(writes()).toHaveLength(1);
    expect(writes()[0][0]).toBe("/backend/employees/101?workplace_id=11");
    expect(writes()[0][1].method).toBe("DELETE");
  },
);
test("администратор управляет сотрудниками, но не редактирует ПВЗ", async () => {
  asManager();
  start("/workplaces/11");
  expect(
    await screen.findByRole("link", { name: "Добавить сотрудника" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", {
      name: "Редактировать сотрудника Смирнова Анна",
    }),
  ).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Редактировать ПВЗ" })).toBeNull();
});
test.each(["employee", "owner"] as const)(
  "роль записи %s без владения ПВЗ не даёт права управления",
  async (role) => {
    asManager(role);
    start();
    await screen.findByText("Смирнова Анна");
    expect(
      screen.queryByRole("link", { name: "Добавить сотрудника" }),
    ).toBeNull();
    expect(
      screen.queryByRole("link", { name: /^Редактировать сотрудника/ }),
    ).toBeNull();
    cleanup();
    start("/workplaces/11/employees/102/edit");
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Сохранить" })).toBeNull();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        url.startsWith("/backend/employees/"),
      ),
    ).toBe(false);
  },
);
test("неактивный администратор не получает форму по прямой ссылке", async () => {
  asManager("admin", false);
  start("/workplaces/11/employees/new");
  await screen.findByText(
    "Управлять сотрудниками может только владелец или администратор этого ПВЗ.",
  );
  expect(screen.queryByLabelText("Телефон")).toBeNull();
  expect(writes()).toHaveLength(0);
});
test.each([
  [
    404,
    "User with this phone number not found",
    "Сначала сотруднику нужно зарегистрироваться",
  ],
  [409, "Employee already exists in this workplace", "уже добавлен"],
  [500, "Internal Server Error", "Сервер временно недоступен"],
] as const)(
  "ошибка создания %i сохраняет ввод и позволяет повторить",
  async (status, detail, text) => {
    createFailure = { status, detail };
    const user = start("/workplaces/11/employees/new");
    await user.type(await screen.findByLabelText("Телефон"), newcomer.phone);
    await user.click(
      screen.getByRole("button", { name: "Создать", exact: true }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(text);
    expect((screen.getByLabelText("Телефон") as HTMLInputElement).value).toBe(
      newcomer.phone,
    );
    createFailure = undefined;
    await user.click(
      screen.getByRole("button", { name: "Создать", exact: true }),
    );
    await screen.findByText("Соколова Дарья");
  },
);
test("удалённого сотрудника можно добавить заново, активный дубликат получает 409", async () => {
  employees[0].is_active = false;
  const user = start("/workplaces/11/employees/new");
  await user.type(await screen.findByLabelText("Телефон"), manager.user.phone);
  await user.click(
    screen.getByRole("button", { name: "Создать", exact: true }),
  );
  await screen.findByText("Петров Пётр");
  expect(employees.filter((e) => e.user_id === manager.user_id)).toHaveLength(
    1,
  );
  expect(employees[0].id).toBe(101);
  await openCreate(user);
  await user.type(screen.getByLabelText("Телефон"), manager.user.phone);
  await user.click(
    screen.getByRole("button", { name: "Создать", exact: true }),
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "уже добавлен",
  );
});
test.each([403, 404])(
  "утрата доступа или удаление во время редактирования (%i) блокирует повторную запись",
  async (status) => {
    updateFailure = status;
    const user = start("/workplaces/11/employees/101/edit");
    await screen.findByLabelText("Имя и фамилия");
    await user.click(
      screen.getByRole("button", { name: "Сохранить", exact: true }),
    );
    await screen.findByRole("alert");
    expect(
      screen
        .getByRole("button", { name: "Сохранить", exact: true })
        .matches(":disabled"),
    ).toBe(true);
    expect(writes()).toHaveLength(1);
  },
);
test("снявший с себя роль администратор возвращается к списку без кнопок управления", async () => {
  asManager();
  const user = start("/workplaces/11/employees/101/edit");
  await screen.findByLabelText("Имя и фамилия");
  await user.click(
    screen.getByRole("radio", { name: "Сотрудник", exact: true }),
  );
  await user.click(
    screen.getByRole("button", { name: "Сохранить", exact: true }),
  );
  await screen.findByText("Петров Пётр");
  expect(
    screen.queryByRole("link", { name: "Добавить сотрудника" }),
  ).toBeNull();
  expect(
    screen.queryByRole("link", { name: /^Редактировать сотрудника/ }),
  ).toBeNull();
});
test("удаливший себя администратор не остаётся в недоступной точке", async () => {
  asManager();
  const user = start("/workplaces/11/employees/101/edit?from=workplace");
  await user.click(
    await screen.findByRole("button", {
      name: "Удалить сотрудника",
      exact: true,
    }),
  );
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Удалить",
      exact: true,
    }),
  );
  await screen.findByText("Нет доступных ПВЗ");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "Сотрудники",
  );
});
test("неверный телефон не отправляется, ожидание записи блокирует повтор и переход назад", async () => {
  const original = fetchMock.getMockImplementation()!;
  let resolve!: (response: Response) => void;
  fetchMock.mockImplementation((url, init) =>
    init.method === "POST"
      ? new Promise<Response>((r) => {
          resolve = r;
        })
      : original(url, init),
  );
  const user = start("/workplaces/11/employees/new");
  const phone = await screen.findByLabelText("Телефон");
  await user.type(phone, "123");
  fireEvent.submit(phone.closest("form")!);
  await screen.findByRole("alert");
  expect(writes()).toHaveLength(0);
  await user.clear(phone);
  await user.type(phone, newcomer.phone);
  await user.click(
    screen.getByRole("button", { name: "Создать", exact: true }),
  );
  await waitFor(() => expect(resolve).toBeTypeOf("function"));
  expect(phone.matches(":disabled")).toBe(true);
  fireEvent.submit(phone.closest("form")!);
  await user.click(screen.getByRole("link", { name: "Назад" }));
  expect(writes()).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "Добавить сотрудника",
  );
  await act(async () => resolve(reply({ ...manager, id: 104 }, 201)));
  await screen.findByText("Сотрудник добавлен.");
});
test.each(["0", "-1", "NaN", "9007199254740992"])(
  "неверный employee_id %s не вызывает API",
  async (id) => {
    start(`/workplaces/11/employees/${id}/edit`);
    expect(screen.getByRole("heading").textContent).toBe("Сотрудник не найден");
    expect(fetchMock).not.toHaveBeenCalled();
  },
);
test("сотрудник другой точки не открывает форму; from не принимает внешний адрес", async () => {
  const user = start(
    "/workplaces/12/employees/101/edit?from=https://example.com",
  );
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("Имя и фамилия")).toBeNull();
  await user.click(screen.getByRole("link", { name: "Назад" }));
  await screen.findByText("Сотрудников пока нет");
  expect(
    screen.getByRole("button", { name: /Рабочая точка: Центральная/ }),
  ).toBeTruthy();
});
