import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type ChatMessage, type ChatSummary } from "./api";
import { dateString } from "./calendar-utils";
import { useChatSocket } from "./chat-socket";
import {
  Empty,
  LoadState,
  positiveId,
  useMutation,
  useResource,
} from "./management-ui";
import { Icon, Notice } from "./ui";
import "./chats.css";

const pageSize = 50;
const noMessages: ChatMessage[] = [];
const timeFormat = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});
const shortDateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
});
const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function parseMessageTime(value: string) {
  // PostgreSQL returns an offset. Treat date-times without one as UTC as well.
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
}

function MessageTime({
  value,
  showDate = false,
}: {
  value: string;
  showDate?: boolean;
}) {
  const date = parseMessageTime(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const older = showDate && dateString(date) !== dateString(now);
  const day =
    date.getFullYear() === now.getFullYear()
      ? shortDateFormat.format(date)
      : date.toLocaleDateString("ru-RU");
  const time = timeFormat.format(date);
  return (
    <time
      dateTime={date.toISOString()}
      title={`${dateFormat.format(date)}, ${time}`}
    >
      {older ? `${day}, ${time}` : time}
    </time>
  );
}

function ChatAvatar({ chat }: { chat: ChatSummary }) {
  return (
    <span className={`chat-avatar chat-avatar-${chat.type}`} aria-hidden="true">
      {chat.type === "workplace" ? (
        <Icon name="home" />
      ) : (
        chat.title
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => Array.from(part)[0])
          .join("")
          .toLocaleUpperCase("ru-RU")
      )}
    </span>
  );
}

