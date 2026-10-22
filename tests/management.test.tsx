import React from "react";
import { beforeEach, afterEach, test, expect, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  within,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../src/App";
import { api, logout, type Workplace, type Employee } from "../src/api";
const me = {
  id: 1,
  first_name: "Иван",
  second_name: "Иванов",
  third_name: null,
  email: "ivan@example.com",
  phone: "+79991234567",
  is_active: true,
};
const first: Workplace = {
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
const second: Workplace = {
  ...first,
  id: 12,
  owner_id: 2,
  name: "Центральная",
  workplace_type: "wildberries",
};
const employee: Employee = {
  id: 101,
  user_id: 5,
  workplace_id: 11,
  role: "admin",
  position: "Менеджер",
  hire_date: "2026-10-16",
  is_active: true,
  user: {
    id: 5,
    first_name: "Пётр",
    second_name: "Петров",
    third_name: null,
    phone: "+79995553322",
  },
};
const fetchMock = vi.fn();
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
let points: Workplace[];
let employees: Record<number, Employee[]>;
beforeEach(async () => {
  logout();
  points = [{ ...first }, { ...second }];
  employees = { 11: [employee], 12: [] };
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
    if (url === "/backend/users/me") return reply(me);
    if (url === "/backend/workplaces/") {
      if (init.method === "GET") return reply(points);
      if (init.method === "POST") {
        const p = { ...JSON.parse(init.body as string), id: 13, owner_id: 1 };
        points.push(p);
        employees[13] = [];
        return reply(p, 201);
      }
    }
    const match = /^\/backend\/workplaces\/(\d+)(\/employees)?$/.exec(url);
    if (match) {
      const id = Number(match[1]),
        p = points.find((p) => p.id === id);
      if (!p) return reply({ detail: "Workplace not found" }, 404);
      if (match[2]) return reply(employees[id] || []);
      if (init.method === "PUT") {
        Object.assign(p, JSON.parse(init.body as string));
        return reply(p);
      }
      if (init.method === "DELETE") {
        points = points.filter((p) => p.id !== id);
        return reply({ detail: "Workplace deleted successfully" });
      }
      return reply({ ...p, employees: employees[id] || [] });
    }
    throw new Error(`Unexpected endpoint ${url}`);
  });
  await api.login(me.email, "Password123");
  fetchMock.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function start(path = "/workplaces") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return userEvent.setup();
}
const writes = () =>
  fetchMock.mock.calls.filter(([, init]) =>
    ["POST", "PUT", "DELETE"].includes(init.method),
  );

test("ПВЗ и сотрудники доступны из меню; календарь и чаты отключены", async () => {
  const user = start("/settings");
  await screen.findByDisplayValue("Иван");
  const nav = screen.getByRole("navigation");
  await user.click(within(nav).getByRole("link", { name: "ПВЗ", exact: true }));
  await screen.findByRole("link", { name: /^Открыть ПВЗ Машинная/ });
  expect(
    within(nav)
      .getByRole("link", { name: "ПВЗ", exact: true })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(
    (
      within(nav).getByRole("button", {
        name: "Календарь",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    (within(nav).getByRole("button", { name: "Чаты" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await user.click(within(nav).getByRole("link", { name: "Сотрудники" }));
  await screen.findByText("Петров Пётр");
});
test("кнопки редактирования есть только у владельца, просмотр содержит данные и сотрудников", async () => {
  const user = start();
  await screen.findByRole("link", { name: /^Открыть ПВЗ Машинная/ });
  expect(
    screen.getByRole("link", { name: "Редактировать ПВЗ Машинная" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("link", { name: "Редактировать ПВЗ Центральная" }),
  ).toBeNull();
  await user.click(screen.getByRole("link", { name: /^Открыть ПВЗ Машинная/ }));
  await screen.findByRole("heading", { name: "Машинная" });
  await screen.findByText("Петров Пётр");
  expect(screen.getByText("Администратор")).toBeTruthy();
  expect(screen.getByText("Работает с 16.10.2026")).toBeTruthy();
});
test("пустой список предлагает создать точку", async () => {
  points = [];
  start();
  await screen.findByText("У вас пока нет ПВЗ");
  expect(screen.queryByRole("alert")).toBeNull();
});
test("создание отправляет правильный JSON без owner_id и пустые optional как null", async () => {
  const user = start("/workplaces/new");
  await user.type(screen.getByLabelText("Название ПВЗ"), "  Новая точка  ");
  await user.type(screen.getByLabelText("Адрес"), "  Мира, 10  ");
  await user.click(screen.getByLabelText("Wildberries"));
  await user.click(
    screen.getByRole("button", { name: "Сохранить", exact: true }),
  );
  await screen.findByText("ПВЗ создан.");
  await screen.findByRole("link", {
    name: "Открыть ПВЗ Новая точка: Мира, 10",
  });
  expect(writes()).toHaveLength(1);
  expect(writes()[0][0]).toBe("/backend/workplaces/");
  expect(JSON.parse(writes()[0][1].body)).toEqual({
    name: "Новая точка",
    address: "Мира, 10",
    phone: null,
    description: null,
    workplace_type: "wildberries",
    work_start_time: "09:00",
    work_end_time: "21:00",
  });
});
test("равные и обратные часы работы не отправляются", async () => {
  const user = start("/workplaces/new");
  await user.type(screen.getByLabelText("Название ПВЗ"), "Точка");
  await user.type(screen.getByLabelText("Адрес"), "Мира, 10");
  await user.clear(screen.getByLabelText("Конец работы"));
  await user.type(screen.getByLabelText("Конец работы"), "09:00");
  await user.click(
    screen.getByRole("button", { name: "Сохранить", exact: true }),
  );
  expect(screen.getByRole("alert").textContent).toContain("позже");
  expect(writes()).toHaveLength(0);
});
test("редактирование заполняет форму и отправляет PUT с обоими временами", async () => {
  const user = start("/workplaces/11/edit");
  await screen.findByDisplayValue("Машинная");
  await user.clear(screen.getByLabelText("Название ПВЗ"));
  await user.type(screen.getByLabelText("Название ПВЗ"), "Новое имя");
  await user.click(
    screen.getByRole("button", { name: "Сохранить", exact: true }),
  );
  await screen.findByText("Изменения ПВЗ сохранены.");
  expect(writes()[0][0]).toBe("/backend/workplaces/11");
  expect(writes()[0][1].method).toBe("PUT");
  const data = JSON.parse(writes()[0][1].body);
  expect(data.work_start_time).toBe("09:00");
  expect(data.work_end_time).toBe("21:00");
  expect(points[0].name).toBe("Новое имя");
});
test("прямой URL редактирования чужой точки не открывает форму", async () => {
  start("/workplaces/12/edit");
  await screen.findByText("Изменять эту точку может только её владелец.");
  expect(
    screen.queryByRole("button", { name: "Сохранить", exact: true }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Удалить ПВЗ", exact: true }),
  ).toBeNull();
  expect(writes()).toHaveLength(0);
});
test("удаление требует подтверждения, отмена и Escape не делают запрос", async () => {
  const user = start("/workplaces/11/edit");
  await screen.findByDisplayValue("Машинная");
  const remove = screen.getByRole("button", {
    name: "Удалить ПВЗ",
    exact: true,
  });
  await user.click(remove);
  await screen.findByRole("alertdialog");
  await user.click(screen.getByRole("button", { name: "Оставить" }));
  expect(writes()).toHaveLength(0);
  await user.click(remove);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(writes()).toHaveLength(0);
  await user.click(remove);
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Удалить",
      exact: true,
    }),
  );
  await screen.findByText("ПВЗ удалён.");
  expect(writes()).toHaveLength(1);
  expect(writes()[0][1].method).toBe("DELETE");
  expect(screen.queryByText("Машинная")).toBeNull();
});
test("сотрудники загружаются только выбранного ПВЗ; записи по employee API не вызываются", async () => {
  const user = start("/employees?workplace=11");
  await screen.findByText("Петров Пётр");
  await user.selectOptions(screen.getByLabelText("Рабочая точка"), "12");
  await screen.findByText("Сотрудников пока нет");
  expect(screen.queryByText("Петров Пётр")).toBeNull();
  expect(
    fetchMock.mock.calls.some(
      ([url]) => url === "/backend/workplaces/12/employees",
    ),
  ).toBe(true);
  expect(
    fetchMock.mock.calls.some(([url]) => url.startsWith("/backend/employees")),
  ).toBe(false);
});
test("просроченный ответ от предыдущего ПВЗ не заменяет текущий список", async () => {
  let resolve!: (value: Response) => void;
  const original = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((url, init) =>
    url === "/backend/workplaces/11/employees"
      ? new Promise<Response>((r) => {
          resolve = r;
        })
      : original(url, init),
  );
  const user = start("/employees?workplace=11");
  await screen.findByRole("combobox");
  await waitFor(() => expect(resolve).toBeTypeOf("function"));
  await user.selectOptions(screen.getByLabelText("Рабочая точка"), "12");
  await screen.findByText("Сотрудников пока нет");
  await act(async () => resolve(reply([employee])));
  expect(screen.queryByText("Петров Пётр")).toBeNull();
});
test("недоступная точка в query не запрашивает чужих сотрудников", async () => {
  start("/employees?workplace=999");
  await screen.findByText("Эта точка недоступна. Выберите ПВЗ из списка.");
  expect(fetchMock.mock.calls.some(([url]) => url.includes("/999"))).toBe(
    false,
  );
});
test("ошибка списка показывает повтор, а ошибка записи сохраняет введённые данные", async () => {
  const original = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((url, init) =>
    url === "/backend/workplaces/" && init.method === "GET"
      ? Promise.resolve(reply({}, 500))
      : original(url, init),
  );
  const user = start();
  await screen.findByRole("alert");
  expect(screen.queryByText("У вас пока нет ПВЗ")).toBeNull();
  fetchMock.mockImplementation(original);
  await user.click(
    screen.getByRole("button", { name: "Повторить", exact: true }),
  );
  await screen.findByRole("link", { name: /^Открыть ПВЗ Машинная/ });
  await user.click(screen.getByRole("link", { name: "Добавить ПВЗ" }));
  await user.type(screen.getByLabelText("Название ПВЗ"), "Не терять");
  await user.type(screen.getByLabelText("Адрес"), "Мира, 10");
  fetchMock.mockImplementation((url, init) =>
    init.method === "POST"
      ? Promise.resolve(reply({}, 500))
      : original(url, init),
  );
  await user.click(
    screen.getByRole("button", { name: "Сохранить", exact: true }),
  );
  await screen.findByRole("alert");
  expect(
    (screen.getByLabelText("Название ПВЗ") as HTMLInputElement).value,
  ).toBe("Не терять");
});
test("неверный ID не отправляет запрос, прямой маршрут требует сессию", async () => {
  start("/workplaces/not-a-number");
  expect(screen.getByRole("heading", { name: "ПВЗ не найден" })).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
  cleanup();
  logout();
  start("/employees");
  expect(screen.getByRole("heading").textContent).toContain("Войдите");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("раскрываемые дополнительные поля ПВЗ сохраняются через API", async () => {
  const user = start("/workplaces/11/edit");
  await screen.findByDisplayValue("Машинная");
  await user.click(screen.getByText("Дополнительно", { exact: true }));
  await user.type(screen.getByLabelText("Контактный телефон"), "81234567890");
  await user.type(screen.getByLabelText("Описание"), "Вход со двора");
  await user.click(
    screen.getByRole("button", { name: "Сохранить", exact: true }),
  );
  await screen.findByText("Изменения ПВЗ сохранены.");
  const body = JSON.parse(writes()[0][1].body);
  expect(body.phone).toBe("81234567890");
  expect(body.description).toBe("Вход со двора");
});
