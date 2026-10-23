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
import { api, logout } from "../src/api";
import { calendarFixture, employee, shift } from "./fixtures/calendar";
import {
  dateString,
  monthBounds,
  monthCells,
  moveMonth,
  parseDate,
  validMonth,
  validateTimes,
  timelineRange,
  timeMinutes,
} from "../src/calendar-utils";

let fixture: ReturnType<typeof calendarFixture>;
const fetchMock = vi.fn();
const reply = (json: unknown, status = 200) =>
  new Response(JSON.stringify(json), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const writes = () =>
  fetchMock.mock.calls.filter(([, init]) =>
    ["POST", "PUT", "DELETE"].includes(init.method),
  );
beforeEach(async () => {
  logout();
  fixture = calendarFixture();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    if (!url.endsWith("/auth/login"))
      expect((init.headers as Record<string, string>).Authorization).toBe(
        "Bearer access",
      );
    const { json, status } = fixture.respond(
      url,
      init.method,
      typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    );
    return reply(json, status);
  });
  await api.login(fixture.state.me.email, "Password123");
  fetchMock.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function start(path = "/calendar?workplace=11&month=2026-10") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return userEvent.setup();
}
function asEmployee(role: "admin" | "employee" | "owner", active = true) {
  fixture.state.me = {
    ...fixture.state.me,
    ...employee.user,
    third_name: null,
  };
  fixture.state.employees[0].role = role;
  fixture.state.employees[0].is_active = active;
}
const sourceDay = "/calendar/2026-10-23?workplace=11";

test("месяц собирается по API и открывает день с правильной точкой", async () => {
  const user = start();
  const day = await screen.findByRole("link", {
    name: /23 октября 2026.*смен: 2/,
  });
  expect(
    fetchMock.mock.calls.some(
      ([url]) =>
        url ===
        "/backend/shifts/calendar/?workplace_id=11&date_from=2026-10-01&date_to=2026-10-31",
    ),
  ).toBe(true);
  expect(
    within(screen.getByRole("navigation"))
      .getByRole("link", { name: "Календарь" })
      .getAttribute("aria-current"),
  ).toBe("page");
  await user.click(day);
  expect(
    await screen.findByRole("link", {
      name: "Редактировать смену Петров Пётр 09:00–15:30",
    }),
  ).toBeTruthy();
  expect(
    fetchMock.mock.calls.some(
      ([url]) => url === "/backend/shifts/?workplace_id=11&date=2026-10-23",
    ),
  ).toBe(true);
});
test("календарь открывается из карточки ПВЗ", async () => {
  const user = start("/workplaces/11");
  await user.click(
    await screen.findByRole("link", { name: "Открыть календарь смен" }),
  );
  await screen.findByRole("heading", { name: "Календарь смен" });
  expect(
    (screen.getByLabelText("Рабочая точка") as HTMLSelectElement).value,
  ).toBe("11");
});
test("адрес календаря с завершающим слешем выбирает доступную точку", async () => {
  start("/calendar/?month=2026-10");
  expect(
    await screen.findByRole("link", { name: /^23 октября 2026.*смен: 2/ }),
  ).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});
