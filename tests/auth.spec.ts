import { test, expect, type Page } from "@playwright/test";
const profile = {
  id: 1,
  first_name: "Иван",
  second_name: "Иванов",
  third_name: null,
  email: "ivan@example.com",
  phone: "+79991234567",
  is_active: true,
};
const tokens = {
  access_token: "access",
  refresh_token: "refresh",
  token_type: "Bearer",
};
async function mock(page: Page) {
  await page.route("**/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/login")) {
      expect(route.request().headers()["content-type"]).toContain(
        "application/x-www-form-urlencoded",
      );
      expect(
        new URLSearchParams(route.request().postData()!).get("username"),
      ).toBe(profile.email);
      return route.fulfill({ json: tokens });
    }
    if (path.endsWith("/auth/refresh-token"))
      return route.fulfill({ status: 201, json: tokens });
    if (path.endsWith("/workplaces/")) return route.fulfill({ json: [] });
    if (path.endsWith("/users/me")) {
      expect(route.request().headers().authorization).toBe("Bearer access");
      return route.fulfill({
        status: route.request().method() === "PUT" ? 201 : 200,
        json: {
          ...profile,
          ...(route.request().method() === "PUT"
            ? route.request().postDataJSON()
            : {}),
        },
      });
    }
    if (path.endsWith("/users/me/password"))
      return route.fulfill({ json: { message: "Password updated" } });
    return route.fulfill({
      status: 404,
      json: { detail: "Unexpected endpoint" },
    });
  });
}
async function loginAndOpenSettings(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(profile.email);
  await page.getByLabel("Пароль", { exact: true }).fill("Password123");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL("/workplaces");
  await expect(
    page.getByRole("heading", { name: "Список ПВЗ", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Настройки", exact: true })
    .click();
  await expect(page).toHaveURL("/settings");
  await expect(page.getByLabel("Имя", { exact: true })).toHaveValue("Иван");
}
test("защита настроек и неизвестного адреса", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL("/login");
  await page.goto("/settings/password");
  await expect(page).toHaveURL("/login");
  await page.goto("/unknown");
  await expect(page).toHaveURL("/login");
});
test("вход, профиль, сохранение, перезагрузка и выход", async ({ page }) => {
  await mock(page);
  await loginAndOpenSettings(page);
  await expect(page.getByText("Фамилия", { exact: true })).toBeVisible();
  await page.getByLabel("Имя", { exact: true }).fill("Пётр");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Изменения сохранены.");
  await page.reload();
  await expect(page.getByLabel("Имя", { exact: true })).toHaveValue("Иван");
  await page.getByRole("button", { name: "Выйти из аккаунта" }).click();
  await expect(page).toHaveURL("/login");
  await page.goBack();
  await expect(page).toHaveURL("/login");
});
test("на экране входа видны рамки полей и кнопка на разных телефонах", async ({
  page,
}) => {
  await page.goto("/login");
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [430, 932],
    [740, 350],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByLabel("Email", { exact: true })).toHaveCSS(
      "border-top-style",
      "solid",
    );
    await expect(page.getByLabel("Пароль", { exact: true })).toHaveCSS(
      "border-top-width",
      "1px",
    );
    const pageWidth = (await page.getByRole("main").boundingBox())?.width;
    expect(pageWidth).toBe(Math.min(width, 600));
    await page
      .getByRole("button", { name: "Войти", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Войти", exact: true }),
    ).toBeInViewport();
  }
});
test("регистрация: несовпадение паролей, точный body, переход на вход", async ({
  page,
}) => {
  await mock(page);
  let called = 0;
  await page.route("**/backend/auth/register", async (route) => {
    called++;
    expect(route.request().postDataJSON()).toEqual({
      ...Object.fromEntries(
        Object.entries(profile).filter(
          ([key]) => !["id", "is_active"].includes(key),
        ),
      ),
      password: "Password123",
    });
    await route.fulfill({ status: 201, json: profile });
  });
  await page.goto("/register");
  await page.getByLabel("Фамилия", { exact: true }).fill("Иванов");
  await page.getByLabel("Имя", { exact: true }).fill("Иван");
  await page.getByLabel("Email", { exact: true }).fill(profile.email);
  await page.getByLabel("Телефон", { exact: true }).fill(profile.phone);
  await page.getByLabel("Пароль", { exact: true }).fill("Password123");
  await page
    .getByLabel("Повторите пароль", { exact: true })
    .fill("Different123");
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await expect(page.getByRole("alert")).toHaveText("Пароли не совпадают.");
  expect(called).toBe(0);
  await page
    .getByLabel("Повторите пароль", { exact: true })
    .fill("Password123");
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("status")).toContainText("Аккаунт создан");
  expect(called).toBe(1);
});
test("ошибочный вход и безопасная обработка 422", async ({ page }) => {
  await mock(page);
  await page.route("**/backend/auth/login", (route) =>
    route.fulfill({ status: 401, json: { detail: "Unauthorized" } }),
  );
  await page.goto("/login");
  await page.getByLabel("Email").fill(profile.email);
  await page.getByLabel("Пароль", { exact: true }).fill("Password123");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Неверный email или пароль.",
  );
  await page.route("**/backend/auth/login", (route) =>
    route.fulfill({
      status: 422,
      json: {
        detail: [{ loc: ["body", "password"], input: "SECRET", msg: "SECRET" }],
      },
    }),
  );
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Пароль: проверьте значение.",
  );
  await expect(page.getByText("SECRET")).toHaveCount(0);
});
test("смена пароля и повторный вход после изменения email", async ({
  page,
}) => {
  await mock(page);
  await loginAndOpenSettings(page);
  await page
    .getByRole("link", { name: "Изменить пароль", exact: true })
    .click();
  await expect(page).toHaveURL("/settings/password");
  await expect(
    page.getByRole("heading", { name: "Смена пароля" }),
  ).toBeVisible();
  await page.getByLabel("Текущий пароль", { exact: true }).fill("Password123");
  await page.getByLabel("Новый пароль", { exact: true }).fill("NewPassword123");
  await page
    .getByLabel("Повторите новый пароль", { exact: true })
    .fill("NewPassword123");
  const request = page.waitForRequest("**/backend/users/me/password");
  await page.getByRole("button", { name: "Обновить пароль" }).click();
  expect((await request).postDataJSON()).toEqual({
    old_password: "Password123",
    new_password: "NewPassword123",
  });
  await expect(page).toHaveURL("/settings");
  await expect(
    page.getByText("Пароль изменён.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("new@example.com");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("status")).toContainText("Email изменён");
});
test("обновление access token и истечение refresh token", async ({ page }) => {
  await mock(page);
  let count = 0;
  await page.route("**/backend/users/me", (route) =>
    ++count === 1
      ? route.fulfill({ status: 401, json: { detail: "expired" } })
      : route.fulfill({ json: profile }),
  );
  await loginAndOpenSettings(page);
  expect(count).toBe(3);
  await page.route("**/backend/auth/refresh-token", (route) =>
    route.fulfill({ status: 401, json: { detail: "expired" } }),
  );
  await page.route("**/backend/users/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "expired" } }),
  );
  await page.reload();
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("status")).toContainText("Сессия истекла");
});
test("ошибка загрузки с повтором и отсутствие горизонтальной прокрутки", async ({
  page,
}) => {
  await mock(page);
  await loginAndOpenSettings(page);
  await page.route("**/backend/users/me", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Не удалось связаться");
  await page.unroute("**/backend/users/me");
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByLabel("Имя", { exact: true })).toHaveValue("Иван");
  for (const width of [320, 393, 768, 1440]) {
    await page.setViewportSize({ width, height: 852 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
