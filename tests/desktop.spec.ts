import { expect, test, type Page } from "@playwright/test";
import { calendarFixture, point, tokens } from "./fixtures/calendar";

async function openFixture(page: Page) {
  const fixture = calendarFixture();
  fixture.state.points = [
    { ...point, name: "Комсомольская", address: "ул. Комсомольская, 69" },
    {
      ...point,
      id: 12,
      name: "Восточная",
      address: "ул. Восточная, 72",
      workplace_type: "wildberries",
    },
    {
      ...point,
      id: 13,
      name: "Пункт выдачи на проспекте Космонавтов",
      address: "проспект Космонавтов, 40",
      workplace_type: "yandex_market",
    },
    {
      ...point,
      id: 14,
      name: "Кофейня на Ленина",
      address: "проспект Ленина, 24",
      workplace_type: "cafe_restaurant",
      work_start_time: "08:00:00",
      work_end_time: "20:00:00",
      owner_id: 2,
    },
  ];
  const [first, second] = fixture.state.shifts;
  for (const day of [
    1, 2, 5, 6, 9, 10, 13, 14, 17, 18, 21, 22, 25, 26, 29, 30,
  ]) {
    const date = `2026-10-${String(day).padStart(2, "0")}`;
    fixture.state.shifts.push({ ...first, id: 500 + day, date });
    if (day % 3 === 1)
      fixture.state.shifts.push({ ...second, id: 600 + day, date });
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
  await page.goto("/workplaces");
}

test("на широком экране точки идут карточками, а на телефоне возвращается нижнее меню", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page);
  const navigation = page.getByRole("navigation", {
    name: "Разделы приложения",
  });
  const points = page.locator(".workplace-list > li");
  await expect(points).toHaveCount(4);
  await expect(
    navigation.getByRole("link", { name: "Точки", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".workplace-add-label")).toBeVisible();

  const desktopNav = (await navigation.boundingBox())!;
  const firstCard = (await points.nth(0).boundingBox())!;
  const secondCard = (await points.nth(1).boundingBox())!;
  expect(desktopNav.x).toBe(0);
  expect(desktopNav.height).toBeGreaterThan(850);
  expect(firstCard.x).toBeGreaterThan(desktopNav.width);
  expect(secondCard.y).toBe(firstCard.y);
  expect(secondCard.x).toBeGreaterThan(firstCard.x);
  await page.screenshot({
    path: testInfo.outputPath("desktop-workplaces.png"),
  });

  for (const width of [960, 1024, 2048]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect((await navigation.boundingBox())!.x).toBe(0);
  }

  await page.setViewportSize({ width: 393, height: 852 });
  await expect(page.locator(".workplace-add-label")).toBeHidden();
  const mobileNav = (await navigation.boundingBox())!;
  const firstRow = (await points.nth(0).boundingBox())!;
  const secondRow = (await points.nth(1).boundingBox())!;
  expect(mobileNav.y).toBeGreaterThan(740);
  expect(secondRow.x).toBe(firstRow.x);
  expect(secondRow.y).toBeGreaterThan(firstRow.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    393,
  );
});

test("широкий календарь показывает часы, а диалог дня открывается по центру", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page);
  await page.goto("/calendar?workplace=11&month=2026-10");
  const grid = page.getByRole("group", { name: "Дни месяца" });
  const day = grid.getByRole("link", { name: /^23 октября 2026.*смен: 2/ });
  await expect(day.locator(".calendar-chip-hours").first()).toBeVisible();
  expect((await grid.boundingBox())!.width).toBeGreaterThan(960);
  await page.screenshot({ path: testInfo.outputPath("desktop-calendar.png") });

  await day.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const bounds = (await dialog.boundingBox())!;
  expect(Math.abs(bounds.x + bounds.width / 2 - 720)).toBeLessThan(2);
  expect(Math.abs(bounds.y + bounds.height / 2 - 450)).toBeLessThan(2);
  await expect(
    page.locator(".calendar-dialog-shell .bottom-nav"),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(day).toBeFocused();
});