test("права администратора одной точки не переносятся в другую", async () => {
  asEmployee("admin");
  fixture.state.points[1].owner_id = 99;
  const user = start();
  await screen.findByRole("group", { name: "Дни месяца" });
  await user.selectOptions(screen.getByLabelText("Рабочая точка"), "12");
  const day = await screen.findByRole("link", {
    name: /^23 октября 2026.*смен нет/,
  });
  await user.click(day);
  await screen.findByText("На этот день смен нет");
  expect(
    screen.queryByRole("link", { name: "Добавить сотрудника в расписание" }),
  ).toBeNull();
  expect(
    fetchMock.mock.calls.some(
      ([url]) => url === "/backend/shifts/?workplace_id=12&date=2026-10-23",
    ),
  ).toBe(true);
});
test("404 пустого месяца и дня становятся пустыми состояниями", async () => {
  const user = start("/calendar?workplace=11&month=2026-11");
  await screen.findByText(/В этом месяце смен пока нет/);
  expect(screen.queryByRole("alert")).toBeNull();
  await user.click(
    screen.getByRole("link", { name: /^1 ноября 2026.*смен нет/ }),
  );
  await screen.findByText("На этот день смен нет");
  expect(
    screen.getByRole("link", { name: "Добавить сотрудника в расписание" }),
  ).toBeTruthy();
});
test("404 неизвестного эндпоинта не маскируется пустым календарём", async () => {
  const original = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((url, init) =>
    url.includes("/shifts/calendar/")
      ? Promise.resolve(reply({ detail: "Not Found" }, 404))
      : original(url, init),
  );
  start();
  await screen.findByRole("alert");
  expect(screen.queryByText(/В этом месяце смен пока нет/)).toBeNull();
});
test("создание отправляет ID записи сотрудника, время HH:MM и примечание", async () => {
  const user = start("/calendar/2026-10-23/shift/add?workplace=11");
  const people = await screen.findByLabelText("Сотрудник");
  expect(screen.queryByText("Удалённая Пётр")).toBeNull();
  expect(screen.queryByRole("navigation")).toBeNull();
  await user.selectOptions(people, "101");
  expect(
    (screen.getByLabelText("Начало смены") as HTMLInputElement).value,
  ).toBe("09:00");
  fireEvent.change(screen.getByLabelText("Конец смены"), {
    target: { value: "15:30" },
  });
  await user.click(screen.getByText("Примечание", { selector: "summary" }));
  await user.type(
    screen.getByLabelText("Примечание (необязательно)"),
    "  Открыть точку  ",
  );
  await user.click(
    screen.getByRole("button", { name: "Сохранить", exact: true }),
  );
  await screen.findByText("Смена создана.");
  expect(writes()).toHaveLength(1);
  expect(writes()[0][0]).toBe("/backend/shifts/?workplace_id=11");
  expect(JSON.parse(writes()[0][1].body)).toEqual({
    employee_id: 101,
    date: "2026-10-23",
    start_time: "09:00",
    end_time: "15:30",
    notes: "Открыть точку",
  });
});
test.each([
  ["09:15", "18:00", /шагом 30 минут/],
  ["18:00", "18:00", /позже начала/],
  ["22:00", "06:00", /Ночные смены/],
])("невалидное время %s–%s не отправляется", async (from, to, error) => {
  start("/calendar/2026-10-23/shift/add?workplace=11");
  await screen.findByLabelText("Сотрудник");
  fireEvent.change(screen.getByLabelText("Сотрудник"), {
    target: { value: "101" },
  });
  fireEvent.change(screen.getByLabelText("Начало смены"), {
    target: { value: from },
  });
  fireEvent.change(screen.getByLabelText("Конец смены"), {
    target: { value: to },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Сохранить" }).closest("form")!,
  );
  expect(screen.getByRole("alert").textContent).toMatch(error);
  expect(writes()).toHaveLength(0);
});
test("редактирование отправляет только время и сохраняет заметку", async () => {
  const user = start("/calendar/2026-10-23/shift/301/edit?workplace=11");
  const person = (await screen.findByLabelText(
    "Сотрудник",
  )) as HTMLInputElement;
  expect(person.readOnly).toBe(true);
  expect(
    screen.getByText("Дата смены: 23 октября 2026 г.").getAttribute("datetime"),
  ).toBe("2026-10-23");
  fireEvent.change(screen.getByLabelText("Начало смены"), {
    target: { value: "10:30" },
  });
  await user.click(screen.getByRole("button", { name: "Сохранить" }));
  await screen.findByText("Изменения смены сохранены.");
  expect(writes()[0][0]).toBe("/backend/shifts/301?workplace_id=11");
  expect(writes()[0][1].method).toBe("PUT");
  expect(JSON.parse(writes()[0][1].body)).toEqual({
    start_time: "10:30",
    end_time: "15:30",
  });
  expect(fixture.state.shifts[0].notes).toBe("Открыть ПВЗ");
});
test("удаление одной смены через редактор требует подтверждения и оставляет соседние", async () => {
  const user = start(sourceDay);
  await user.click(
    await screen.findByRole("link", {
      name: "Редактировать смену Петров Пётр 09:00–15:30",
    }),
  );
  const remove = await screen.findByRole("button", {
    name: "Удалить",
    exact: true,
  });
  await user.click(remove);
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Оставить",
    }),
  );
  expect(writes()).toHaveLength(0);
  await user.click(remove);
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Удалить",
      exact: true,
    }),
  );
  await screen.findByText("Выбранное расписание удалено.");
  await screen.findByRole("link", {
    name: "Редактировать смену Смирнова Анна 15:30–21:00",
  });
  expect(
    screen.queryByRole("link", {
      name: "Редактировать смену Петров Пётр 09:00–15:30",
    }),
  ).toBeNull();
  expect(writes().map(([url, init]) => [url, init.method])).toEqual([
    ["/backend/shifts/301?workplace_id=11", "DELETE"],
  ]);
});
test("удаление всех смен сотрудника за день не затрагивает других", async () => {
  fixture.state.shifts.push({
    ...shift,
    id: 303,
    start_time: "18:00:00",
    end_time: "20:00:00",
  });
  const user = start(sourceDay);
  await user.click(
    await screen.findByText("Дополнительно", { selector: "summary" }),
  );
  await user.click(
    await screen.findByRole("button", {
      name: "Удалить все смены сотрудника Петров Пётр за день",
    }),
  );
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Удалить",
      exact: true,
    }),
  );
  await screen.findByText("Выбранное расписание удалено.");
  expect(writes().map(([url]) => url)).toEqual([
    "/backend/shifts/301?workplace_id=11",
    "/backend/shifts/303?workplace_id=11",
  ]);
  expect(fixture.state.shifts.map((s) => s.id)).toEqual([302]);
});
test("частичное удаление сотрудника сообщает результат и обновляет список", async () => {
  fixture.state.shifts.push({
    ...shift,
    id: 303,
    start_time: "18:00:00",
    end_time: "20:00:00",
  });
  const original = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((url, init) =>
    url.includes("/shifts/303?") && init.method === "DELETE"
      ? Promise.resolve(reply({ detail: "failure" }, 500))
      : original(url, init),
  );
  const user = start(sourceDay);
  await user.click(
    await screen.findByText("Дополнительно", { selector: "summary" }),
  );
  await user.click(
    await screen.findByRole("button", {
      name: "Удалить все смены сотрудника Петров Пётр за день",
    }),
  );
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Удалить",
      exact: true,
    }),
  );
  await screen.findByText(/Удалено смен: 1\. Остальные удалить не удалось/);
  await screen.findByRole("link", {
    name: "Редактировать смену Петров Пётр 18:00–20:00",
  });
  expect(
    screen.queryByRole("link", {
      name: "Редактировать смену Петров Пётр 09:00–15:30",
    }),
  ).toBeNull();
});
test("удаление дня использует один DELETE с датой и оставляет другие дни и ПВЗ", async () => {
  fixture.state.shifts.push(
    { ...shift, id: 303, date: "2026-10-24" },
    { ...shift, id: 304, workplace_id: 12 },
  );
  const user = start(sourceDay);
  await user.click(
    await screen.findByRole("button", { name: "Удалить смены дня" }),
  );
  expect(screen.getByRole("alertdialog").textContent).toContain(
    "все смены всех сотрудников этого ПВЗ",
  );
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Удалить",
      exact: true,
    }),
  );
  await screen.findByText("Все смены этого дня удалены.");
  await screen.findByText("На этот день смен нет");
  expect(writes().map(([url]) => url)).toEqual([
    "/backend/shifts/?workplace_id=11&date=2026-10-23",
  ]);
  expect(fixture.state.shifts.map((s) => s.id)).toEqual([303, 304]);
});
test(
  "копирование выбранной смены на уникальные даты разных месяцев",
  { timeout: 12000 },
  async () => {
    const user = start("/calendar/2026-10-23/duplicate?workplace=11");
    await screen.findByRole("checkbox", { name: /Петров Пётр/ });
    await user.click(screen.getByRole("checkbox", { name: /Смирнова Анна/ }));
    expect(
      (
        screen.getByRole("button", {
          name: /23 октября 2026.*исходный день/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    const target = await screen.findByRole("button", {
      name: /^24 октября 2026/,
    });
    await user.click(target);
    await user.click(target);
    await user.click(target);
    await user.click(screen.getByRole("button", { name: "Следующий месяц" }));
    await user.click(
      await screen.findByRole("button", { name: /^1 ноября 2026/ }),
    );
    expect(
      screen.getByText(/Новых смен: 2/, { selector: ".copy-summary" }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Сохранить копии смен", exact: true }),
    );
    await screen.findByText("Создано копий смен: 2.");
    expect(writes()).toHaveLength(1);
    expect(writes()[0][0]).toBe("/backend/shifts/duplicate/?workplace_id=11");
    expect(JSON.parse(writes()[0][1].body)).toEqual({
      shift_ids: [301],
      dates: ["2026-10-24", "2026-11-01"],
    });
    expect(
      fixture.state.shifts.find((s) => s.date === "2026-11-01")?.notes,
    ).toBe("Открыть ПВЗ");
  },
);

test("календарь показывает имена цветными блоками, а день открывается поверх месяца", async () => {
  const user = start();
  const day = await screen.findByRole("link", {
    name: /^23 октября 2026.*смен: 2/,
  });
  const chips = day.querySelectorAll(".calendar-chip");
  expect(Array.from(chips).map((node) => node.textContent)).toEqual([
    "Пётр",
    "Анна",
  ]);
  expect(chips[0].classList.contains("calendar-color-0")).toBe(true);
  expect(chips[1].classList.contains("calendar-color-1")).toBe(true);
  await user.click(day);
  const dialog = await screen.findByRole("dialog");
  expect(document.body.style.overflow).toBe("hidden");
  expect(
    document.querySelector(".calendar-background")?.hasAttribute("inert"),
  ).toBe(true);
  await screen.findByRole("link", {
    name: "Редактировать смену Петров Пётр 09:00–15:30",
  });
  await waitFor(() =>
    expect(
      document.querySelector(".calendar-background .calendar-grid"),
    ).toBeTruthy(),
  );
  expect(within(dialog).getByRole("button", { name: "Закрыть" })).toBe(
    document.activeElement,
  );
  await user.keyboard("{Escape}");
  await screen.findByRole("group", { name: "Дни месяца" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).toBe("");
});
test("положение полосы соответствует времени смены", async () => {
  start(sourceDay);
  const bar = await screen.findByRole("link", {
    name: "Редактировать смену Петров Пётр 09:00–15:30",
  });
  expect(parseFloat(bar.style.left)).toBeCloseTo((2 / 17) * 100);
  expect(parseFloat(bar.style.width)).toBeCloseTo((6.5 / 17) * 100);
  expect(timeMinutes("09:30:00")).toBe(570);
  expect(timelineRange([{ start_time: "00:30", end_time: "06:00" }])).toEqual({
    from: 0,
    to: 1440,
  });
});
test("сотрудник может открыть время и примечание на шкале без прав изменения", async () => {
  asEmployee("employee");
  const user = start(sourceDay);
  await user.click(
    await screen.findByRole("button", {
      name: "Посмотреть смену Петров Пётр 09:00–15:30",
    }),
  );
  expect(screen.getByText("09:00–15:30")).toBeTruthy();
  expect(screen.getByText("Открыть ПВЗ")).toBeTruthy();
  expect(
    screen.queryByRole("link", { name: /Редактировать смену/ }),
  ).toBeNull();
  expect(writes()).toHaveLength(0);
});
test("день на фоне обновляется после сохранения новой смены", async () => {
  const user = start("/calendar/2026-10-23/shift/add?workplace=11");
  await user.selectOptions(await screen.findByLabelText("Сотрудник"), "101");
  await user.click(
    screen.getByRole("button", { name: "Сохранить", exact: true }),
  );
  await screen.findByText("Смена создана.");
  await waitFor(() => {
    const cell = document.querySelector(
      '.calendar-background a[href="/calendar/2026-10-23?workplace=11"]',
    );
    expect(cell?.getAttribute("aria-label")).toContain("смен: 3");
  });
});
test("копирование без смен или целевых дат не отправляет запрос", async () => {
  const user = start("/calendar/2026-10-23/duplicate?workplace=11");
  await screen.findByRole("group", { name: "Даты копирования" });
  await user.click(
    await screen.findByRole("button", { name: "Сохранить копии смен" }),
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "хотя бы одну смену и одну дату",
  );
  await user.click(screen.getByRole("button", { name: /^24 октября 2026/ }));
  await user.click(
    screen.getByText(/Параметры копирования/, { selector: "summary" }),
  );
  await user.click(screen.getByRole("checkbox", { name: "Выбрать все" }));
  await user.click(
    screen.getByRole("button", { name: "Сохранить копии смен" }),
  );
  expect(writes()).toHaveLength(0);
});
test.each(["employee", "owner"] as const)(
  "роль записи %s без владения не открывает управление расписанием",
  async (role) => {
    asEmployee(role);
    start(sourceDay);
    await screen.findByRole("button", {
      name: "Посмотреть смену Петров Пётр 09:00–15:30",
    });
    expect(
      screen.queryByRole("link", { name: "Добавить сотрудника в расписание" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Удалить смены дня" }),
    ).toBeNull();
    cleanup();
    start("/calendar/2026-10-23/shift/301/edit?workplace=11");
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Сохранить" })).toBeNull();
    expect(
      fetchMock.mock.calls.some(
        ([url]) => url === "/backend/shifts/301?workplace_id=11",
      ),
    ).toBe(false);
  },
);
test("активный администратор получает создание и копирование", async () => {
  asEmployee("admin");
  start(sourceDay);
  expect(
    await screen.findByRole("link", {
      name: "Добавить сотрудника в расписание",
    }),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Размножить смены" })).toBeTruthy();
});
test("неактивный администратор не открывает копирование по прямой ссылке", async () => {
  asEmployee("admin", false);
  start("/calendar/2026-10-23/duplicate?workplace=11");
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("button", { name: "Сохранить копии смен" }),
  ).toBeNull();
  expect(
    fetchMock.mock.calls.some(([url]) => url.startsWith("/backend/shifts/")),
  ).toBe(false);
});
test.each([
  "/calendar?workplace=11&month=2026-13",
  "/calendar/2026-02-30?workplace=11",
  "/calendar/2026-10-23/shift/abc/edit?workplace=11",
  "/calendar/2026-10-23?workplace=abc",
  "/calendar/2026-10-23",
])("невалидная ссылка не отправляет запросов к сменам: %s", async (path) => {
  start(path);
  await screen.findByRole("alert");
  expect(
    fetchMock.mock.calls.some(([url]) => url.startsWith("/backend/shifts/")),
  ).toBe(false);
});
test("форма не редактирует смену другой даты", async () => {
  start("/calendar/2026-10-24/shift/301/edit?workplace=11");
  await screen.findByRole("heading", { name: "Некорректный адрес календаря" });
  expect(screen.queryByRole("button", { name: "Сохранить" })).toBeNull();
});
test("ошибка записи сохраняет поля, повторная отправка во время запроса блокируется", async () => {
  const original = fetchMock.getMockImplementation()!;
  let release!: () => void;
  fetchMock.mockImplementation((url, init) =>
    init.method === "POST"
      ? new Promise<Response>((resolve) => {
          release = () => resolve(reply({ detail: "failure" }, 500));
        })
      : original(url, init),
  );
  const user = start("/calendar/2026-10-23/shift/add?workplace=11");
  await user.selectOptions(await screen.findByLabelText("Сотрудник"), "101");
  await user.click(screen.getByText("Примечание", { selector: "summary" }));
  await user.type(
    screen.getByLabelText("Примечание (необязательно)"),
    "Не потерять",
  );
  const form = screen
    .getByRole("button", { name: "Сохранить" })
    .closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(writes()).toHaveLength(1);
  expect(screen.getByLabelText("Начало смены").matches(":disabled")).toBe(true);
  await act(async () => release());
  await screen.findByRole("alert");
  expect(
    (screen.getByLabelText("Примечание (необязательно)") as HTMLTextAreaElement)
      .value,
  ).toBe("Не потерять");
});
test("поздний ответ предыдущего месяца не подменяет новый", async () => {
  const original = fetchMock.getMockImplementation()!;
  let release!: () => void;
  fetchMock.mockImplementation((url, init) =>
    url.includes("date_from=2026-10-01")
      ? new Promise<Response>((resolve) => {
          release = async () => resolve(await original(url, init));
        })
      : original(url, init),
  );
  const user = start();
  await waitFor(() => expect(release).toBeTypeOf("function"));
  await user.click(screen.getByRole("button", { name: "Следующий месяц" }));
  await screen.findByText(/В этом месяце смен пока нет/);
  await act(async () => release());
  expect(screen.getByRole("heading", { name: "ноябрь 2026 г." })).toBeTruthy();
  expect(screen.getByText(/В этом месяце смен пока нет/)).toBeTruthy();
  expect(screen.queryByText("Смен за месяц: 2.")).toBeNull();
});
test("сессионная ошибка перенаправляет календарь на вход", async () => {
  const original = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((url, init) =>
    url.includes("/shifts/") || url.endsWith("/auth/refresh-token")
      ? Promise.resolve(reply({ detail: "expired" }, 401))
      : original(url, init),
  );
  start();
  await screen.findByRole("heading", { name: /Войдите в/ });
  expect(screen.queryByRole("group", { name: "Дни месяца" })).toBeNull();
});
test("даты учитывают високосные годы и понедельник, без преобразования в UTC", () => {
  expect(monthBounds("2028-02")).toEqual({
    from: "2028-02-01",
    to: "2028-02-29",
  });
  expect(monthBounds("2026-02").to).toBe("2026-02-28");
  expect(parseDate("2026-02-29")).toBeNull();
  expect(parseDate("0000-01-01")).toBeNull();
  expect(dateString(parseDate("0099-01-01")!)).toBe("0099-01-01");
  expect(monthCells("2026-10").slice(0, 4)).toEqual([
    null,
    null,
    null,
    "2026-10-01",
  ]);
  expect(moveMonth("2026-12", 1)).toBe("2027-01");
  expect(moveMonth("0001-01", -1)).toBeNull();
  expect(moveMonth("9999-12", 1)).toBeNull();
  expect(validMonth("2026-13")).toBe(false);
  expect(validateTimes("09:00", "21:00")).toBe("");
});
