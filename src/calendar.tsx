import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api, type Shift, type ShiftCalendar, type Workplace } from "./api";
import { canManageEmployees } from "./employees";
import {
  DeleteDialog,
  Empty,
  LoadState,
  MarketBadge,
  WorkplacePicker,
  positiveId,
  useMutation,
  useResource,
} from "./management-ui";
import { Notice } from "./ui";
import { ChoicePicker, TimeField } from "./pickers";
import {
  calendarPath,
  dateLabel,
  dateString,
  dayPath,
  monthBounds,
  parseDate,
  shiftName,
  timeLabel,
  validMonth,
  validateTimes,
} from "./calendar-utils";
import {
  CalendarDataProvider,
  CalendarSheet,
  MonthGrid,
  MonthNavigation,
  ShiftPreview,
  ShiftTimeline,
  Weekdays,
  colorClass,
  dayTitle,
  shiftsLabel,
  useCalendar,
} from "./calendar-ui";

function PointHeader({
  points,
  point,
  disabled,
  change,
}: {
  points: Workplace[];
  point?: Workplace;
  disabled?: boolean;
  change: (id: string) => void;
}) {
  return (
    <div className="selected-point calendar-point">
      {point && (
        <Link to={`/workplaces/${point.id}`} className="selected-point-title">
          <MarketBadge type={point.workplace_type} />
          <h2>{point.name}</h2>
        </Link>
      )}
      <WorkplacePicker
        points={points}
        selected={point?.id}
        change={change}
        disabled={disabled}
      />
    </div>
  );
}
export function CalendarLayout() {
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useSearchParams();
  const pathname = useLocation().pathname.replace(/\/+$/, "");
  const params = useParams();
  const root = pathname === "/calendar";
  const points = useResource("calendar-workplaces", async () => {
    const [items, me] = await Promise.all([api.workplaces.list(), api.me()]);
    return { items, me };
  });
  const raw = search.get("workplace");
  const selected =
    raw === null && root ? points.data?.items[0]?.id : positiveId(raw);
  const point = points.data?.items.find((item) => item.id === selected);
  const detail = useResource(`calendar-point-${point?.id || "none"}`, () =>
    point ? api.workplaces.get(point.id) : Promise.resolve(null),
  );
  const changePoint = (id: string) => {
    const next = new URLSearchParams(search);
    next.set("workplace", id);
    setSearch(next, { state: null });
  };
  if (!points.data)
    return (
      <main className="page workspace-page calendar-page">
        <h1 className="sr-only">Календарь смен</h1>
        <LoadState {...points} />
      </main>
    );
  if (!points.data.items.length)
    return (
      <main className="page workspace-page calendar-page">
        <h1>Календарь смен</h1>
        <Empty>
          <p>Нет доступных ПВЗ</p>
          <p className="hint">
            Создайте точку или дождитесь, когда вас добавят в существующую.
          </p>
          <Link to="/workplaces" className="primary button-link">
            Открыть ПВЗ
          </Link>
        </Empty>
      </main>
    );
  if (!point || !detail.data)
    return (
      <main className="page workspace-page calendar-page">
        <h1 className="sr-only">Календарь смен</h1>
        <PointHeader
          points={points.data.items}
          point={point}
          change={changePoint}
        />
        {point ? (
          <LoadState {...detail} />
        ) : (
          <>
            <Notice
              text="Выберите доступный ПВЗ. В ссылке на этот раздел должна быть указана рабочая точка."
              error
            />
            <Link to="/calendar">Открыть календарь</Link>
          </>
        )}
      </main>
    );
  const employees = detail.data.employees.filter(
    (item) => item.workplace_id === point.id && item.is_active,
  );
  const canManage = canManageEmployees(
    detail.data,
    points.data.me.id,
    employees,
  );
  const validDate = !!params.date && !!parseDate(params.date);
  const validShiftId =
    params.shiftId === undefined || !!positiveId(params.shiftId);
  const form = pathname.includes("/shift/");
  const duplicate = pathname.endsWith("/duplicate");
  return (
    <main className="page workspace-page calendar-page">
      <CalendarDataProvider
        key={point.id}
        value={{
          point: detail.data,
          employees,
          canManage,
          revision,
          refreshCalendar: () => setRevision((value) => value + 1),
        }}
      >
        <div
          className="calendar-background"
          aria-hidden={!root || undefined}
          inert={!root}
        >
          <h1 className="sr-only">Календарь смен</h1>
          <PointHeader
            points={points.data.items}
            point={point}
            disabled={!root}
            change={changePoint}
          />
          {root ? (
            <Outlet />
          ) : (
            validDate &&
            validShiftId &&
            !duplicate &&
            (!form || canManage) && (
              <CalendarMonth
                monthOverride={params.date!.slice(0, 7)}
                background
              />
            )
          )}
        </div>
        {!root && <Outlet />}
      </CalendarDataProvider>
    </main>
  );
}
function InvalidCalendar() {
  return (
    <>
      <h1>Некорректный адрес календаря</h1>
      <Notice text="Проверьте дату, номер смены и выбранный ПВЗ." error />
      <Link to="/calendar">Вернуться к календарю</Link>
    </>
  );
}
function RouteMessage() {
  const location = useLocation();
  return (
    <Notice
      text={
        typeof location.state?.message === "string"
          ? location.state.message
          : ""
      }
    />
  );
}
export function CalendarMonth({
  monthOverride,
  background = false,
}: {
  monthOverride?: string;
  background?: boolean;
}) {
  const { point, canManage, revision } = useCalendar();
  const [search, setSearch] = useSearchParams();
  const location = useLocation();
  const grid = useRef<HTMLDivElement>(null);
  const month =
    monthOverride ?? search.get("month") ?? dateString(new Date()).slice(0, 7);
  const valid = validMonth(month);
  const bounds = valid ? monthBounds(month) : null;
  const calendar = useResource<ShiftCalendar>(
    `calendar-${point.id}-${month}-${revision}`,
    () =>
      bounds
        ? api.shifts.calendar(point.id, bounds.from, bounds.to)
        : Promise.resolve({}),
  );
  useEffect(() => {
    const returnFocus = location.state?.returnFocus;
    if (
      background ||
      !calendar.data ||
      typeof returnFocus !== "string" ||
      !parseDate(returnFocus)
    )
      return;
    grid.current
      ?.querySelector<HTMLAnchorElement>(`a[href="${dayPath(point.id, returnFocus)}"]`)
      ?.focus();
  }, [background, calendar.data, location.state, point.id]);
  if (!valid) return <InvalidCalendar />;
  const total = Object.values(calendar.data || {}).reduce(
    (count, shifts) => count + shifts.length,
    0,
  );
  return (
    <>
      {!background && <RouteMessage />}
      <Weekdays />
      <MonthNavigation
        month={month}
        reset={dateString(new Date()).slice(0, 7)}
        resetTitle="Вернуться к текущему месяцу"
        busy={background}
        change={(value) =>
          setSearch(
            { workplace: String(point.id), month: value },
            { state: null },
          )
        }
      />
      <LoadState {...calendar} />
      {calendar.data && (
        <>
          <div ref={grid}>
            <MonthGrid
              month={month}
              workplace={point.id}
              content={(date) => {
                const shifts = calendar.data![date] || [];
                return {
                  label: shiftsLabel(shifts),
                  visual: <ShiftPreview shifts={shifts} />,
                };
              }}
            />
          </div>
          <p className={total ? "sr-only" : "hint calendar-empty-hint"}>
            {total
              ? `Смен за месяц: ${total}.`
              : "В этом месяце смен пока нет."}{" "}
            {canManage
              ? "Выберите день, чтобы составить расписание."
              : "Выберите день, чтобы посмотреть расписание."}
          </p>
        </>
      )}
    </>
  );
}

