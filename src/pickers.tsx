import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll } from "./scroll-lock";

function PickerDialog({
  title,
  close,
  children,
  actions,
  onOpen,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  actions?: ReactNode;
  onOpen?: () => void;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement;
    element.showModal();
    onOpen?.();
    const unlock = lockBodyScroll();
    return () => {
      element.close();
      unlock();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      className="picker-dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section className="picker-panel">
        <header className="picker-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            className="picker-close"
            type="button"
            aria-label="Закрыть выбор"
            onClick={close}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="picker-content">{children}</div>
        {actions && <footer className="picker-actions">{actions}</footer>}
      </section>
    </dialog>,
    document.body,
  );
}

export function ChoicePicker({
  title,
  value,
  options,
  onChange,
  variant,
  disabled = false,
}: {
  title: string;
  value: string;
  options: {
    value: string;
    title: string;
    description?: string;
    icon?: ReactNode;
  }[];
  onChange: (value: string) => void;
  variant: "workplace" | "employee";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const workplace = variant === "workplace";
  return (
    <>
      <button
        type="button"
        className={`picker-trigger ${workplace ? "point-picker" : "employee-picker"}`}
        aria-label={
          workplace && selected
            ? `Выбрать ПВЗ. Рабочая точка: ${selected.title}`
            : undefined
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span>
          {workplace && selected ? "Выбрать ПВЗ" : selected?.title || title}
        </span>
        <span className="picker-chevron" aria-hidden="true" />
      </button>
      {open && (
        <PickerDialog title={title} close={() => setOpen(false)}>
          <ul className="choice-list">
            {options.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  className="choice-option"
                  aria-pressed={option.value === value}
                  onClick={() => {
                    setOpen(false);
                    onChange(option.value);
                  }}
                >
                  {option.icon}
                  <span className="choice-option-text">
                    <strong>{option.title}</strong>
                    {option.description && <span>{option.description}</span>}
                  </span>
                  {option.value === value && (
                    <span className="choice-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </PickerDialog>
      )}
    </>
  );
}

const twoDigits = (value: number) => String(value).padStart(2, "0");
const hours = Array.from({ length: 24 }, (_, index) => twoDigits(index));
const minutes = Array.from({ length: 60 }, (_, index) => twoDigits(index));
const halfHours = ["00", "30"];

function TimeWheel({
  label,
  options,
  value,
  onChange,
  list,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  list: RefObject<HTMLDivElement | null>;
}) {
  const selected = Math.max(0, options.indexOf(value));
  const selectedId = useId();

  function choose(index: number) {
    const next = Math.max(0, Math.min(index, options.length - 1));
    centerWheel(list.current, next);
    onChange(options[next]);
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const targetIndex = {
      ArrowUp: selected - 1,
      ArrowDown: selected + 1,
      PageUp: selected - 3,
      PageDown: selected + 3,
      Home: 0,
      End: options.length - 1,
    }[event.key];
    if (targetIndex === undefined) return;
    event.preventDefault();
    choose(targetIndex);
  }

  return (
    <div
      className={`time-wheel${options.length === 2 ? " time-wheel-short" : ""}`}
    >
      <span aria-hidden="true">{label}</span>
      <div className="time-wheel-frame">
        <div
          className="time-wheel-list"
          ref={list}
          tabIndex={0}
          role="listbox"
          aria-label={label}
          aria-activedescendant={selectedId}
          onKeyDown={onKeyDown}
          onScroll={(event) => {
            onChange(valueAtCenter(event.currentTarget, options, value));
          }}
        >
          {options.map((option, index) => (
            <button
              key={option}
              id={index === selected ? selectedId : undefined}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={index === selected}
              className="time-wheel-option"
              onClick={() => {
                choose(index);
                list.current?.focus({ preventScroll: true });
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function centerWheel(list: HTMLDivElement | null, index: number) {
  const row = list?.firstElementChild;
  if (list && row) list.scrollTop = index * row.getBoundingClientRect().height;
}

function valueAtCenter(
  list: HTMLDivElement | null,
  options: string[],
  fallback: string,
) {
  const rowHeight = list?.firstElementChild?.getBoundingClientRect().height;
  if (!list || !rowHeight) return fallback;
  const index = Math.round(list.scrollTop / rowHeight);
  return options[Math.max(0, Math.min(index, options.length - 1))];
}

function TimeDialog({
  label,
  value,
  step,
  close,
  apply,
}: {
  label: string;
  value: string;
  step: 1 | 30;
  close: () => void;
  apply: (value: string) => void;
}) {
  const [initialHour, initialMinute] = value.split(":");
  const minuteOptions = step === 30 ? halfHours : minutes;
  const [hour, setHour] = useState(
    hours.includes(initialHour) ? initialHour : "00",
  );
  const [minute, setMinute] = useState(
    minuteOptions.includes(initialMinute) ? initialMinute : "00",
  );
  const hourList = useRef<HTMLDivElement>(null);
  const minuteList = useRef<HTMLDivElement>(null);
  function applyTime() {
    const nextHour = valueAtCenter(hourList.current, hours, hour);
    const nextMinute = valueAtCenter(minuteList.current, minuteOptions, minute);
    apply(`${nextHour}:${nextMinute}`);
  }
  return (
    <PickerDialog
      title={label}
      close={close}
      onOpen={() => {
        centerWheel(hourList.current, hours.indexOf(hour));
        centerWheel(minuteList.current, minuteOptions.indexOf(minute));
      }}
      actions={
        <>
          <button className="picker-cancel" type="button" onClick={close}>
            Отмена
          </button>
          <button className="primary" type="button" onClick={applyTime}>
            Готово
          </button>
        </>
      }
    >
      <div className="time-wheels">
        <TimeWheel
          label="Часы"
          list={hourList}
          options={hours}
          value={hour}
          onChange={setHour}
        />
        <TimeWheel
          label="Минуты"
          list={minuteList}
          options={minuteOptions}
          value={minute}
          onChange={setMinute}
        />
      </div>
    </PickerDialog>
  );
}

export function TimeField({
  label,
  caption,
  value,
  onChange,
  step,
}: {
  label: string;
  caption: string;
  value: string;
  onChange: (value: string) => void;
  step: 1 | 30;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="time-trigger"
        type="button"
        aria-label={`${label}: ${value}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span>{caption}</span>
        <strong>{value}</strong>
        <span className="picker-chevron" aria-hidden="true" />
      </button>
      {open && (
        <TimeDialog
          label={label}
          value={value}
          step={step}
          close={() => setOpen(false)}
          apply={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
