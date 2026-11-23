import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import type { ChatMessage, ChatSummary } from "../src/api";
import { calendarFixture, employee, owner, tokens } from "./fixtures/calendar";

const direct: ChatSummary = {
  id: 2,
  type: "direct",
  workplace_id: null,
  title: "Петров Пётр",
  is_readonly: false,
  unread_count: 0,
  last_message_text: null,
  last_message_at: null,
};
const workplace: ChatSummary = {
  ...direct,
  id: 1,
  type: "workplace",
  workplace_id: 11,
  title: "Машинная",
};

function message(
  id: number,
  text: string,
  options: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id,
    chat_id: direct.id,
    sender_id: employee.user_id,
    sender_name: direct.title,
    text,
    created_at: new Date(Date.UTC(2026, 10, 18, 16, 0, id)).toISOString(),
    ...options,
  };
}

async function chatFixture(
  page: Page,
  initial: ChatSummary[] = [],
  messages: ChatMessage[] = [],
) {
  const calendar = calendarFixture();
  const chats = structuredClone(initial);
  const connections: { socket: WebSocketRoute; frames: unknown[] }[] = [];
  const directRequests: unknown[] = [];
  const historyRequests: string[] = [];
  const readRequests: number[] = [];
  const refreshRequests: unknown[] = [];
  const renewedTokens = { ...tokens, access_token: "renewed-access" };
  const pathOf = (url: URL) => url.pathname.replace(/^\/backend/, "");

  await page.addInitScript((session) => {
    sessionStorage.setItem("shift-calendar.session", JSON.stringify(session));
  }, tokens);
  await page.routeWebSocket("**/backend/chats/ws", (socket) => {
    const frames: unknown[] = [];
    connections.push({ socket, frames });
    socket.onMessage((frame) => frames.push(JSON.parse(frame.toString())));
  });
  await page.route("**/backend/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = pathOf(url);
    const body = request.postData() ? request.postDataJSON() : undefined;
    if (path === "/auth/refresh-token") {
      refreshRequests.push(body);
      return route.fulfill({ json: renewedTokens });
    }
    if (path === "/chats/") return route.fulfill({ json: chats });
    if (path === "/chats/direct" && request.method() === "POST") {
      directRequests.push(body);
      if (!chats.some(({ id }) => id === direct.id)) chats.push({ ...direct });
      return route.fulfill({ json: { chat_id: direct.id } });
    }
    const chatPath = /^\/chats\/(\d+)\/(messages|mark)$/.exec(path);
    if (chatPath) {
      const id = Number(chatPath[1]);
      if (id === 1) return route.fulfill({ status: 422, json: { detail: [] } });
      let history = messages.filter(({ chat_id }) => chat_id === id);
      if (chatPath[2] === "mark") {
        readRequests.push(id);
        const chat = chats.find((item) => item.id === id)!;
        chat.unread_count = 0;
        return route.fulfill({
          json: { last_read_message_id: history.at(-1)?.id ?? 0 },
        });
      }
      historyRequests.push(url.search);
      const before = url.searchParams.get("before_id");
      if (before)
        history = history.filter(
          ({ id: messageId }) => messageId < Number(before),
        );
      const limit = Number(url.searchParams.get("limit"));
      return route.fulfill({ json: { messages: history.slice(-limit) } });
    }
    return route.fulfill(
      calendar.respond(request.url(), request.method(), body),
    );
  });

  function publish(item: ChatMessage, socket?: WebSocketRoute) {
    messages.push(item);
    const chat = chats.find(({ id }) => id === item.chat_id)!;
    chat.last_message_text = item.text;
    chat.last_message_at = item.created_at;
    if (item.sender_id !== owner.id) chat.unread_count += 1;
    socket?.send(JSON.stringify({ type: "new_message", data: item }));
  }

  return {
    connections,
    directRequests,
    historyRequests,
    readRequests,
    refreshRequests,
    publish,
  };
}