type Removal = { title: string; description: string; ids: number[] } | "day";
export function CalendarDay() {
  const { date } = useParams();
  return date && parseDate(date) ? (
    <DayContent key={date} date={date} />
  ) : (
    <InvalidCalendar />
  );
}
function DayContent({ date }: { date: string }) {
  const { point, canManage, refreshCalendar } = useCalendar();
  const shifts = useResource(`day-${point.id}-${date}`, () =>
    api.shifts.day(point.id, date),
  );
  const action = useMutation();
  const [removal, setRemoval] = useState<Removal | null>(null),
    [message, setMessage] = useState("");
  const [inspected, setInspected] = useState<Shift | null>(null);
  const inspectedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (inspected) inspectedRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [inspected]);
  const groups = new Map<number, Shift[]>();
  for (const shift of shifts.data || []) {
    const list = groups.get(shift.employee_id) || [];
    list.push(shift);
    groups.set(shift.employee_id, list);
  }
  const multiple = [...groups.values()].filter((list) => list.length > 1);
  function remove() {
    if (!canManage || !removal) return;
    void action.run(
      async () => {
        if (removal === "day") return api.shifts.removeDay(point.id, date);
        let completed = 0;
        try {
          for (const id of removal.ids) {
            await api.shifts.remove(point.id, id);
            completed++;
          }
        } catch (error) {
          if (completed)
            throw new Error(
              `Удалено смен: ${completed}. Остальные удалить не удалось. ${error instanceof Error ? error.message : "Обновите список."}`,
            );
          throw error;
        }
      },
      () =>
        setMessage(
          removal === "day"
            ? "Все смены этого дня удалены."
            : "Выбранное расписание удалено.",
        ),
      () => {
        setRemoval(null);
        shifts.retry();
        refreshCalendar();
      },
    );
  }
  return (
    <>
      <CalendarSheet
        title={dayTitle(date)}
        closeTo={calendarPath(point.id, date.slice(0, 7))}
        returnFocus={date}
        busy={action.busy}
        suspended={!!removal}
      >
        <h1 className="sr-only">Расписание дня</h1>
        <RouteMessage />
        <Notice text={message} />
        <Notice text={action.error} error />
        <LoadState {...shifts} />
        {shifts.data && (
          <>
            {shifts.data.length ? (
              <ShiftTimeline
                shifts={shifts.data}
                date={date}
                editable={canManage}
                inspect={setInspected}
              />
            ) : (
              <Empty>
                <p>На этот день смен нет</p>
              </Empty>
            )}
            {inspected && !canManage && (
              <div
                className="calendar-inspected"
                ref={inspectedRef}
                role="group"
                aria-label="Сведения о смене"
                aria-live="polite"
              >
                <strong>{shiftName(inspected)}</strong>
                <p>
                  {timeLabel(inspected.start_time)}–
                  {timeLabel(inspected.end_time)}
                </p>
                {inspected.notes && <p>{inspected.notes}</p>}
              </div>
            )}
            {canManage && (
              <>
                <Link
                  className="primary button-link calendar-add-employee"
                  to={`/calendar/${date}/shift/add?workplace=${point.id}`}
                  aria-label="Добавить сотрудника в расписание"
                >
                  Добавить сотрудника
                </Link>
                {shifts.data.length > 0 && (
                  <div className="calendar-day-actions">
                    <Link
                      to={`/calendar/${date}/duplicate?workplace=${point.id}`}
                    >
                      Размножить смены
                    </Link>
                    <button
                      type="button"
                      className="calendar-danger"
                      aria-label="Удалить смены дня"
                      onClick={() => setRemoval("day")}
                    >
                      Удалить смены
                    </button>
                  </div>
                )}
                {multiple.length > 0 && (
                  <details className="calendar-extra">
                    <summary>Дополнительно</summary>
                    {multiple.map((list) => (
                      <button
                        key={list[0].employee_id}
                        type="button"
                        className="calendar-danger employee-day-remove"
                        aria-label={`Удалить все смены сотрудника ${shiftName(list[0])} за день`}
                        onClick={() =>
                          setRemoval({
                            title: "Удалить расписание сотрудника за день?",
                            description: `${shiftName(list[0])}, ${dateLabel(date)}. Будет удалено смен: ${list.length}. Смены других сотрудников сохранятся.`,
                            ids: list.map((shift) => shift.id),
                          })
                        }
                      >
                        Удалить расписание {shiftName(list[0])} за день
                      </button>
                    ))}
                  </details>
                )}
              </>
            )}
          </>
        )}
      </CalendarSheet>
      {removal && (
        <DeleteDialog
          title={
            removal === "day" ? "Удалить расписание целого дня?" : removal.title
          }
          description={
            removal === "day"
              ? `${point.name}, ${dateLabel(date)}. Будут удалены все смены всех сотрудников этого ПВЗ за выбранный день.`
              : removal.description
          }
          busy={action.busy}
          cancel={() => setRemoval(null)}
          confirm={remove}
        />
      )}
    </>
  );
}

