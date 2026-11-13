import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { hasSession, type Workplace } from "./api";
import { Notice } from "./ui";
import { logos } from "./assets";
import { ChoicePicker } from "./pickers";
import { lockBodyScroll } from "./scroll-lock";

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
// Lock synchronously and suppress callbacks after leaving the page.
export function useMutation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const mounted = useRef(true);
  const fail = useSessionError();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run<T>(
    task: () => Promise<T>,
    success: (value: T) => void,
    settled?: () => void,
  ) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await task();
      if (mounted.current) success(value);
    } catch (error) {
      if (mounted.current) setError(fail(error));
    } finally {
      locked.current = false;
      if (mounted.current) {
        setBusy(false);
        settled?.();
      }
    }
  }
  return { busy, error, setError, run };
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
export function WorkplacePicker({
  points,
  selected,
  change,
  disabled,
}: {
  points: Workplace[];
  selected?: number;
  change: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <ChoicePicker
      title="Выберите ПВЗ"
      value={selected ? String(selected) : ""}
      onChange={change}
      disabled={disabled}
      variant="workplace"
      options={points.map((point) => ({
        value: String(point.id),
        title: point.name,
        description: point.address || undefined,
        icon: <MarketBadge type={point.workplace_type} />,
      }))}
    />
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
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useLayoutEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current!;
    dialog.showModal();
    keep.current?.focus({ preventScroll: true });
    const unlock = lockBodyScroll();
    return () => {
      dialog.close();
      unlock();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (busy) heading.current?.focus({ preventScroll: true });
  }, [busy]);
  return createPortal(
    <dialog
      className="picker-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-busy={busy}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) cancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) cancel();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
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
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
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
      <section className="picker-panel confirm-dialog">
        <h2 id={titleId} ref={heading} tabIndex={-1}>{title}</h2>
        <div className="picker-content">
          <p id={descriptionId}>{description}</p>
        </div>
        <div className="picker-actions">
          <button ref={keep} className="picker-cancel" type="button" disabled={busy} onClick={cancel}>
            Оставить
          </button>
          <button
            className="primary danger-fill"
            type="button"
            disabled={busy}
            onClick={confirm}
          >
            {busy ? "Удаляем…" : "Удалить"}
          </button>
        </div>
      </section>
    </dialog>,
    document.body,
  );
}
