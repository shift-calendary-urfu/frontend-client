import { useEffect, useEffectEvent, useRef, useState } from "react";
import { api, hasSession, type ChatMessage } from "./api";
import { useSessionError } from "./management-ui";

type ConnectionState = "connecting" | "connected" | "reconnecting";
type PendingMessage = {
  chatId: number;
  text: string;
  timer: number;
  resolve: () => void;
  reject: (error: Error) => void;
};

const interrupted =
  "Нет подтверждения отправки. Проверьте историю перед повторной отправкой.";

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<ChatMessage>;
  return (
    Number.isSafeInteger(message.id) &&
    Number.isSafeInteger(message.chat_id) &&
    (message.sender_id === null || Number.isSafeInteger(message.sender_id)) &&
    typeof message.sender_name === "string" &&
    typeof message.text === "string" &&
    typeof message.created_at === "string"
  );
}

export function useChatSocket(
  userId: number | undefined,
  receive: (message: ChatMessage) => void,
  sync: () => void,
) {
  const [state, setState] = useState<ConnectionState>("connecting");
  const activeSocket = useRef<WebSocket | null>(null);
  const pending = useRef<PendingMessage | null>(null);
  const onMessage = useEffectEvent(receive);
  const onConnect = useEffectEvent(sync);
  const sessionError = useEffectEvent(useSessionError());

  function finish(error?: Error) {
    const message = pending.current;
    if (!message) return;
    pending.current = null;
    window.clearTimeout(message.timer);
    if (error) message.reject(error);
    else message.resolve();
  }

  useEffect(() => {
    if (userId === undefined) return;
    let disposed = false;
    let attempt = 0;
    let retryTimer: number | undefined;
    let connectionTimer: number | undefined;

    function retry() {
      if (disposed || !hasSession()) return;
      setState("reconnecting");
      const delay = Math.min(1000 * 2 ** attempt, 15000);
      attempt += 1;
      retryTimer = window.setTimeout(connect, delay);
    }

    function connect() {
      if (disposed || !hasSession()) return;
      let connection: ReturnType<typeof api.chats.connect>;
      try {
        connection = api.chats.connect();
      } catch {
        retry();
        return;
      }
      const { socket } = connection;
      activeSocket.current = socket;
      connectionTimer = window.setTimeout(() => socket.close(), 10000);

      socket.addEventListener("open", () => {
        window.clearTimeout(connectionTimer);
        if (disposed || socket.readyState !== WebSocket.OPEN) return;
        setState("connected");
        onConnect();
      });
      socket.addEventListener("message", ({ data }) => {
        if (disposed || typeof data !== "string") return;
        let event: { type?: string; data?: unknown; detail?: unknown } | null;
        try {
          event = JSON.parse(data);
        } catch {
          return;
        }
        switch (event?.type) {
          case "ping":
            attempt = 0;
            if (socket.readyState === WebSocket.OPEN)
              socket.send(JSON.stringify({ type: "pong" }));
            break;
          case "new_message": {
            if (!isChatMessage(event.data)) return;
            attempt = 0;
            const message = event.data;
            onMessage(message);
            const submitted = pending.current;
            if (
              submitted &&
              message.chat_id === submitted.chatId &&
              message.sender_id === userId &&
              message.text === submitted.text
            )
              finish();
            break;
          }
          case "error": {
            const detail = event.detail;
            finish(
              new Error(
                detail === "rate_limit"
                  ? "Подождите секунду перед отправкой следующего сообщения."
                  : typeof detail === "string" && detail
                    ? detail
                    : "Сервер отклонил сообщение.",
              ),
            );
            break;
          }
        }
      });
      socket.addEventListener("close", async ({ code }) => {
        window.clearTimeout(connectionTimer);
        if (disposed || activeSocket.current !== socket) return;
        activeSocket.current = null;
        setState("reconnecting");
        finish(new Error(interrupted));
        if (code === 4003) {
          try {
            await connection.renewAuth();
          } catch (error) {
            if (!disposed && !hasSession()) sessionError(error);
          }
        }
        retry();
      });
    }

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(connectionTimer);
      activeSocket.current?.close();
      activeSocket.current = null;
      finish(new Error(interrupted));
    };
  }, [userId]);

  function send(chatId: number, text: string) {
    return new Promise<void>((resolve, reject) => {
      const socket = activeSocket.current;
      if (socket?.readyState !== WebSocket.OPEN) {
        reject(
          new Error("Соединение с чатом восстанавливается. Попробуйте снова."),
        );
        return;
      }
      if (pending.current) {
        reject(new Error("Дождитесь подтверждения предыдущего сообщения."));
        return;
      }
      pending.current = {
        chatId,
        text,
        resolve,
        reject,
        timer: window.setTimeout(() => finish(new Error(interrupted)), 10000),
      };
      try {
        socket.send(JSON.stringify({ type: "message", chat_id: chatId, text }));
      } catch {
        finish(new Error("Не удалось отправить сообщение. Попробуйте снова."));
      }
    });
  }

  return { state, send };
}