export function ShiftEditor() {
  const { date, shiftId } = useParams();
  if (
    !date ||
    !parseDate(date) ||
    (shiftId !== undefined && !positiveId(shiftId))
  )
    return <InvalidCalendar />;
  return (
    <ShiftEditorContent
      key={`${date}-${shiftId || "new"}`}
      date={date}
      shiftId={positiveId(shiftId)}
    />
  );
}
function ShiftEditorContent({
  date,
  shiftId,
}: {
  date: string;
  shiftId: number | null;
}) {
  const { point, canManage } = useCalendar();
  const resource = useResource(
    `shift-editor-${point.id}-${date}-${shiftId}`,
    async () => {
      if (!canManage) return { shift: null, shifts: [] as Shift[] };
      const [shift, shifts] = await Promise.all([
        shiftId ? api.shifts.get(point.id, shiftId) : Promise.resolve(null),
        api.shifts.day(point.id, date),
      ]);
      return { shift, shifts };
    },
  );
  if (!canManage)
    return (
      <CalendarSheet title={dayTitle(date)} closeTo={dayPath(point.id, date)}>
        <Notice
          text="Изменять расписание может только владелец или администратор этого ПВЗ."
          error
        />
      </CalendarSheet>
    );
  if (!resource.data)
    return (
      <CalendarSheet title={dayTitle(date)} closeTo={dayPath(point.id, date)}>
        <LoadState {...resource} />
      </CalendarSheet>
    );
  if (
    resource.data.shift &&
    (resource.data.shift.workplace_id !== point.id ||
      resource.data.shift.date !== date)
  )
    return <InvalidCalendar />;
  return (
    <ShiftForm
      date={date}
      shift={resource.data.shift}
      shifts={resource.data.shifts}
    />
  );
}
function ShiftForm({
  date,
  shift,
  shifts,
}: {
  date: string;
  shift: Shift | null;
  shifts: Shift[];
}) {
  const { point, employees, refreshCalendar } = useCalendar();
  const navigate = useNavigate();
  const action = useMutation();
  const start = timeLabel(point.work_start_time),
    end = timeLabel(point.work_end_time);
  const defaultsValid = !validateTimes(start, end);
  const [employee, setEmployee] = useState(
    shift ? String(shift.employee_id) : "",
  );
  const [startTime, setStartTime] = useState(
    shift ? timeLabel(shift.start_time) : defaultsValid ? start : "09:00",
  );
  const [endTime, setEndTime] = useState(
    shift ? timeLabel(shift.end_time) : defaultsValid ? end : "18:00",
  );
  const [notes, setNotes] = useState(""),
    [removing, setRemoving] = useState(false);
  const selectedEmployee = positiveId(employee);
  function done(message: string) {
    refreshCalendar();
    navigate(dayPath(point.id, date), { replace: true, state: { message } });
  }
  function save(event: FormEvent) {
    event.preventDefault();
    const error = validateTimes(startTime, endTime);
    if (error) {
      action.setError(error);
      return;
    }
    if (
      !shift &&
      (!selectedEmployee ||
        !employees.some((item) => item.id === selectedEmployee))
    ) {
      action.setError("Выберите активного сотрудника этого ПВЗ.");
      return;
    }
    void action.run(
      () =>
        shift
          ? api.shifts.update(point.id, shift.id, {
              start_time: startTime,
              end_time: endTime,
            })
          : api.shifts.create(point.id, {
              employee_id: selectedEmployee!,
              date,
              start_time: startTime,
              end_time: endTime,
              notes: notes.trim() || null,
            }),
      () => done(shift ? "Изменения смены сохранены." : "Смена создана."),
    );
  }
  function remove() {
    if (!shift) return;
    void action.run(
      () => api.shifts.remove(point.id, shift.id),
      () => done("Выбранное расписание удалено."),
      () => setRemoving(false),
    );
  }
  return (
    <>
      <CalendarSheet
        title={dayTitle(date)}
        subtitle={shift ? "Редактировать смену" : "Добавить смену"}
        closeTo={dayPath(point.id, date)}
        busy={action.busy}
        suspended={removing}
      >
        <details className="calendar-extra shift-context" open={shifts.length <= 3}>
          <summary>Смены этого дня · {shifts.length}</summary>
          {shifts.length ? (
            <ShiftTimeline shifts={shifts} date={date} editable busy={action.busy} />
          ) : (
            <p className="hint">На этот день смен нет.</p>
          )}
        </details>
        {!shift && !employees.length ? (
          <Empty>
            <p>В этом ПВЗ пока нет активных сотрудников.</p>
            <Link to={`/employees?workplace=${point.id}`}>
              Открыть сотрудников
            </Link>
          </Empty>
        ) : (
          <form
            className="calendar-shift-form"
            onSubmit={save}
            aria-busy={action.busy}
          >
            <fieldset disabled={action.busy}>
              <div
                className={`shift-person ${selectedEmployee ? colorClass(selectedEmployee, employees) : ""}`}
              >
                {shift ? (
                  <p className="shift-person-name">
                    <span className="sr-only">Сотрудник: </span>
                    {shiftName(shift)}
                  </p>
                ) : (
                  <ChoicePicker
                    title="Выберите сотрудника"
                    variant="employee"
                    value={employee}
                    onChange={setEmployee}
                    options={employees.map((item) => ({
                      value: String(item.id),
                      title: shiftName(item.user),
                      description: item.position || undefined,
                    }))}
                  />
                )}
              </div>
              <time className="sr-only" dateTime={date}>
                Дата смены: {dateLabel(date)}
              </time>
              <div className="shift-time-fields">
                <TimeField
                  label="Начало смены"
                  caption="Начало"
                  step={30}
                  value={startTime}
                  onChange={setStartTime}
                />
                <TimeField
                  label="Конец смены"
                  caption="Конец"
                  step={30}
                  value={endTime}
                  onChange={setEndTime}
                />
              </div>
              {!shift ? (
                <details className="calendar-extra">
                  <summary>Примечание</summary>
                  <label className="field">
                    <span>Примечание (необязательно)</span>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={3}
                    />
                  </label>
                </details>
              ) : (
                shift.notes && (
                  <details className="calendar-extra">
                    <summary>Примечание</summary>
                    <p className="shift-notes">{shift.notes}</p>
                  </details>
                )
              )}
              <Notice text={action.error} error />
              <div className="shift-form-actions">
                <button className="primary" type="submit">
                  {action.busy ? "Сохраняем…" : "Сохранить"}
                </button>
                {shift && (
                  <button
                    className="primary danger-fill"
                    type="button"
                    onClick={() => setRemoving(true)}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </fieldset>
          </form>
        )}
      </CalendarSheet>
      {removing && shift && (
        <DeleteDialog
          title="Удалить смену?"
          description={`${shiftName(shift)}, ${dateLabel(date)}, ${timeLabel(shift.start_time)}–${timeLabel(shift.end_time)}. Смены других сотрудников сохранятся.`}
          busy={action.busy}
          cancel={() => setRemoving(false)}
          confirm={remove}
        />
      )}
    </>
  );
}

export function DuplicateShifts() {
  const { date } = useParams();
  return date && parseDate(date) ? (
    <DuplicateContent key={date} date={date} />
  ) : (
    <InvalidCalendar />
  );
}
function DuplicateContent({ date }: { date: string }) {
  const { point, canManage } = useCalendar();
  const resource = useResource(`duplicate-source-${point.id}-${date}`, () =>
    canManage ? api.shifts.day(point.id, date) : Promise.resolve([]),
  );
  if (!canManage)
    return (
      <CalendarSheet
        title="Выберите рабочие дни"
        fullScreen
        closeTo={dayPath(point.id, date)}
      >
        <Notice
          text="Копировать расписание может только владелец или администратор этого ПВЗ."
          error
        />
      </CalendarSheet>
    );
  if (!resource.data)
    return (
      <CalendarSheet
        title="Выберите рабочие дни"
        fullScreen
        closeTo={dayPath(point.id, date)}
      >
        <LoadState {...resource} />
      </CalendarSheet>
    );
  if (!resource.data.length)
    return (
      <CalendarSheet
        title="Выберите рабочие дни"
        fullScreen
        closeTo={dayPath(point.id, date)}
      >
        <Empty>
          <p>В исходном дне нет смен для копирования.</p>
          <Link to={dayPath(point.id, date)}>Открыть день</Link>
        </Empty>
      </CalendarSheet>
    );
  return <DuplicateForm date={date} shifts={resource.data} />;
}
function DuplicateForm({ date, shifts }: { date: string; shifts: Shift[] }) {
  const { point, refreshCalendar } = useCalendar();
  const navigate = useNavigate();
  const action = useMutation();
  const formId = useId();
  const [ids, setIds] = useState(shifts.map((shift) => shift.id)),
    [dates, setDates] = useState<string[]>([]),
    [month, setMonth] = useState(date.slice(0, 7));
  const bounds = monthBounds(month);
  const calendar = useResource(`copy-calendar-${point.id}-${month}`, () =>
    api.shifts.calendar(point.id, bounds.from, bounds.to),
  );
  const sources = shifts.filter((shift) => ids.includes(shift.id));
  function toggleDate(value: string) {
    if (value !== date)
      setDates((current) =>
        current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value].sort(),
      );
  }
  function copy(event: FormEvent) {
    event.preventDefault();
    if (calendar.loading || calendar.error) return;
    if (!ids.length || !dates.length) {
      action.setError("Выберите хотя бы одну смену и одну дату копирования.");
      return;
    }
    const shiftIds = [...new Set(ids)],
      targetDates = [...new Set(dates)].sort();
    void action.run(
      () =>
        api.shifts.duplicate(point.id, {
          shift_ids: shiftIds,
          dates: targetDates,
        }),
      (result) => {
        refreshCalendar();
        navigate(calendarPath(point.id, targetDates[0].slice(0, 7)), {
          replace: true,
          state: {
            message: `Создано копий смен: ${result.count_duplicated_shifts_created}.`,
          },
        });
      },
    );
  }
  return (
    <CalendarSheet
      title="Выберите рабочие дни"
      fullScreen
      closeTo={dayPath(point.id, date)}
      busy={action.busy}
      footer={
        <>
          <p className="copy-summary" role="status">
            Смен: {ids.length} · Дат: {dates.length} · Новых смен:{" "}
            {ids.length * dates.length}
          </p>
          <Notice text={action.error} error />
          <button
            type="submit"
            form={formId}
            className="primary"
            aria-label="Сохранить копии смен"
            disabled={action.busy || calendar.loading || !!calendar.error}
          >
            {action.busy ? "Копируем…" : "Сохранить"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={copy} aria-busy={action.busy}>
        <fieldset disabled={action.busy}>
          <p className="sr-only">
            Нажмите смены на шкале времени, которые нужно скопировать. Затем
            выберите даты в календаре.
          </p>
          <details className="copy-sources" open={shifts.length <= 3}>
            <summary>Исходные смены · {ids.length} из {shifts.length}</summary>
            <ShiftTimeline
              shifts={shifts}
              date={date}
              selectedIds={ids}
              toggle={(id) =>
                setIds((current) =>
                  current.includes(id)
                    ? current.filter((item) => item !== id)
                    : [...current, id],
                )
              }
              busy={action.busy}
            />
          </details>
          <MonthNavigation
            month={month}
            change={setMonth}
            reset={date.slice(0, 7)}
            busy={action.busy}
          />
          <Weekdays />
          <LoadState {...calendar} />
          {calendar.data && (
            <MonthGrid
              month={month}
              workplace={point.id}
              selected={dates}
              toggle={toggleDate}
              excluded={date}
              busy={action.busy}
              content={(value) => {
                const existing = calendar.data![value] || [],
                  preview = dates.includes(value) ? sources : [];
                return {
                  label: `${shiftsLabel(existing)}${preview.length ? `; будет добавлено: ${preview.length}` : ""}`,
                  visual: (
                    <ShiftPreview
                      shifts={existing}
                      copies={preview}
                    />
                  ),
                };
              }}
            />
          )}
          <details className="calendar-extra copy-options">
            <summary>Параметры копирования · Дат: {dates.length}</summary>
            <label className="copy-option">
              <input
                type="checkbox"
                checked={ids.length === shifts.length}
                onChange={(event) =>
                  setIds(
                    event.target.checked ? shifts.map((shift) => shift.id) : [],
                  )
                }
              />
              Выбрать все
            </label>
            <p className="hint">
              Существующие смены сохранятся. Проверьте, чтобы новые смены не
              пересекались с ними. Исходный день исключён из выбора.
            </p>
            {dates.length > 0 && (
              <ul className="copy-date-list" aria-label="Выбранные даты">
                {dates.map((value) => (
                  <li key={value}>
                    <button
                      type="button"
                      onClick={() => toggleDate(value)}
                      aria-label={`Убрать дату ${dateLabel(value)}`}
                    >
                      {dateLabel(value)} ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </fieldset>
      </form>
    </CalendarSheet>
  );
}
