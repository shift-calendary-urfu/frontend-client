import { expect, test, type Page } from "@playwright/test";
import { calendarFixture, shift, tokens } from "./fixtures/calendar";

test.use({ timezoneId: "Europe/Berlin" });

async function openCopy(page: Page, failSecondRequest = false) {
  const fixture = calendarFixture();
  const writes: {
    path: string;
    body: { shift_ids: number[]; dates: string[] };
  }[] = [];
  if (failSecondRequest) {
    fixture.state.shifts.push({ ...shift, id: 385, date: "2026-10-01" });
  }
  await page.addInitScript((session) => {
    sessionStorage.setItem("shift-calendar.session", JSON.stringify(session));
  }, tokens);
  await page.route("**/backend/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postData() ? request.postDataJSON() : undefined;
    if (request.method() === "POST") {
      writes.push({ path: url.pathname + url.search, body });
      if (failSecondRequest && writes.length === 2) {
        return route.fulfill({
          status: 503,
          json: { detail: "Ошибка копирования" },
        });
      }
    }
    return route.fulfill(
      fixture.respond(request.url(), request.method(), body),
    );
  });
  await page.goto("/calendar/2026-10-23/duplicate?workplace=11");
  return { writes, fixture };
}

test("2 через 2 заполняет открытый месяц через существующий запрос копирования", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const { writes } = await openCopy(page);
  await page
    .getByRole("checkbox", { name: /Смирнова Анна 15:30–21:00/ })
    .click();
  await page.getByText("Автозаполнение", { exact: true }).click();
  await page.getByText("2 через 2", { exact: true }).click();
  const grid = page.getByRole("group", { name: "Даты копирования" });

  await expect(
    grid.getByRole("button", { name: /^3 октября/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    grid.getByRole("button", { name: /^23 октября/ }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    grid.getByRole("button", { name: /^31 октября/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(grid.locator('button[aria-pressed="true"]')).toHaveCount(14);

  await page.getByRole("button", { name: "Следующий месяц" }).click();
  await expect(grid.getByRole("button", { name: /^1 ноября/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(grid.getByRole("button", { name: /^2 ноября/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.getByRole("button", { name: "Предыдущий месяц" }).click();

  await page.getByRole("button", { name: "Сохранить копии смен" }).click();
  await expect(
    page.getByText("Создано копий смен: 14.", { exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([
    {
      path: "/backend/shifts/duplicate/?workplace_id=11",
      body: {
        shift_ids: [shift.id],
        dates: [
          "2026-10-03",
          "2026-10-04",
          "2026-10-07",
          "2026-10-08",
          "2026-10-11",
          "2026-10-12",
          "2026-10-15",
          "2026-10-16",
          "2026-10-19",
          "2026-10-20",
          "2026-10-24",
          "2026-10-27",
          "2026-10-28",
          "2026-10-31",
        ],
      },
    },
  ]);
});

test("после частичного сохранения своего графика повтор копирует оставшиеся смены", async ({
  page,
}) => {
  const { writes, fixture } = await openCopy(page, true);
  await page.getByText("Автозаполнение", { exact: true }).click();
  await page.getByText("Свой график", { exact: true }).click();
  await page.getByLabel("Рабочих дней подряд").fill("3");
  await page.getByLabel("Выходных подряд").fill("1");
  await expect(page.locator(".copy-summary")).toContainText("Новых смен: 43");

  const save = page.getByRole("button", { name: "Сохранить копии смен" });
  await save.click();
  await expect(page.getByRole("alert")).toContainText("Сохранено смен: 1.");
  await expect(page.locator(".copy-summary")).toContainText("Новых смен: 42");
  expect(writes).toHaveLength(2);
  expect(writes[0].body).toEqual({ shift_ids: [302], dates: ["2026-10-01"] });

  await save.click();
  await expect(page.getByText(/Создано копий смен: 42/)).toBeVisible();
  expect(writes).toHaveLength(3);
  expect(writes[2]).toEqual(writes[1]);
  expect(writes[2].body.dates).toHaveLength(21);
  expect(writes[2].body.dates).not.toContain("2026-10-23");
  expect(
    fixture.state.shifts.filter((item) => item.date === "2026-10-01"),
  ).toHaveLength(2);
});
