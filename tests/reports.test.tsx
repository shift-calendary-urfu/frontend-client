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
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";
import { api, logout } from "../src/api";
import { employee, tokens } from "./fixtures/calendar";
import {
  excelMediaType,
  octoberReport,
  reportFixture,
} from "./fixtures/reports";

let fixture: ReturnType<typeof reportFixture>;
const fetchMock = vi.fn();
const createObjectURL = vi.fn((_blob: Blob) => "blob:report");
const revokeObjectURL = vi.fn();
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const fileBytes = new Uint8Array([80, 75, 3, 4, 1, 2, 3]);
const excel = () =>
  new Response(fileBytes, { headers: { "Content-Type": excelMediaType } });
const reportCalls = () =>
  fetchMock.mock.calls.filter(([url]) => url.includes("/reports/calendar"));

beforeEach(async () => {
  fixture = reportFixture();
  logout();
  fetchMock.mockReset();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    if (url.includes("/reports/calendar/excel")) return excel();
    const result = fixture.respond(url, init.method);
    return reply(result.json, result.status);
  });
  await api.login(fixture.state.me.email, "Password123");
  fetchMock.mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function start(path = "/reports/monthly?workplace=11&month=2026-10") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return userEvent.setup();
}
async function result() {
  return screen.findByRole("table", { name: "По сотрудникам" });
}

test("календарь передаёт выбранный ПВЗ и месяц в отчёт", async () => {
  const user = start("/calendar?workplace=11&month=2026-10");
  await user.click(await screen.findByRole("link", { name: "Отчёт за месяц" }));
  await result();
  expect(reportCalls()[0][0]).toBe(
    "/backend/shifts/reports/calendar?workplace_id=11&month=10&year=2026",
  );
  expect(reportCalls()[0][1].headers.Authorization).toBe("Bearer access");
  expect(
    within(await result()).getByRole("row", { name: /Петров Пётр/ })
      .textContent,
  ).toContain("21,5");
  expect(
    screen
      .getByRole("link", { name: "К календарю", exact: true })
      .getAttribute("href"),
  ).toBe("/calendar?workplace=11&month=2026-10");
});

test("из карточки ПВЗ отчёт формируется после выбора месяца; изменение периода скрывает старую выгрузку", async () => {
  const user = start("/workplaces/11");
  await user.click(
    await screen.findByRole("link", { name: "Отчёт по сменам" }),
  );
  const field = await screen.findByLabelText("Месяц отчёта");
  expect(reportCalls()).toHaveLength(0);
  fireEvent.change(field, { target: { value: "2026-10" } });
  await user.click(screen.getByRole("button", { name: "Сформировать отчёт" }));
  await result();
  fireEvent.change(screen.getByLabelText("Месяц отчёта"), {
    target: { value: "2026-11" },
  });
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByRole("button", { name: "Скачать Excel" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Сформировать отчёт" }));
  await screen.findByText("За этот месяц смен нет.");
  expect(reportCalls().at(-1)![0]).toBe(
    "/backend/shifts/reports/calendar?workplace_id=11&month=11&year=2026",
  );
  expect(screen.getByRole("button", { name: "Скачать Excel" })).toBeTruthy();
});

test.each(["1999-12", "2101-01", "2026-13", "invalid"])(
  "некорректный месяц %s не отправляется в API",
  async (month) => {
    start(`/reports/monthly?workplace=11&month=${month}`);
    await screen.findByRole("alert");
    expect(reportCalls()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Скачать Excel" })).toBeNull();
  },
);

test.each([
  ["admin", true, true],
  ["admin", false, false],
  ["employee", true, false],
  ["owner", true, false],
] as const)("права %s, активность %s", async (role, active, allowed) => {
  fixture.state.me = { ...fixture.state.me, ...employee.user };
  fixture.state.employees[0].role = role;
  fixture.state.employees[0].is_active = active;
  start();
  if (allowed) await result();
  else {
    await screen.findByText(/Отчёт по точке доступен владельцу/);
    expect(reportCalls()).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "Сформировать отчёт" }),
    ).toBeNull();
  }
});

