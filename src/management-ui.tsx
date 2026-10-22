import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasSession } from "./api";
import { Notice } from "./ui";
import { logos } from "./assets";

export function positiveId(value: string | undefined | null) {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
export function useSessionError() {
  const navigate = useNavigate();
  return (error: unknown): string => {
    if (!hasSession())
      navigate("/login", {
        replace: true,
        state: { message: "Сессия истекла. Войдите снова." },
      });
    return error instanceof Error
      ? error.message
      : "Не удалось выполнить запрос.";
  };
}
// key identifies all inputs of the request. Ignore responses from a previous route or retry.
export function useResource<T>(key: string, load: () => Promise<T>) {
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    loading: boolean;
    error: string;
  }>({ key, data: null, loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);
  const fail = useSessionError();
  useEffect(() => {
    let active = true;
    setState({ key, data: null, loading: true, error: "" });
    load()
      .then((data) => {
        if (active) setState({ key, data, loading: false, error: "" });
      })
      .catch((error) => {
        if (active)
          setState({ key, data: null, loading: false, error: fail(error) });
      });
    return () => {
      active = false;
    };
  }, [key, attempt]);
  const visible =
    state.key === key ? state : { data: null, loading: true, error: "" };
  return {
    data: visible.data,
    loading: visible.loading,
    error: visible.error,
    retry: () => setAttempt((value) => value + 1),
  };
}
export function LoadState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  return loading ? (
    <p className="loading" role="status">
      Загружаем данные…
    </p>
  ) : error ? (
    <>
      <Notice text={error} error />
      <button className="primary" onClick={retry}>
        Повторить
      </button>
    </>
  ) : null;
}
export function MarketBadge({ type }: { type: string }) {
  return logos[type] ? (
    <img
      className="market-badge"
      src={logos[type]}
      alt=""
      width="40"
      height="40"
    />
  ) : (
    <span className="market-badge market-other" aria-hidden="true">
      ПВЗ
    </span>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
export function DeleteDialog({
  title,
  description,
  busy,
  cancel,
  confirm,
}: {
  title: string;
  description: string;
  busy: boolean;
  cancel: () => void;
  confirm: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    if (busy) ref.current?.focus();
  }, [busy]);
  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) cancel();
      }}
    >
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-busy={busy}
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
        ref={ref}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (!busy) cancel();
          }
          if (event.key === "Tab") {
            const buttons = ref.current?.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            );
            if (!buttons?.length) {
              event.preventDefault();
              return;
            }
            const first = buttons[0],
              last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <h2 id="delete-title">{title}</h2>
        <p id="delete-description">{description}</p>
        <div className="dialog-actions">
          <button className="secondary" disabled={busy} onClick={cancel}>
            Оставить
          </button>
          <button
            className="primary danger-fill"
            disabled={busy}
            onClick={confirm}
          >
            {busy ? "Удаляем…" : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}