test("личный чат из сотрудников показывает подтверждённые сообщения и время в списке", async ({
  page,
}) => {
  const fixture = await chatFixture(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/employees?workplace=11");
  await page.getByRole("button", { name: `Написать: ${direct.title}` }).click();
  await expect(page).toHaveURL(/\/chats\/2$/);
  await expect(page.getByRole("heading", { name: direct.title })).toBeVisible();
  expect(fixture.directRequests).toEqual([
    { target_user_id: employee.user_id },
  ]);

  await expect
    .poll(() => fixture.connections[0]?.frames)
    .toEqual([{ type: "auth", token: tokens.access_token }]);
  const { socket, frames } = fixture.connections[0];
  expect(new URL(socket.url()).search).toBe("");
  socket.send(JSON.stringify({ type: "ping" }));
  await expect.poll(() => frames.at(-1)).toEqual({ type: "pong" });

  const draft = page.getByRole("textbox", { name: "Сообщение" });
  const send = page.getByRole("button", { name: "Отправить", exact: true });
  const feed = page.getByRole("list", { name: "Сообщения", exact: true });
  const outgoing = message(1, "Выйдешь завтра?", { sender_id: owner.id });
  await draft.fill(`  ${outgoing.text}  `);
  await send.click();
  await expect
    .poll(() => frames.at(-1))
    .toEqual({ type: "message", chat_id: 2, text: outgoing.text });
  await expect(feed.getByText(outgoing.text)).toHaveCount(0);
  fixture.publish(outgoing, socket);
  await expect(feed.getByText(outgoing.text)).toHaveCount(1);
  await expect(draft).toHaveValue("");

  await page.getByRole("link", { name: "К чатам" }).click();
  const entry = page.getByRole("link", { name: new RegExp(direct.title) });
  await expect(entry).toContainText(outgoing.text);
  await expect(entry.locator("time")).toHaveAttribute(
    "datetime",
    outgoing.created_at,
  );
  const incoming = message(2, "Да, с 9:00");
  fixture.publish(incoming, socket);
  await expect(entry).toContainText(incoming.text);
  await expect(entry.locator("time")).toHaveAttribute(
    "datetime",
    incoming.created_at,
  );
  await expect(entry.getByLabel("Непрочитанных: 1")).toBeVisible();
  await entry.click();
  await expect(feed.getByText(outgoing.text)).toHaveCount(1);
  await expect(feed.getByText(incoming.text)).toHaveCount(1);
  await expect.poll(() => fixture.readRequests).toContain(direct.id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await expect(draft).toBeInViewport();
  await page.getByRole("link", { name: "Сотрудники", exact: true }).click();
  await page.getByRole("button", { name: `Написать: ${direct.title}` }).click();
  await expect(page).toHaveURL(/\/chats\/2$/);
  await expect(feed.getByText(outgoing.text)).toHaveCount(1);
});

test("ошибка отправки сохраняет черновик, переподключение обновляет токен и историю", async ({
  page,
}) => {
  const first = message(1, "Первое сообщение");
  const fixture = await chatFixture(page, [direct], [first]);
  await page.goto("/chats/2");
  const feed = page.getByRole("list", { name: "Сообщения", exact: true });
  await expect(feed.getByText(first.text)).toBeVisible();
  await expect
    .poll(() => fixture.connections[0]?.frames)
    .toEqual([{ type: "auth", token: tokens.access_token }]);
  const { socket, frames } = fixture.connections[0];
  const draft = page.getByRole("textbox", { name: "Сообщение" });
  const send = page.getByRole("button", { name: "Отправить", exact: true });
  await draft.fill("Черновик");
  await send.click();
  await expect
    .poll(() => frames.at(-1))
    .toEqual({ type: "message", chat_id: 2, text: "Черновик" });
  socket.send(JSON.stringify({ type: "error", detail: "rate_limit" }));
  await expect(page.getByText(/Подождите секунду/)).toBeVisible();
  await expect(draft).toHaveValue("Черновик");

  const historyCount = fixture.historyRequests.length;
  await send.click();
  await expect.poll(() => frames.length).toBe(3);
  const missed = message(2, "Сообщение во время обрыва");
  fixture.publish(missed);
  await socket.close({ code: 4003 });
  await expect(page.getByText(/Восстанавливаем связь/)).toBeVisible();
  await expect(page.getByText(/Нет подтверждения отправки/)).toBeVisible();
  await expect
    .poll(() => fixture.connections[1]?.frames)
    .toEqual([{ type: "auth", token: "renewed-access" }]);
  expect(fixture.refreshRequests).toEqual([
    { refresh_token: tokens.refresh_token },
  ]);
  await expect(feed.getByText(missed.text)).toHaveCount(1);
  await expect(feed.getByText(first.text)).toHaveCount(1);
  expect(fixture.historyRequests.length).toBeGreaterThan(historyCount);
  await expect(draft).toHaveValue("Черновик");
  expect(fixture.connections[1].frames).toHaveLength(1);
});

test("ранняя история запрашивается по before_id, закрытый чат доступен только для чтения", async ({
  page,
}) => {
  const messages = Array.from({ length: 51 }, (_, index) =>
    message(index + 1, `Сообщение ${index + 1}`),
  );
  const fixture = await chatFixture(
    page,
    [{ ...direct, is_readonly: true }, workplace],
    messages,
  );
  await page.goto("/chats/2");
  const feed = page.getByRole("list", { name: "Сообщения", exact: true });
  await expect(feed.getByText("Сообщение 51", { exact: true })).toHaveCount(1);
  await expect(feed.getByText("Сообщение 1", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Этот чат доступен только для чтения."),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Сообщение" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ранние сообщения" }).click();
  await expect(feed.getByText("Сообщение 1", { exact: true })).toHaveCount(1);
  expect(fixture.historyRequests).toContain("?limit=50&before_id=2");

  await page.getByRole("link", { name: "К чатам" }).click();
  await page.getByRole("link", { name: /Машинная/ }).click();
  await expect(page.getByText(/Сервер пока не отдаёт историю/)).toBeVisible();
  fixture.publish(
    message(52, "ПВЗ открыт", { chat_id: 1 }),
    fixture.connections[0].socket,
  );
  await expect(feed.getByText("ПВЗ открыт")).toBeVisible();
  expect(fixture.readRequests).not.toContain(1);
});