export function Chats() {
  const { chatId: rawChatId } = useParams();
  const chatId = positiveId(rawChatId);
  const profile = useResource("chat-profile", api.me);
  const chats = useResource("chats", api.chats.list, { keepData: true });
  const [syncVersion, setSyncVersion] = useState(0);
  const [live, setLive] = useState<{
    chatId: number;
    messages: ChatMessage[];
  }>();
  const [listNeedsRefresh, setListNeedsRefresh] = useState(false);
  const retryList = chats.retry;

  const refreshList = useCallback(() => setListNeedsRefresh(true), []);
  useEffect(() => {
    if (!listNeedsRefresh || chats.loading) return;
    const timer = window.setTimeout(() => {
      setListNeedsRefresh(false);
      retryList();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [chats.loading, listNeedsRefresh, retryList]);
  useEffect(() => setLive(undefined), [chatId]);

  const socket = useChatSocket(
    profile.data?.id,
    (message) => {
      if (message.chat_id === chatId) {
        setLive((previous) => ({
          chatId,
          messages:
            previous?.chatId === chatId
              ? [...previous.messages, message]
              : [message],
        }));
      }
      refreshList();
    },
    () => {
      setSyncVersion((version) => version + 1);
      refreshList();
    },
  );

  if (rawChatId === undefined)
    return (
      <ChatList
        chats={chats}
        connection={socket.state}
        profileError={profile.error}
        retryProfile={profile.retry}
      />
    );

  const chat = chats.data?.find((item) => item.id === chatId);
  if (chat && profile.data) {
    return (
      <Conversation
        key={chat.id}
        chat={chat}
        userId={profile.data.id}
        live={live?.chatId === chat.id ? live.messages : noMessages}
        syncVersion={syncVersion}
        socket={socket}
        refreshList={refreshList}
      />
    );
  }
  return (
    <main className="page workspace-page">
      <Link className="back" to="/chats">
        К чатам
      </Link>
      <h1>Чат</h1>
      <LoadState {...(chats.data ? profile : chats)} />
      {chats.data && !chat && (
        <Notice text="Чат не найден или у вас больше нет доступа." error />
      )}
    </main>
  );
}

type Socket = ReturnType<typeof useChatSocket>;
function ConnectionStatus({ state }: { state: Socket["state"] }) {
  if (state === "connected") return null;
  return (
    <p className="chat-connection" role="status">
      {state === "reconnecting"
        ? "Восстанавливаем связь…"
        : "Подключаемся к сообщениям…"}
    </p>
  );
}

function ChatList({
  chats,
  connection,
  profileError,
  retryProfile,
}: {
  chats: ReturnType<typeof useResource<ChatSummary[]>>;
  connection: Socket["state"];
  profileError: string;
  retryProfile: () => void;
}) {
  return (
    <main className="page workspace-page chat-list-page">
      <header className="page-heading">
        <h1>Чаты</h1>
      </header>
      {profileError ? (
        <LoadState loading={false} error={profileError} retry={retryProfile} />
      ) : (
        <ConnectionStatus state={connection} />
      )}
      {(!chats.data || chats.error) && <LoadState {...chats} />}
      {chats.data &&
        (chats.data.length ? (
          <ul className="chat-list" aria-label="Список чатов">
            {chats.data.map((chat) => (
              <li key={chat.id}>
                <Link to={`/chats/${chat.id}`} className="chat-list-entry">
                  <ChatAvatar chat={chat} />
                  <span className="chat-list-content">
                    <strong>{chat.title}</strong>
                    <span>
                      {chat.last_message_text ?? "Сообщений пока нет"}
                    </span>
                  </span>
                  <span className="chat-list-meta">
                    {chat.last_message_at && (
                      <MessageTime value={chat.last_message_at} showDate />
                    )}
                    {chat.unread_count > 0 && (
                      <span
                        className="chat-unread"
                        aria-label={`Непрочитанных: ${chat.unread_count}`}
                      >
                        {chat.unread_count > 99 ? "99+" : chat.unread_count}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            <p>У вас пока нет чатов</p>
            <Link to="/employees">Найти сотрудника</Link>
          </Empty>
        ))}
    </main>
  );
}

function Conversation({
  chat,
  userId,
  live,
  syncVersion,
  socket,
  refreshList,
}: {
  chat: ChatSummary;
  userId: number;
  live: ChatMessage[];
  syncVersion: number;
  socket: Socket;
  refreshList: () => void;
}) {
  const history = useResource<{
    messages: ChatMessage[];
    unavailable?: boolean;
  }>(
    `chat-${chat.id}`,
    async () => {
      try {
        return await api.chats.messages(chat.id, pageSize);
      } catch (error) {
        if (chat.id === 1 && error instanceof ApiError && error.status === 422)
          return { messages: [], unavailable: true };
        throw error;
      }
    },
    { keepData: true, refreshVersion: syncVersion },
  );
  const loadOlder = useMutation();
  const send = useMutation();
  const mark = useMutation();
  const [draft, setDraft] = useState("");
  const [older, setOlder] = useState<{
    version: number;
    messages: ChatMessage[];
    more: boolean;
  }>();
  const feed = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const prependFrom = useRef<{ version: number; height: number; top: number }>(
    undefined,
  );
  const readThrough = useRef(0);
  const [visible, setVisible] = useState(!document.hidden);
  const earlier = older?.version === syncVersion ? older : undefined;
  const recent = history.data?.messages ?? noMessages;
  const messages = useMemo(() => {
    const items = new Map<number, ChatMessage>();
    // Page from the latest REST window after reconnecting, even after a long gap.
    const firstRecentId = recent.length === pageSize ? recent[0].id : 0;
    for (const message of [...(earlier?.messages ?? []), ...recent]) {
      items.set(message.id, message);
    }
    for (const message of live) {
      if (message.id >= firstRecentId) items.set(message.id, message);
    }
    return Array.from(items.values()).sort((a, b) => a.id - b.id);
  }, [earlier, recent, live]);
  const newestIncoming = messages.reduce(
    (id, message) => (message.sender_id === userId ? id : message.id),
    0,
  );

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (
      !visible ||
      !history.data ||
      history.data.unavailable ||
      mark.busy ||
      newestIncoming <= readThrough.current
    )
      return;
    readThrough.current = newestIncoming;
    void mark.run(
      () => api.chats.markRead(chat.id),
      ({ last_read_message_id }) => {
        readThrough.current = Math.max(
          readThrough.current,
          last_read_message_id,
        );
        refreshList();
      },
    );
  }, [chat.id, history.data, mark.busy, newestIncoming, refreshList, visible]);

  useLayoutEffect(() => {
    const element = feed.current;
    if (!element) return;
    const anchor = prependFrom.current;
    prependFrom.current = undefined;
    if (anchor?.version === syncVersion)
      element.scrollTop = anchor.top + element.scrollHeight - anchor.height;
    else if (followLatest.current) element.scrollTop = element.scrollHeight;
  }, [messages, syncVersion]);

  const hasOlder = earlier?.more ?? recent.length === pageSize;
  function showOlder() {
    const firstId = messages[0]?.id;
    if (!firstId) return;
    void loadOlder.run(
      () => api.chats.messages(chat.id, pageSize, firstId),
      ({ messages: previous }) => {
        if (feed.current) {
          prependFrom.current = {
            version: syncVersion,
            height: feed.current.scrollHeight,
            top: feed.current.scrollTop,
          };
        }
        setOlder({
          version: syncVersion,
          messages: [...previous, ...(earlier?.messages ?? [])],
          more: previous.length === pageSize,
        });
      },
    );
  }

  const trimmed = draft.trim();
  const tooLong = Array.from(trimmed).length > 4000;
  const canWrite = !chat.is_readonly && history.data !== null;
  const canSend =
    canWrite &&
    socket.state === "connected" &&
    !send.busy &&
    !!trimmed &&
    !tooLong;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    followLatest.current = true;
    void send.run(
      () => socket.send(chat.id, trimmed),
      () => setDraft((current) => (current === draft ? "" : current)),
    );
  }

  return (
    <main className="page workspace-page conversation-page">
      <header className="conversation-heading">
        <Link className="back" to="/chats">
          К чатам
        </Link>
        <div className="conversation-title">
          <ChatAvatar chat={chat} />
          <h1>{chat.title}</h1>
        </div>
        <ConnectionStatus state={socket.state} />
      </header>
      <div
        className="chat-feed"
        ref={feed}
        onScroll={(event) => {
          const element = event.currentTarget;
          followLatest.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            80;
        }}
      >
        {(!history.data || history.error) && <LoadState {...history} />}
        {history.data?.unavailable && (
          <Notice text="Сервер пока не отдаёт историю этого чата. Новые сообщения появятся здесь." />
        )}
        {hasOlder && (
          <>
            <button
              className="text-button chat-older"
              type="button"
              disabled={loadOlder.busy}
              onClick={showOlder}
            >
              {loadOlder.busy ? "Загружаем…" : "Ранние сообщения"}
            </button>
            <Notice text={loadOlder.error} error />
          </>
        )}
        {history.data && !history.data.unavailable && messages.length === 0 && (
          <Empty>
            <p>Сообщений пока нет</p>
          </Empty>
        )}
        <ol className="chat-messages" aria-label="Сообщения" aria-live="polite">
          {messages.map((message, index) => {
            const mine = message.sender_id === userId;
            const date = parseMessageTime(message.created_at);
            const previous = messages[index - 1];
            const showDay =
              !Number.isNaN(date.getTime()) &&
              (!previous ||
                dateString(date) !==
                  dateString(parseMessageTime(previous.created_at)));
            return (
              <Fragment key={message.id}>
                {showDay && (
                  <li className="chat-day">{dateFormat.format(date)}</li>
                )}
                <li
                  className={`chat-message${mine ? " chat-message-mine" : ""}`}
                >
                  {!mine && chat.type === "workplace" && (
                    <strong>{message.sender_name}</strong>
                  )}
                  <p>{message.text}</p>
                  <MessageTime value={message.created_at} />
                </li>
              </Fragment>
            );
          })}
        </ol>
      </div>
      {chat.is_readonly && (
        <p className="chat-readonly">Этот чат доступен только для чтения.</p>
      )}
      {canWrite && (
        <form className="chat-composer" onSubmit={submit} aria-busy={send.busy}>
          <Notice
            text={
              send.error ||
              (tooLong ? "Сократите сообщение до 4000 символов." : "")
            }
            error
          />
          <div>
            <label className="sr-only" htmlFor="chat-text">
              Сообщение
            </label>
            <textarea
              id="chat-text"
              rows={2}
              value={draft}
              placeholder="Сообщение"
              aria-invalid={tooLong || undefined}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button className="primary" type="submit" disabled={!canSend}>
              {send.busy ? "Отправляем…" : "Отправить"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
