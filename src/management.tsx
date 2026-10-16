import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  api,
  hasSession,
  type Employee,
  type Workplace,
  type WorkplaceInput,
} from "./api";
import { Field, Notice, Icon, AddMark } from "./ui";
import { logos } from "./assets";

const marketplaces: Record<string, string> = {
  ozon: "Ozon",
  wildberries: "Wildberries",
  yandex_market: "Яндекс Маркет",
  other: "Другой",
};
const roles: Record<Employee["role"], string> = {
  owner: "Владелец",
  admin: "Администратор",
  employee: "Сотрудник",
};
function positiveId(value: string | undefined | null) {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
function useSessionError() {
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
function useResource<T>(key: string, load: () => Promise<T>) {
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
function LoadState({
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
function MarketBadge({ type }: { type: string }) {
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
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
function fullName(employee: Employee) {
  return [
    employee.user.second_name,
    employee.user.first_name,
    employee.user.third_name,
  ]
    .filter(Boolean)
    .join(" ");
}
function dateLabel(date: string) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return parts ? `${parts[3]}.${parts[2]}.${parts[1]}` : date;
}
function EmployeeRows({
  employees,
  withEditIcon = false,
}: {
  employees: Employee[];
  withEditIcon?: boolean;
}) {
  const active = employees.filter((employee) => employee.is_active);
  return active.length ? (
    <ul className="employee-list">
      {active.map((employee) => (
        <li key={employee.id}>
          <div>
            <strong>{fullName(employee)}</strong>
            {employee.position && <p>{employee.position}</p>}
            {employee.hire_date && (
              <p>Работает с {dateLabel(employee.hire_date)}</p>
            )}
          </div>
          <span className="role-label">
            {roles[employee.role] || employee.role}
          </span>
          {withEditIcon && (
            <button
              className="edit-button unavailable"
              disabled
              aria-label={`Редактирование сотрудника ${fullName(employee)} пока недоступно`}
            >
              <Icon name="edit" />
            </button>
          )}
        </li>
      ))}
    </ul>
  ) : (
    <Empty>
      <p>Сотрудников пока нет</p>
    </Empty>
  );
}
export function Workplaces() {
  const location = useLocation();
  const resource = useResource("workplaces", async () => {
    const [items, me] = await Promise.all([api.workplaces.list(), api.me()]);
    return { items, me };
  });
  return (
    <main className="page workspace-page">
      <header className="page-heading">
        <h1>Список ПВЗ</h1>
        <Link
          className="add-button"
          to="/workplaces/new"
          aria-label="Добавить ПВЗ"
        >
          <AddMark />
        </Link>
      </header>
      <Notice
        text={
          typeof location.state?.message === "string"
            ? location.state.message
            : ""
        }
      />
      <LoadState {...resource} />
      {resource.data &&
        (resource.data.items.length ? (
          <ul className="workplace-list">
            {resource.data.items.map((point) => (
              <li key={point.id}>
                <Link
                  className="workplace-link"
                  to={`/workplaces/${point.id}`}
                  aria-label={`Открыть ПВЗ ${point.name}${point.address ? `: ${point.address}` : ""}`}
                >
                  <MarketBadge type={point.workplace_type} />
                  <span className="workplace-address">
                    {point.address || point.name}
                  </span>
                </Link>
                <button
                  className="favorite-button unavailable"
                  disabled
                  aria-label="Избранное пока недоступно"
                >
                  <Icon name="star" />
                </button>
                {point.owner_id === resource.data!.me.id && (
                  <Link
                    className="edit-button"
                    to={`/workplaces/${point.id}/edit`}
                    aria-label={`Редактировать ПВЗ ${point.name}`}
                  >
                    <EditIcon />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            <p>У вас пока нет ПВЗ</p>
            <p className="hint">
              Создайте первую точку или дождитесь, когда вас добавят в
              существующую.
            </p>
            <Link to="/workplaces/new" className="primary button-link">
              Добавить ПВЗ
            </Link>
          </Empty>
        ))}
    </main>
  );
}
function EditIcon() {
  return <Icon name="edit" />;
}
export function WorkplaceDetail() {
  const id = positiveId(useParams().id);
  if (!id) return <InvalidWorkplace />;
  return <WorkplaceDetailContent key={id} id={id} />;
}
function InvalidWorkplace() {
  return (
    <main className="page workspace-page">
      <Link className="back" to="/workplaces">
        Назад
      </Link>
      <h1>ПВЗ не найден</h1>
      <p>Проверьте адрес страницы или выберите точку из списка.</p>
    </main>
  );
}
function WorkplaceDetailContent({ id }: { id: number }) {
  const resource = useResource(`workplace-${id}`, async () => {
    const [point, me] = await Promise.all([api.workplaces.get(id), api.me()]);
    return { point, me };
  });
  const point = resource.data?.point;
  return (
    <main className="page workspace-page">
      <Link className="back" to="/workplaces">
        Назад
      </Link>
      <h1>{point?.name || "ПВЗ"}</h1>
      <LoadState {...resource} />
      {point && (
        <>
          <div className="detail-market">
            <MarketBadge type={point.workplace_type} />
            <span>
              {marketplaces[point.workplace_type] || point.workplace_type}
            </span>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Адрес</dt>
              <dd>{point.address || "Не указан"}</dd>
            </div>
            <div>
              <dt>Часы работы</dt>
              <dd>
                {point.work_start_time}–{point.work_end_time}
              </dd>
            </div>
            {point.phone && (
              <div>
                <dt>Контактный телефон</dt>
                <dd>{point.phone}</dd>
              </div>
            )}
            {point.description && (
              <div>
                <dt>Описание</dt>
                <dd className="description">{point.description}</dd>
              </div>
            )}
          </dl>
          {point.owner_id === resource.data?.me.id && (
            <Link className="primary button-link" to={`/workplaces/${id}/edit`}>
              Редактировать ПВЗ
            </Link>
          )}
          <section className="employee-section">
            <h2>Сотрудники</h2>
            <EmployeeRows employees={point.employees} />
            <Link to={`/employees?workplace=${id}`}>
              Открыть список сотрудников
            </Link>
          </section>
        </>
      )}
    </main>
  );
}
const initial: WorkplaceInput = {
  name: "",
  address: "",
  phone: "",
  description: "",
  workplace_type: "ozon",
  work_start_time: "09:00",
  work_end_time: "21:00",
};
export function WorkplaceEditor() {
  const params = useParams();
  if (params.id !== undefined) {
    const id = positiveId(params.id);
    return id ? <EditWorkplace key={id} id={id} /> : <InvalidWorkplace />;
  }
  return <WorkplaceForm />;
}
function EditWorkplace({ id }: { id: number }) {
  const resource = useResource(`edit-workplace-${id}`, async () => {
    const [point, me] = await Promise.all([api.workplaces.get(id), api.me()]);
    return { point, me };
  });
  if (resource.data) {
    if (resource.data.point.owner_id !== resource.data.me.id)
      return (
        <main className="page workspace-page">
          <Link className="back" to={`/workplaces/${id}`}>
            Назад
          </Link>
          <h1>Редактирование ПВЗ</h1>
          <Notice text="Изменять эту точку может только её владелец." error />
        </main>
      );
    return (
      <WorkplaceForm
        point={resource.data.point}
        employees={resource.data.point.employees}
      />
    );
  }
  return (
    <main className="page workspace-page">
      <Link className="back" to="/workplaces">
        Назад
      </Link>
      <h1>Редактировать ПВЗ</h1>
      <LoadState {...resource} />
    </main>
  );
}
function WorkplaceForm({
  point,
  employees,
}: {
  point?: Workplace;
  employees?: Employee[];
}) {
  const [data, setData] = useState<WorkplaceInput>(
    point
      ? {
          name: point.name,
          address: point.address,
          phone: point.phone,
          description: point.description,
          workplace_type: point.workplace_type,
          work_start_time: point.work_start_time,
          work_end_time: point.work_end_time,
        }
      : initial,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [extraOpen, setExtraOpen] = useState(
    !!(point?.phone || point?.description),
  );
  const navigate = useNavigate();
  const fail = useSessionError();
  const set = (name: keyof WorkplaceInput) => (value: string) =>
    setData((current) => ({ ...current, [name]: value }));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!data.name.trim()) {
      setError("Укажите название ПВЗ.");
      return;
    }
    if (data.work_end_time <= data.work_start_time) {
      setError("Время окончания должно быть позже времени начала.");
      return;
    }
    const payload: WorkplaceInput = {
      ...data,
      name: data.name.trim(),
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
      description: data.description?.trim() || null,
    };
    setBusy(true);
    try {
      if (point) await api.workplaces.update(point.id, payload);
      else await api.workplaces.create(payload);
      navigate("/workplaces", {
        replace: true,
        state: { message: point ? "Изменения ПВЗ сохранены." : "ПВЗ создан." },
      });
    } catch (error) {
      setError(fail(error));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!point || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.workplaces.remove(point.id);
      navigate("/workplaces", {
        replace: true,
        state: { message: "ПВЗ удалён." },
      });
    } catch (error) {
      setConfirm(false);
      setError(fail(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page workspace-page editor-page">
      <Link
        className="back"
        to={point ? `/workplaces/${point.id}` : "/workplaces"}
      >
        Назад
      </Link>
      <h1>{point ? "Редактировать" : "Добавить ПВЗ"}</h1>
      <form onSubmit={save} aria-busy={busy}>
        <fieldset disabled={busy}>
          <div className="fields">
            <Field
              label="Название ПВЗ"
              name="name"
              value={data.name}
              onChange={set("name")}
              maxLength={255}
            />
            <Field
              label="Адрес"
              name="address"
              value={data.address || ""}
              onChange={set("address")}
              maxLength={500}
              required={false}
            />
          </div>
          <section className="hours-section">
            <h2>График работы сотрудников</h2>
            <div className="time-fields">
              <Field
                label="Начало работы"
                caption="Начало"
                name="work_start_time"
                type="time"
                step={60}
                value={data.work_start_time}
                onChange={set("work_start_time")}
              />
              <Field
                label="Конец работы"
                caption="Конец"
                name="work_end_time"
                type="time"
                step={60}
                value={data.work_end_time}
                onChange={set("work_end_time")}
              />
            </div>
          </section>
          <fieldset className="market-options">
            <legend>Маркетплейсы</legend>
            {Object.entries(marketplaces).map(([value, label]) => (
              <label key={value} title={label}>
                <MarketBadge type={value} />
                <input
                  type="radio"
                  name="workplace_type"
                  value={value}
                  checked={data.workplace_type === value}
                  onChange={() => set("workplace_type")(value)}
                />
                <span className="sr-only">{label}</span>
              </label>
            ))}
            {!marketplaces[data.workplace_type] && (
              <label>
                <input type="radio" name="workplace_type" checked readOnly />
                <span>{data.workplace_type}</span>
              </label>
            )}
          </fieldset>
          <details
            className="extra-details"
            open={extraOpen}
            onToggle={(event) => setExtraOpen(event.currentTarget.open)}
          >
            <summary>Дополнительно</summary>
            <div className="fields">
              <Field
                label="Контактный телефон"
                name="contact_phone"
                type="tel"
                value={data.phone || ""}
                onChange={set("phone")}
                maxLength={20}
                required={false}
              />
              <label className="field">
                <span>Описание</span>
                <textarea
                  name="description"
                  rows={3}
                  value={data.description || ""}
                  onChange={(e) => set("description")(e.target.value)}
                  placeholder="Описание"
                />
              </label>
            </div>
          </details>
          {point && (
            <section className="employee-section">
              <div className="section-heading">
                <h2>Сотрудники</h2>
                <button
                  className="add-button unavailable"
                  type="button"
                  disabled
                  aria-label="Добавление сотрудников пока недоступно"
                >
                  <AddMark />
                </button>
              </div>
              <EmployeeRows employees={employees || []} />
              <Link to={`/employees?workplace=${point.id}`}>
                Открыть список сотрудников
              </Link>
            </section>
          )}
          <div className="editor-actions">
            <Notice text={error} error />
            <button className="primary" type="submit">
              {busy ? "Подождите…" : "Сохранить"}
            </button>
            {point && (
              <button
                type="button"
                className="text-button danger delete-workplace"
                onClick={() => {
                  setError("");
                  setConfirm(true);
                }}
                disabled={busy}
              >
                Удалить ПВЗ
              </button>
            )}
          </div>
        </fieldset>
      </form>
      {confirm && point && (
        <DeleteDialog
          name={point.name}
          busy={busy}
          cancel={() => {
            if (!busy) setConfirm(false);
          }}
          confirm={() => void remove()}
        />
      )}
    </main>
  );
}
function DeleteDialog({
  name,
  busy,
  cancel,
  confirm,
}: {
  name: string;
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
        <h2 id="delete-title">Вы уверены, что хотите удалить ПВЗ?</h2>
        <p id="delete-description">
          ПВЗ «{name}», связанные сотрудники и смены перестанут отображаться.
          Отменить удаление в приложении нельзя.
        </p>
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
export function Employees() {
  const [search, setSearch] = useSearchParams();
  const points = useResource("employees-workplaces", () =>
    api.workplaces.list(),
  );
  const raw = search.get("workplace");
  const selected =
    raw === null ? points.data?.[0]?.id || null : positiveId(raw);
  const point = points.data?.find((item) => item.id === selected);
  return (
    <main className="page workspace-page">
      <header className="page-heading">
        <h1>Сотрудники</h1>
        <button
          className="add-button unavailable"
          disabled
          aria-label="Добавление сотрудников пока недоступно"
        >
          <AddMark />
        </button>
      </header>
      <LoadState {...points} />
      {points.data &&
        (points.data.length ? (
          <>
            <div className="selected-point">
              {point && (
                <Link
                  to={`/workplaces/${point.id}`}
                  className="selected-point-title"
                >
                  <MarketBadge type={point.workplace_type} />
                  <h2>{point.name}</h2>
                </Link>
              )}
              <label className="point-picker">
                <span>Выбрать</span>
                <select
                  aria-label="Рабочая точка"
                  value={point?.id || ""}
                  onChange={(event) =>
                    setSearch({ workplace: event.target.value })
                  }
                >
                  {!point && (
                    <option value="" disabled>
                      Выберите ПВЗ
                    </option>
                  )}
                  {points.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.address ? ` — ${item.address}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {point ? (
              <>
                <EmployeesForPoint key={point.id} id={point.id} />
              </>
            ) : (
              <Notice
                text="Эта точка недоступна. Выберите ПВЗ из списка."
                error
              />
            )}
          </>
        ) : (
          <Empty>
            <p>Нет доступных ПВЗ</p>
            <Link className="primary button-link" to="/workplaces/new">
              Добавить ПВЗ
            </Link>
          </Empty>
        ))}
    </main>
  );
}
function EmployeesForPoint({ id }: { id: number }) {
  const resource = useResource(`employees-${id}`, () =>
    api.workplaces.employees(id),
  );
  return (
    <>
      <LoadState {...resource} />
      {resource.data && <EmployeeRows employees={resource.data} withEditIcon />}
    </>
  );
}
