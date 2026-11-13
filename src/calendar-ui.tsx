import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Employee, Shift, WorkplaceDetailData } from "./api";
import { lockBodyScroll } from "./scroll-lock";
import {
  dateLabel,
  dateString,
  dayPath,
  monthCells,
  monthLabel,
  moveMonth,
  parseDate,
  shiftName,
  timeLabel,
  timelineRange,
  timeMinutes,
} from "./calendar-utils";

export type CalendarContext = {
  point: WorkplaceDetailData;
  employees: Employee[];
  canManage: boolean;
  revision: number;
  refreshCalendar: () => void;
};
const CalendarData = createContext<CalendarContext | null>(null);
// One context is shared by the month behind the sheet and the routed sheet itself.
export const CalendarDataProvider = CalendarData.Provider;
export function useCalendar() {
  const context = useContext(CalendarData);
  if (!context) throw new Error("Calendar context is missing");
  return context;
}
export function colorClass(employeeId: number, employees: Employee[]) {
  const index = [...new Set(employees.map((item) => item.id))]
    .sort((a, b) => a - b)
    .indexOf(employeeId);
  return `calendar-color-${(index < 0 ? employeeId : index) % 3}`;
}
export function monthName(month: string) {
  const name = parseDate(`${month}-01`)!.toLocaleDateString("ru-RU", {
    month: "long",
  });
  return name[0].toUpperCase() + name.slice(1);
}
function adjacentLabel(month: string, adjacent: string) {
  return `${monthName(adjacent)}${month.slice(0, 4) !== adjacent.slice(0, 4) ? ` ${adjacent.slice(2, 4)} г.` : ""}`;
}
export function Weekdays() {
  return (
    <div className="calendar-weekdays" aria-hidden="true">
      {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((day) => (
        <span key={day}>{day}</span>
      ))}
    </div>
  );
}
export function MonthNavigation({
  month,
  change,
  reset,
  resetTitle = "Вернуться к исходному месяцу",
  busy = false,
}: {
  month: string;
  change: (value: string) => void;
  reset?: string;
  resetTitle?: string;
  busy?: boolean;
}) {
  const previous = moveMonth(month, -1),
    next = moveMonth(month, 1);
  const year = month.slice(0, 4);
  const visibleMonth = (
    <>
      {monthName(month)} <span className="month-year">{year}</span>
    </>
  );
  return (
    <div className="calendar-month-nav">
      <button
        type="button"
        aria-label="Предыдущий месяц"
        disabled={busy || !previous}
        onClick={() => previous && change(previous)}
      >
        <span className="month-arrow" aria-hidden="true">
          ‹
        </span>
        <span className="month-adjacent">
          {previous ? adjacentLabel(month, previous) : ""}
        </span>
      </button>
      <h2 aria-label={monthLabel(month)} aria-live="polite">
        {reset ? (
          <button
            type="button"
            title={resetTitle}
            disabled={busy}
            onClick={() => change(reset)}
          >
            {visibleMonth}
          </button>
        ) : (
          visibleMonth
        )}
      </h2>
      <button
        type="button"
        aria-label="Следующий месяц"
        disabled={busy || !next}
        onClick={() => next && change(next)}
      >
        <span className="month-adjacent">
          {next ? adjacentLabel(month, next) : ""}
        </span>
        <span className="month-arrow" aria-hidden="true">
          ›
        </span>
      </button>
    </div>
  );
}
export function ShiftPreview({
  shifts,
  copies = [],
}: {
  shifts: Shift[];
  copies?: Shift[];
}) {
  const { employees } = useCalendar();
  const preview = [
    ...shifts.map((shift) => ({ shift, copy: false })),
    ...copies.map((shift) => ({ shift, copy: true })),
  ];
  const limit = 3;
  const visible = preview.slice(0, limit);
  if (copies.length && !visible.some(({ copy }) => copy))
    visible[limit - 1] = preview[shifts.length];
  return (
    <span className="calendar-preview" aria-hidden="true">
      {visible.map(({ shift, copy }) => (
        <span
          key={`${shift.id}-${copy}`}
          className={`calendar-chip ${colorClass(shift.employee_id, employees)}${copy ? " calendar-copy-preview" : ""}`}
          title={`${shiftName(shift)}: ${timeLabel(shift.start_time)}–${timeLabel(shift.end_time)}`}
        >
          {shift.first_name}
        </span>
      ))}
      {preview.length > limit && (
        <span className="calendar-more">+{preview.length - limit}</span>
      )}
    </span>
  );
}
export function shiftsLabel(shifts: Shift[]) {
  return shifts.length
    ? `смен: ${shifts.length}; ${shifts.map((shift) => `${shiftName(shift)} ${timeLabel(shift.start_time)}–${timeLabel(shift.end_time)}`).join("; ")}`
    : "смен нет";
}
export function MonthGrid({
  month,
  workplace,
  content,
  selected,
  toggle,
  excluded,
  busy = false,
}: {
  month: string;
  workplace: number;
  content?: (date: string) => { visual: ReactNode; label: string };
  selected?: string[];
  toggle?: (date: string) => void;
  excluded?: string;
  busy?: boolean;
}) {
  const today = dateString(new Date());
  return (
    <div
      className="calendar-grid"
      role="group"
      aria-label={toggle ? "Даты копирования" : "Дни месяца"}
    >
      {monthCells(month).map((date, index) => {
        if (!date)
          return (
            <span
              className="calendar-blank"
              key={`blank-${index}`}
              aria-hidden="true"
            />
          );
        const extra = content?.(date);
        const label = `${dateLabel(date)}${extra?.label ? `, ${extra.label}` : ""}${date === excluded ? ", исходный день" : ""}`;
        const className = `calendar-cell${date === today ? " calendar-today" : ""}${selected?.includes(date) ? " calendar-selected" : ""}`;
        const inner = (
          <>
            <span className="calendar-date">{Number(date.slice(-2))}</span>
            {extra?.visual}
          </>
        );
        return toggle ? (
          <button
            key={date}
            type="button"
            className={className}
            aria-label={label}
            aria-pressed={selected?.includes(date) || false}
            disabled={busy || date === excluded}
            onClick={() => toggle(date)}
          >
            {inner}
          </button>
        ) : (
          <Link
            key={date}
            to={dayPath(workplace, date)}
            className={className}
            aria-label={label}
            aria-current={date === today ? "date" : undefined}
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}

export function dayTitle(date: string) {
  const value = parseDate(date)!;
  const label = value.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
  const title =
    date === dateString(new Date())
      ? `Сегодня, ${label}`
      : `${value.toLocaleDateString("ru-RU", { weekday: "long" })}, ${label}`;
  return title[0].toUpperCase() + title.slice(1);
}

export function ShiftTimeline({
  shifts,
  editable = false,
  date,
  selectedIds,
  toggle,
  inspect,
  busy = false,
}: {
  shifts: Shift[];
  editable?: boolean;
  date: string;
  selectedIds?: number[];
  toggle?: (id: number) => void;
  inspect?: (shift: Shift) => void;
  busy?: boolean;
}) {
  const { point, employees } = useCalendar();
  const range = timelineRange(shifts);
  const ticks = Array.from(
    { length: (range.to - range.from) / 60 },
    (_, index) => range.from / 60 + index,
  );
  return (
    <div
      className="shift-timeline"
      role="group"
      aria-label="Расписание сотрудников"
    >
      <div
        className="timeline-axis"
        style={{ "--timeline-hours": ticks.length } as CSSProperties}
        aria-hidden="true"
      >
        {ticks.map((hour) => (
          <span
            key={hour}
            className={hour % 2 === 0 ? undefined : "timeline-hour-odd"}
          >
            {hour}
          </span>
        ))}
      </div>
      <div className="timeline-rows">
        {[...shifts]
          .sort(
            (a, b) =>
              a.employee_id - b.employee_id ||
              a.start_time.localeCompare(b.start_time) ||
              a.id - b.id,
          )
          .map((shift) => {
            const style = {
              left: `${((timeMinutes(shift.start_time) - range.from) / (range.to - range.from)) * 100}%`,
              width: `${((timeMinutes(shift.end_time) - timeMinutes(shift.start_time)) / (range.to - range.from)) * 100}%`,
            };
            const timing = `${timeLabel(shift.start_time)}–${timeLabel(shift.end_time)}`;
            const description = `${shiftName(shift)} ${timing}`;
            const className = `timeline-bar ${colorClass(shift.employee_id, employees)}${selectedIds && !selectedIds.includes(shift.id) ? " timeline-unselected" : ""}`;
            const title = `${description}${shift.notes ? ` · ${shift.notes}` : ""}`;
            const schedule = (
              <>
                <span className="timeline-caption">
                  <strong>{shiftName(shift)}</strong>
                  <span className="timeline-time">{timing}</span>
                </span>
                <span className="timeline-track" aria-hidden="true">
                  <span className="timeline-segment" style={style} />
                </span>
              </>
            );
            return (
              <div className="timeline-row" key={shift.id}>
                {toggle ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selectedIds?.includes(shift.id) || false}
                    aria-label={description}
                    disabled={busy}
                    className={className}
                    title={title}
                    onClick={() => toggle(shift.id)}
                  >
                    {schedule}
                  </button>
                ) : editable ? (
                  <Link
                    to={`/calendar/${date}/shift/${shift.id}/edit?workplace=${point.id}`}
                    className={className}
                    aria-label={`Редактировать смену ${description}`}
                    title={title}
                    aria-disabled={busy || undefined}
                    tabIndex={busy ? -1 : undefined}
                    onClick={(event) => {
                      if (busy) event.preventDefault();
                    }}
                  >
                    {schedule}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={className}
                    aria-label={`Посмотреть смену ${description}`}
                    title={title}
                    disabled={busy}
                    onClick={() => inspect?.(shift)}
                  >
                    {schedule}
                  </button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

export function CalendarSheet({
  title,
  subtitle,
  children,
  closeTo,
  returnFocus,
  busy = false,
  fullScreen = false,
  footer,
  suspended = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  closeTo: string;
  returnFocus?: string;
  busy?: boolean;
  fullScreen?: boolean;
  footer?: ReactNode;
  suspended?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const close = () => {
    if (!busy && !suspended)
      navigate(closeTo, { replace: true, state: returnFocus ? { returnFocus } : null });
  };
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const unlock = lockBodyScroll();
    ref.current
      ?.querySelector<HTMLButtonElement>("[data-calendar-close]")
      ?.focus({ preventScroll: true });
    return () => {
      unlock();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (busy) ref.current?.focus({ preventScroll: true });
  }, [busy]);
  return (
    <div
      className={`calendar-overlay${fullScreen ? " calendar-overlay-full" : ""}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className={`calendar-sheet${fullScreen ? " copy-sheet" : ""}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy}
        aria-hidden={suspended || undefined}
        inert={suspended}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (suspended) return;
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
          if (event.key === "Tab") {
            const elements = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                'a[href]:not([tabindex="-1"]),button:not(:disabled):not([tabindex="-1"]),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]',
              ) || [],
            ).filter(
              (element) =>
                !element.closest("[hidden],[inert]") &&
                (!element.closest("details:not([open])") ||
                  (element.tagName === "SUMMARY" &&
                    element.parentElement ===
                      element.closest("details:not([open])"))),
            );
            const first = elements[0],
              last = elements[elements.length - 1];
            if (!first) {
              event.preventDefault();
              return;
            }
            if (
              event.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === ref.current)
            ) {
              event.preventDefault();
              last.focus();
            } else if (
              !event.shiftKey &&
              (document.activeElement === last ||
                document.activeElement === ref.current)
            ) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <header className="calendar-sheet-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && (
              <span className="calendar-sheet-subtitle">{subtitle}</span>
            )}
          </div>
          <button
            type="button"
            data-calendar-close
            disabled={busy || suspended}
            onClick={close}
          >
            {fullScreen ? "Отменить" : "Закрыть"}
          </button>
        </header>
        <div className={fullScreen ? "copy-scroll" : "calendar-sheet-content"}>
          {children}
        </div>
        {footer && <footer className="copy-footer">{footer}</footer>}
      </section>
    </div>
  );
}
