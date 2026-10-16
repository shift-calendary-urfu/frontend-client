import React from "react";
import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../src/App";
import { api, logout, hasSession } from "../src/api";
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
const fetchMock = vi.fn();
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  logout();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    if (url.endsWith("/auth/login") || url.endsWith("/auth/refresh-token"))
      return response(tokens);
    if (url.endsWith("/auth/register")) return response(profile, 201);
    if (url.endsWith("/users/me/password"))
      return response({ message: "Password updated" });
    if (url.endsWith("/users/me"))
      return response(
        {
          ...profile,
          ...(init.method === "PUT" ? JSON.parse(init.body as string) : {}),
        },
        init.method === "PUT" ? 201 : 200,
      );
    throw new Error(`Unexpected URL ${url}`);
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function start(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return userEvent.setup();
}
async function login() {
  const user = start("/login");
  await user.type(screen.getByLabelText("Email"), profile.email);
  await user.type(screen.getByLabelText("Пароль"), "Password123");
  await user.click(screen.getByRole("button", { name: "Войти", exact: true }));
  await screen.findByRole("heading", { name: "Настройки" });
  await screen.findByDisplayValue("Иван");
  return user;
}
test("settings защищены, вход передаёт form-urlencoded и открывает профиль", async () => {
  const user = start("/settings");
  expect(screen.getByRole("heading").textContent).toContain("Войдите");
  await user.type(screen.getByLabelText("Email"), profile.email);
  await user.type(screen.getByLabelText("Пароль"), "Password123");
  await user.click(screen.getByRole("button", { name: "Войти", exact: true }));
  await screen.findByDisplayValue("Иван");
  const init = fetchMock.mock.calls.find(([url]) =>
    url.endsWith("/auth/login"),
  )![1];
  expect(init.headers["Content-Type"]).toBe(
    "application/x-www-form-urlencoded",
  );
  expect(init.body.get("username")).toBe(profile.email);
  expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(
    true,
  );
});
test("сохранение профиля отправляет только поля модели; выход закрывает настройки", async () => {
  const user = await login();
  await user.clear(screen.getByLabelText("Имя"));
  await user.type(screen.getByLabelText("Имя"), "Пётр");
  await user.click(
    screen.getByRole("button", { name: "Сохранить", exact: true }),
  );
  await screen.findByText("Изменения сохранены.");
  const call = fetchMock.mock.calls.find(
    ([url, init]) => url.endsWith("/users/me") && init.method === "PUT",
  )!;
  expect(JSON.parse(call[1].body)).toEqual({
    first_name: "Пётр",
    second_name: "Иванов",
    third_name: null,
    email: profile.email,
    phone: profile.phone,
  });
  await user.click(screen.getByRole("button", { name: "Выйти из аккаунта" }));
  await screen.findByRole("heading", { name: /Войдите/ });
  expect(hasSession()).toBe(false);
});
test("регистрация проверяет подтверждение и переводит на вход без сессии", async () => {
  const user = start("/register");
  for (const [label, value] of Object.entries({
    Фамилия: "Иванов",
    Имя: "Иван",
    Email: profile.email,
    Телефон: profile.phone,
    Пароль: "Password123",
    "Повторите пароль": "Different123",
  }))
    await user.type(screen.getByLabelText(label, { exact: true }), value);
  await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));
  expect(screen.getByRole("alert").textContent).toBe("Пароли не совпадают.");
  expect(fetchMock).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText("Повторите пароль"));
  await user.type(screen.getByLabelText("Повторите пароль"), "Password123");
  await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));
  await screen.findByText("Аккаунт создан. Войдите с вашим паролем.");
  expect(hasSession()).toBe(false);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).third_name).toBe(null);
});
test("смена email требует нового входа", async () => {
  const user = await login();
  await user.clear(screen.getByLabelText("Email"));
  await user.type(screen.getByLabelText("Email"), "new@example.com");
  await user.click(
    screen.getByRole("button", { name: "Сохранить", exact: true }),
  );
  await screen.findByText("Email изменён. Войдите снова с новым адресом.");
  expect(hasSession()).toBe(false);
});
test("смена пароля отправляет old_password и new_password", async () => {
  const user = await login();
  await user.click(screen.getByRole("button", { name: "Изменить пароль" }));
  await user.type(screen.getByLabelText("Текущий пароль"), "Password123");
  await user.type(
    screen.getByLabelText("Новый пароль", { exact: true }),
    "NewPassword123",
  );
  await user.type(
    screen.getByLabelText("Повторите новый пароль"),
    "NewPassword123",
  );
  await user.click(screen.getByRole("button", { name: "Обновить пароль" }));
  await screen.findByText("Пароль изменён.");
  expect(
    JSON.parse(
      fetchMock.mock.calls.find(([url]) =>
        url.endsWith("/users/me/password"),
      )![1].body,
    ),
  ).toEqual({ old_password: "Password123", new_password: "NewPassword123" });
});
test("401 вызывает refresh и один повтор с Bearer", async () => {
  await api.login(profile.email, "Password123");
  fetchMock.mockReset();
  fetchMock
    .mockResolvedValueOnce(response({}, 401))
    .mockResolvedValueOnce(response(tokens, 201))
    .mockResolvedValueOnce(response(profile));
  expect(await api.me()).toEqual(profile);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "/backend/users/me",
    "/backend/auth/refresh-token",
    "/backend/users/me",
  ]);
  expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(
    "Bearer access",
  );
});
test("ошибка refresh очищает сессию", async () => {
  await api.login(profile.email, "Password123");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(response({}, 401));
  await expect(api.me()).rejects.toThrow("Сессия истекла");
  expect(hasSession()).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
test("422 не показывает input и не повторяет запись", async () => {
  fetchMock.mockResolvedValue(
    response(
      {
        detail: [{ loc: ["body", "password"], input: "SECRET", msg: "SECRET" }],
      },
      422,
    ),
  );
  await expect(
    api.register({ ...profile, password: "Password123" }),
  ).rejects.toThrow("Пароль: проверьте значение.");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
test("сетевые ошибки отображаются, повтор загрузки восстанавливает профиль", async () => {
  await api.login(profile.email, "Password123");
  fetchMock.mockRejectedValueOnce(new Error("offline"));
  const user = start("/settings");
  await screen.findByRole("alert");
  await user.click(
    screen.getByRole("button", { name: "Повторить", exact: true }),
  );
  await screen.findByDisplayValue("Иван");
});
