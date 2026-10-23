import { test, expect, type Page } from "@playwright/test";
import { calendarFixture, employee, tokens } from "./fixtures/calendar";

async function open(page: Page, path: string, role?: "admin" | "employee") {
  const fixture = calendarFixture();
  if (role) {
    fixture.state.me = {
      ...fixture.state.me,
      ...employee.user,
      third_name: null,
    };
    fixture.state.employees[0].role = role;
  }
  await page.addInitScript((session) => {
    sessionStorage.setItem("shift-calendar.session", JSON.stringify(session));
  }, tokens);
  await page.route("**/backend/**", async (route) => {
    const request = route.request();
    const result = fixture.respond(
      request.url(),
      request.method(),
      request.postData() ? request.postDataJSON() : undefined,
    );
    await route.fulfill(result);
  });
  await page.goto(path);
  return fixture;
}
async function noOverflow(page: Page) {
  for (const width of [320, 393, 768, 1440]) {
    await page.setViewportSize({ width, height: 852 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 393, height: 852 });
}

test("календарь: создание, правка, копирование и удаление без затрагивания других дней", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const fixture = await open(page, "/calendar?workplace=11&month=2026-10");
  await expect(page.getByRole("group", { name: "Дни месяца" })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("calendar-month.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: /^23 октября 2026.*смен: 2/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Редактировать смену Петров Пётр 09:00–15:30",
    }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("calendar-day.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", {
      name: "Добавить сотрудника в расписание",
      exact: true,
    })
    .click();
  await page.getByLabel("Сотрудник", { exact: true }).selectOption("102");
  await page.getByLabel("Начало смены", { exact: true }).fill("09:30");
  await page.getByLabel("Конец смены", { exact: true }).fill("14:00");
  await page.getByText("Примечание", { exact: true }).click();
  await page.getByLabel("Примечание (необязательно)").fill("Утро");
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("calendar-create.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Смена создана.", { exact: true })).toBeVisible();
  await page
    .getByRole("link", {
      name: "Редактировать смену Смирнова Анна 09:30–14:00",
      exact: true,
    })
    .click();
  await page.getByLabel("Начало смены").fill("10:00");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Изменения смены сохранены.")).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Редактировать смену Смирнова Анна 10:00–14:00",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Размножить смены", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /23 октября 2026.*исходный день/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /^24 октября 2026/ }).click();
  await page.getByRole("button", { name: "Следующий месяц" }).click();
  await page.getByRole("button", { name: /^1 ноября 2026/ }).click();
  await expect(page.locator(".copy-summary")).toHaveText(/Новых смен: 6/);
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("calendar-duplicate.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Сохранить копии смен", exact: true })
    .click();
  await expect(
    page.getByText("Создано копий смен: 6.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /^24 октября 2026.*смен: 3/ }).click();
  await page
    .getByRole("link", {
      name: "Редактировать смену Петров Пётр 09:00–15:30",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Оставить", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  await expect(page.getByText("Выбранное расписание удалено.")).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Редактировать смену Петров Пётр 09:00–15:30",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByText("Дополнительно", { exact: true }).click();
  await page
    .getByRole("button", {
      name: "Удалить все смены сотрудника Смирнова Анна за день",
      exact: true,
    })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  await expect(
    page.getByText("На этот день смен нет", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByRole("link", { name: /^23 октября 2026.*смен: 3/ }).click();
  await page
    .getByRole("button", { name: "Удалить смены дня", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  await expect(
    page.getByText("Все смены этого дня удалены.", { exact: true }),
  ).toBeVisible();
  expect(fixture.state.shifts).toHaveLength(3);
  expect(fixture.state.shifts.every((s) => s.date === "2026-11-01")).toBe(true);
  expect(errors).toEqual([]);
});
test("обычный сотрудник просматривает календарь, но не открывает формы управления", async ({
  page,
}) => {
  await open(page, "/calendar/2026-10-23?workplace=11", "employee");
  await page
    .getByRole("button", { name: "Посмотреть смену Петров Пётр 09:00–15:30" })
    .click();
  await expect(page.getByText("09:00–15:30", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Добавить сотрудника в расписание",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Удалить смены дня", exact: true }),
  ).toHaveCount(0);
  await page.goto("/calendar/2026-10-23/shift/add?workplace=11");
  await expect(page.getByRole("alert")).toContainText(
    "только владелец или администратор",
  );
  await expect(page.getByRole("button", { name: "Сохранить" })).toHaveCount(0);
});
test("администратор может открыть создание смены", async ({ page }) => {
  await open(page, "/calendar/2026-10-23?workplace=11", "admin");
  await page
    .getByRole("link", {
      name: "Добавить сотрудника в расписание",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Сотрудник", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