test("неизвестный ПВЗ не запрашивает чужой отчёт", async () => {
  start("/reports/monthly?workplace=999&month=2026-10");
  await screen.findByText("Эта точка недоступна. Выберите точку из списка.");
  expect(reportCalls()).toHaveLength(0);
  expect(fetchMock.mock.calls.some(([url]) => url.includes("/999"))).toBe(
    false,
  );
});

test("поздний ответ предыдущего периода не подменяет новый", async () => {
  let release!: (value: Response) => void;
  const original = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((url, init) =>
    url.includes("/reports/calendar?") && url.includes("month=10&")
      ? new Promise<Response>((resolve) => {
          release = resolve;
        })
      : original(url, init),
  );
  const user = start();
  await waitFor(() => expect(release).toBeTypeOf("function"));
  fireEvent.change(screen.getByLabelText("Месяц отчёта"), {
    target: { value: "2026-11" },
  });
  await user.click(screen.getByRole("button", { name: "Сформировать отчёт" }));
  await screen.findByText("За этот месяц смен нет.");
  await act(async () => release(reply(octoberReport)));
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByRole("heading", { name: /ноябрь 2026/ })).toBeTruthy();
});

test("Excel использует Bearer, обновляет токен при 401 и отдаёт браузеру исходные байты", async () => {
  const user = start();
  await result();
  const original = fetchMock.getMockImplementation()!;
  let first = true;
  fetchMock.mockImplementation((url, init) => {
    if (url.includes("/auth/refresh-token"))
      return Promise.resolve(reply({ ...tokens, access_token: "renewed" }));
    if (url.includes("/reports/calendar/excel") && first) {
      first = false;
      return Promise.resolve(reply({ detail: "expired" }, 401));
    }
    return original(url, init);
  });
  const download = screen.getByRole("button", { name: "Скачать Excel" });
  await user.click(download);
  await screen.findByText("Excel-файл передан браузеру для скачивания.");
  const calls = reportCalls().filter(([url]) => url.includes("/excel"));
  expect(calls).toHaveLength(2);
  expect(calls[0][0]).toBe(
    "/backend/shifts/reports/calendar/excel?workplace_id=11&month=10&year=2026",
  );
  expect(calls[1][1].headers.Authorization).toBe("Bearer renewed");
  const blob = createObjectURL.mock.calls[0][0] as Blob;
  expect(new Uint8Array(await blob.arrayBuffer())).toEqual(fileBytes);
  const click = vi.mocked(HTMLAnchorElement.prototype.click);
  expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe(
    "report_11_2026-10.xlsx",
  );
});

test("ошибка выгрузки оставляет отчёт на экране и позволяет повторить скачивание", async () => {
  const user = start();
  await result();
  const original = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((url, init) =>
    url.includes("/excel")
      ? Promise.resolve(reply({ detail: "internal" }, 500))
      : original(url, init),
  );
  await user.click(screen.getByRole("button", { name: "Скачать Excel" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("table")).toBeTruthy();
  expect(createObjectURL).not.toHaveBeenCalled();
  fetchMock.mockImplementation(original);
  await user.click(screen.getByRole("button", { name: "Скачать Excel" }));
  await screen.findByText("Excel-файл передан браузеру для скачивания.");
  expect(createObjectURL).toHaveBeenCalledTimes(1);
});

test.each(["json", "empty"])(
  "успешный ответ %s не скачивается как поддельный xlsx",
  async (format) => {
    const user = start();
    await result();
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url, init) =>
      url.includes("/excel")
        ? Promise.resolve(
            format === "json"
              ? reply({ detail: "wrong" })
              : new Response("", {
                  headers: { "Content-Type": excelMediaType },
                }),
          )
        : original(url, init),
    );
    await user.click(screen.getByRole("button", { name: "Скачать Excel" }));
    await screen.findByRole("alert");
    expect(createObjectURL).not.toHaveBeenCalled();
  },
);

test("ошибка отчёта повторяется за тот же период", async () => {
  const original = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((url, init) =>
    url.includes("/reports/calendar?")
      ? Promise.resolve(reply({ detail: "internal" }, 500))
      : original(url, init),
  );
  const user = start();
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Скачать Excel" })).toBeNull();
  fetchMock.mockImplementation(original);
  await user.click(screen.getByRole("button", { name: "Сформировать отчёт" }));
  await result();
  expect(reportCalls()).toHaveLength(2);
});
