import { test, expect, type Page } from "@playwright/test";
import { calendarFixture, employee, shift, tokens } from "./fixtures/calendar";

async function open(
  page: Page,
  path: string,
  role?: "admin" | "employee",
  fixture = calendarFixture(),
) {
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
async function chooseTime(page: Page, label: string, value: string) {
  await page.getByRole("button", { name: new RegExp(`^${label}:`) }).click();
  const dialog = page.getByRole("dialog", { name: label });
  const [hour, minute] = value.split(":");
  for (const [column, target] of [
    ["Часы", hour],
    ["Минуты", minute],
  ]) {
    const wheel = dialog.getByRole("listbox", { name: column });
    const current = await wheel
      .getByRole("option", { selected: true })
      .textContent();
    if (current === target) continue;
    const direction =
      Number(current) > Number(target) ? "ArrowUp" : "ArrowDown";
    const distance = Math.abs(Number(current) - Number(target));
    for (let step = 0; step < (column === "Минуты" ? 1 : distance); step++)
      await wheel.press(direction);
    await expect(wheel.getByRole("option", { selected: true })).toHaveText(
      target,
    );
  }
  await dialog.getByRole("button", { name: "Готово" }).click();
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
  await page.getByRole("button", { name: "Выберите сотрудника" }).click();
  await page
    .getByRole("dialog", { name: "Выберите сотрудника" })
    .getByRole("button", { name: /Смирнова Анна/ })
    .click();
  await chooseTime(page, "Начало смены", "09:30");
  await chooseTime(page, "Конец смены", "14:00");
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
  await chooseTime(page, "Начало смены", "10:00");
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
  await expect(page.locator(".copy-summary")).toBeVisible();
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
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
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
  await expect(
    page
      .getByRole("group", { name: "Сведения о смене" })
      .getByText("09:00–15:30", { exact: true }),
  ).toBeInViewport();
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
  await expect(
    page.getByRole("button", { name: "Выберите сотрудника" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});

test("фильтр и колесо работают на узком и коротком экранах", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const fixture = calendarFixture();
  fixture.state.points[1].address =
    "Екатеринбург, улица Академика Бардина, дом 40, корпус 2, вход со двора";
  await open(page, "/employees?workplace=11", undefined, fixture);
  await page.getByRole("button", { name: /^Выбрать ПВЗ/ }).click();
  const points = page.getByRole("dialog", { name: "Выберите ПВЗ" });
  await expect(
    points.getByRole("button", { name: /Машинная/, pressed: true }),
  ).toBeVisible();
  await points.getByRole("button", { name: /Центральная/ }).click();
  await expect(page).toHaveURL("/employees?workplace=12");

  await page.goto("/calendar?workplace=11&month=2026-10");
  await page.getByRole("button", { name: /^Выбрать ПВЗ/ }).click();
  await expect(points.getByText(fixture.state.points[1].address)).toBeVisible();
  await points.getByRole("button", { name: /Центральная/ }).click();
  await expect(page).toHaveURL("/calendar?workplace=12&month=2026-10");

  await page.goto("/calendar/2026-10-23/shift/add?workplace=11");
  const startTime = page.getByRole("button", { name: "Начало смены: 09:00" });
  await startTime.click();
  const time = page.getByRole("dialog", { name: "Начало смены", exact: true });
  const hours = time.getByRole("listbox", { name: "Часы" });
  const minutes = time.getByRole("listbox", { name: "Минуты" });
  await expect(hours.getByRole("option", { selected: true })).toHaveText("09");
  await expect(minutes.getByRole("option")).toHaveCount(2);
  await hours.hover();
  await page.mouse.wheel(0, 88);
  await expect(hours.getByRole("option", { selected: true })).toHaveText("11");
  await page.keyboard.press("Escape");
  await expect(time).toHaveCount(0);
  await expect(startTime).toBeFocused();
  await expect(page).toHaveURL("/calendar/2026-10-23/shift/add?workplace=11");

  await page.setViewportSize({ width: 430, height: 932 });
  expect((await page.locator(".calendar-sheet").boundingBox())?.width).toBe(
    430,
  );
  await startTime.click();
  await minutes.getByRole("option", { name: "30" }).click();
  await expect(minutes.getByRole("option", { selected: true })).toHaveText(
    "30",
  );
  await time.getByRole("button", { name: "Отмена" }).click();

  await page.setViewportSize({ width: 740, height: 350 });
  await startTime.click();
  await minutes.press("End");
  await time.getByRole("button", { name: "Готово" }).click();
  await expect(
    page.getByRole("button", { name: "Начало смены: 09:30" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(740);
});

test("заполненный день не растягивает месяц, короткая смена открывается с любой точки строки", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const fixture = calendarFixture();
  fixture.state.shifts = Array.from({ length: 12 }, (_, index) => ({
    ...shift,
    id: 301 + index,
    first_name: "Александр",
    start_time: index === 0 ? "00:00:00" : "09:00:00",
    end_time: index === 0 ? "00:30:00" : "15:30:00",
  }));
  await open(page, "/calendar?workplace=11&month=2026-10", undefined, fixture);
  const day = page.getByRole("link", { name: /^23 октября 2026.*смен: 12/ });
  await expect(day.getByText("+9", { exact: true })).toBeVisible();
  await expect(day.locator(".calendar-chip")).toHaveCount(3);
  expect((await day.boundingBox())!.height).toBeLessThan(130);
  await day.click();

  const sheet = page.getByRole("dialog");
  const close = sheet.getByRole("button", { name: "Закрыть" });
  const content = sheet.locator(".calendar-sheet-content");
  const shortShift = sheet.getByRole("link", { name: /00:00–00:30/ });
  await expect(shortShift).toBeVisible();
  const top = (await close.boundingBox())!.y;
  await content.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(close).toBeInViewport();
  expect((await close.boundingBox())!.y).toBe(top);
  expect((await shortShift.boundingBox())!.width).toBeGreaterThan(200);
  expect(
    (await shortShift.locator(".timeline-segment").boundingBox())!.width,
  ).toBeLessThan(10);
  await close.click();
  await expect(day).toBeFocused();
  await expect(day).toBeInViewport();
  await day.click();
  await shortShift.click();
  await expect(page).toHaveURL(/\/shift\/301\/edit/);
  await expect(
    page.getByRole("button", { name: "Начало смены: 00:00" }),
  ).toBeInViewport();
});

test("длинные поля переносятся, а окно удаления блокирует фоновую прокрутку", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const fixture = calendarFixture();
  const type = "long_custom_marketplace_name_with_no_spaces_in_it";
  fixture.state.points[0].workplace_type = type;
  fixture.state.employees[0].user = {
    ...fixture.state.employees[0].user,
    second_name: "Константинопольский",
    first_name: "Александр",
    third_name: "Александрович",
  };
  await open(page, "/workplaces/11", undefined, fixture);
  const typeText = page.getByText(type, { exact: true });
  await expect(typeText).toBeVisible();
  const typeBox = (await typeText.boundingBox())!;
  expect(typeBox.x + typeBox.width).toBeLessThanOrEqual(320);

  await page.goto("/workplaces/11/employees/101/edit");
  const fullName = page.getByRole("textbox", { name: "Имя и фамилия" });
  await expect(fullName).toHaveText(
    "Константинопольский Александр Александрович",
  );
  expect((await fullName.boundingBox())!.height).toBeGreaterThan(46);
  await page
    .getByRole("button", { name: "Удалить сотрудника", exact: true })
    .click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Оставить" })).toBeFocused();
  const left = (await confirm.getByRole("heading").boundingBox())!.x;
  expect(left).toBeGreaterThan(0);
  const scroll = await page.evaluate(() => scrollY);
  expect(scroll).toBeGreaterThan(0);
  await page.mouse.move(160, 25);
  await page.mouse.wheel(0, -300);
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});
