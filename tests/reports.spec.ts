import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { tokens } from "./fixtures/calendar";
import { excelMediaType, reportFixture } from "./fixtures/reports";

async function open(page: Page, path: string) {
  const fixture = reportFixture();
  await page.addInitScript((value) => {
    sessionStorage.setItem("shift-calendar.session", JSON.stringify(value));
  }, tokens);
  await page.route("**/backend/**", async (route) => {
    const request = route.request();
    if (request.url().includes("/reports/calendar/excel")) {
      expect(request.headers().authorization).toBe("Bearer access");
      return route.fulfill({
        status: 200,
        contentType: excelMediaType,
        headers: {
          "Content-Disposition":
            'attachment; filename="report_11_2026-10.xlsx"',
        },
        body: await readFile(
          new URL("./fixtures/report.xlsx", import.meta.url),
        ),
      });
    }
    const result = fixture.respond(request.url(), request.method());
    await route.fulfill(result);
  });
  await page.goto(path);
  return fixture;
}

test("отчёт из календаря скачивается настоящим Excel и сохраняет период после перезагрузки", async ({
  page,
}) => {
  await open(page, "/calendar?workplace=11&month=2026-10");
  await page.getByRole("link", { name: "Отчёт за месяц" }).click();
  await expect(page).toHaveURL("/reports/monthly?workplace=11&month=2026-10");
  const table = page.getByRole("table", { name: "По сотрудникам" });
  await expect(table.getByRole("row", { name: /Петров Пётр/ })).toContainText(
    "21,5",
  );
  await expect(table.getByRole("row", { name: /Смирнова Анна/ })).toContainText(
    "0",
  );
  await page.reload();
  await expect(table).toBeVisible();

  const received = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать Excel" }).click();
  const download = await received;
  expect(download.suggestedFilename()).toBe("report_11_2026-10.xlsx");
  const downloaded = await readFile((await download.path())!);
  const original = await readFile(
    new URL("./fixtures/report.xlsx", import.meta.url),
  );
  expect(downloaded).toEqual(original);
  expect(downloaded.subarray(0, 2).toString()).toBe("PK");
  await page.getByRole("link", { name: "К календарю" }).click();
  await expect(page).toHaveURL("/calendar?workplace=11&month=2026-10");
});

test("период и ПВЗ меняются в форме, пустой месяц разрешает выгрузку", async ({
  page,
}) => {
  await open(page, "/workplaces/11");
  await page.getByRole("link", { name: "Отчёт по сменам" }).click();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByLabel("Месяц отчёта").fill("2026-10");
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByLabel("Месяц отчёта").fill("2026-11");
  await expect(page.getByRole("button", { name: "Скачать Excel" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await expect(page.getByText("За этот месяц смен нет.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Скачать Excel" }),
  ).toBeEnabled();

  await page.getByRole("button", { name: /^Выбрать точку/ }).click();
  await page
    .getByRole("dialog", { name: "Выберите точку" })
    .getByRole("button", { name: /Центральная/ })
    .click();
  await expect(page).toHaveURL("/reports/monthly?workplace=12");
  await expect(page.getByRole("button", { name: "Скачать Excel" })).toHaveCount(
    0,
  );
  const request = page.waitForRequest(
    "**/backend/shifts/reports/calendar?workplace_id=12&month=2&year=2028",
  );
  await page.getByLabel("Месяц отчёта").fill("2028-02");
  await page.getByRole("button", { name: "Сформировать отчёт" }).click();
  await request;
  await expect(page.getByText("За этот месяц смен нет.")).toBeVisible();
});

test("отчёт читается на узких телефонах и в альбомной ориентации", async ({
  page,
}) => {
  const fixture = await open(
    page,
    "/reports/monthly?workplace=11&month=2026-10",
  );
  fixture.reports["11-2026-10"].employees[0].full_name =
    "Константинопольский Александр Александрович";
  await page.reload();
  await expect(page.getByRole("table")).toBeVisible();
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [393, 852],
    [430, 932],
    [740, 350],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    const main = page.getByRole("main");
    await page.getByRole("table").scrollIntoViewIfNeeded();
    const overflow = await main.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    expect(overflow).toBe(false);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const name = page.getByRole("rowheader", {
      name: "Константинопольский Александр Александрович",
    });
    await expect(name).toBeVisible();
    const cell = (await name.boundingBox())!;
    expect(cell.x).toBeGreaterThanOrEqual(0);
    expect(cell.x + cell.width).toBeLessThanOrEqual(width);
    if (width <= 520) expect(cell.width).toBeGreaterThan(width * 0.75);
    await page
      .getByRole("button", { name: "Скачать Excel" })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Скачать Excel" }),
    ).toBeInViewport();
  }
});

test("прямая ссылка на отчёт требует входа", async ({ page }) => {
  await page.goto("/reports/monthly?workplace=11&month=2026-10");
  await expect(page).toHaveURL("/login");
});
