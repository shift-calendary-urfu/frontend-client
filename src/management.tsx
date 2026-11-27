import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, type Employee, type Workplace, type WorkplaceInput } from "./api";
import { Field, Notice, Icon, AddMark } from "./ui";
import { ChoicePicker, TimeField } from "./pickers";
import { timeLabel } from "./calendar-utils";
import { reportPath } from "./reports";
import {
  positiveId,
  useSessionError,
  useResource,
  LoadState,
  MarketBadge,
  Empty,
  DeleteDialog,
} from "./management-ui";
import { EmployeeRows, AddEmployeeLink, canManageEmployees } from "./employees";
import { workplaceTypeName, workplaceTypes } from "./workplace-types";

const typeOptions = workplaceTypes.map((type) => ({
  ...type,
  icon: <MarketBadge type={type.value} />,
}));
function workHours(point: Workplace) {
  return `${timeLabel(point.work_start_time)}–${timeLabel(point.work_end_time)}`;
}
export function Workplaces() {
  const location = useLocation();
  const resource = useResource("workplaces", async () => {
    const [items, me] = await Promise.all([api.workplaces.list(), api.me()]);
    return { items, me };
  });
  return (
    <main className="page workspace-page workplaces-page">
      <header className="page-heading">
        <h1>Рабочие точки</h1>
        <Link
          className="add-button"
          to="/workplaces/new"
          aria-label="Добавить точку"
        >
          <AddMark />
          <span className="workplace-add-label">Добавить точку</span>
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
            {resource.data.items.map((point) => {
              const editable = point.owner_id === resource.data!.me.id;
              return (
                <li
                  key={point.id}
                  className={editable ? "workplace-card-editable" : undefined}
                >
                  <Link
                    className="workplace-link"
                    to={`/workplaces/${point.id}`}
                    aria-label={`Открыть точку ${point.name}${point.address ? `: ${point.address}` : ""}`}
                  >
                    <MarketBadge type={point.workplace_type} />
                    <span className="workplace-card-text">
                      <span className="workplace-card-heading">
                        <strong className="workplace-name" title={point.name}>
                          {point.name}
                        </strong>
                        {point.address && (
                          <span
                            className="workplace-address"
                            title={point.address}
                          >
                            {point.address}
                          </span>
                        )}
                      </span>
                      <span className="workplace-meta">
                        <span>{workplaceTypeName(point.workplace_type)}</span>
                        <span className="workplace-hours">
                          {workHours(point)}
                        </span>
                      </span>
                    </span>
                  </Link>
                  <button
                    className="favorite-button unavailable"
                    disabled
                    aria-label="Избранное пока недоступно"
                  >
                    <Icon name="star" />
                  </button>
                  {editable && (
                    <Link
                      className="edit-button"
                      to={`/workplaces/${point.id}/edit`}
                      aria-label={`Редактировать точку ${point.name}`}
                    >
                      <EditIcon />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>
            <p>У вас пока нет рабочих точек</p>
            <p className="hint">
              Создайте первую точку или дождитесь, когда вас добавят в
              существующую.
            </p>
            <Link to="/workplaces/new" className="primary button-link">
              Добавить точку
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
      <h1>Точка не найдена</h1>
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
  const location = useLocation();
  const canManage =
    !!point &&
    !!resource.data &&
    canManageEmployees(point, resource.data.me.id, point.employees);
  return (
    <main className="page workspace-page workplace-detail-page">
      <Link className="back" to="/workplaces">
        Назад
      </Link>
      <h1>{point?.name || "Рабочая точка"}</h1>
      <Notice
        text={
          typeof location.state?.message === "string"
            ? location.state.message
            : ""
        }
      />
      <LoadState {...resource} />
      {point && (
        <>
          <div className="detail-market">
            <MarketBadge type={point.workplace_type} />
            <span>{workplaceTypeName(point.workplace_type)}</span>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Адрес</dt>
              <dd>{point.address || "Не указан"}</dd>
            </div>
            <div>
              <dt>Часы работы</dt>
              <dd>
                {workHours(point)}
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
          <Link
            className="detail-link"
            to={`/calendar?workplace=${id}`}
          >
            Открыть календарь смен
          </Link>
          {canManage && (
            <Link className="detail-link" to={reportPath(id)}>
              Отчёт по сменам
            </Link>
          )}
          {point.owner_id === resource.data?.me.id && (
            <Link className="primary button-link" to={`/workplaces/${id}/edit`}>
              Редактировать точку
            </Link>
          )}
          <section className="employee-section">
            <div className="section-heading">
              <h2>Сотрудники</h2>
              {canManage && (
                <AddEmployeeLink workplaceId={id} from="workplace" />
              )}
            </div>
            <EmployeeRows
              employees={point.employees}
              workplaceId={id}
              editable={canManage}
              from="workplace"
            />
            <Link className="detail-link" to={`/employees?workplace=${id}`}>
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
  workplace_type: "other",
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
          <h1>Редактирование точки</h1>
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
      <h1>Редактировать точку</h1>
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
  const location = useLocation();
  const [data, setData] = useState<WorkplaceInput>(
    point
      ? {
          name: point.name,
          address: point.address,
          phone: point.phone,
          description: point.description,
          workplace_type: point.workplace_type,
          work_start_time: timeLabel(point.work_start_time),
          work_end_time: timeLabel(point.work_end_time),
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
  const options = typeOptions.some((type) => type.value === data.workplace_type)
    ? typeOptions
    : [
        {
          value: data.workplace_type,
          title: workplaceTypeName(data.workplace_type),
          icon: <MarketBadge type={data.workplace_type} />,
        },
        ...typeOptions,
      ];
  const set = (name: keyof WorkplaceInput) => (value: string) =>
    setData((current) => ({ ...current, [name]: value }));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!data.name.trim()) {
      setError("Укажите название точки.");
      return;
    }
    if (!data.address?.trim()) {
      setError("Укажите адрес точки.");
      return;
    }
    if (data.work_end_time <= data.work_start_time) {
      setError("Время окончания должно быть позже времени начала.");
      return;
    }
    const payload: WorkplaceInput = {
      ...data,
      name: data.name.trim(),
      address: data.address.trim(),
      phone: data.phone?.trim() || null,
      description: data.description?.trim() || null,
    };
    setBusy(true);
    try {
      if (point) await api.workplaces.update(point.id, payload);
      else await api.workplaces.create(payload);
      navigate("/workplaces", {
        replace: true,
        state: { message: point ? "Изменения точки сохранены." : "Точка создана." },
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
        state: { message: "Точка удалена." },
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
      <h1>{point ? "Редактировать" : "Добавить точку"}</h1>
      <Notice
        text={
          typeof location.state?.message === "string"
            ? location.state.message
            : ""
        }
      />
      <form onSubmit={save} aria-busy={busy}>
        <fieldset disabled={busy}>
          <div className="fields">
            <Field
              label="Название точки"
              name="name"
              value={data.name}
              onChange={set("name")}
              maxLength={255}
              placeholder=""
            />
            <Field
              label="Адрес"
              name="address"
              value={data.address || ""}
              onChange={set("address")}
              maxLength={500}
              placeholder=""
            />
          </div>
          <div className="workplace-type-field">
            <ChoicePicker
              title="Тип рабочей точки"
              variant="workplace-type"
              value={data.workplace_type}
              onChange={set("workplace_type")}
              options={options}
            />
          </div>
          <section className="hours-section">
            <h2>Часы работы</h2>
            <div className="time-fields">
              <TimeField
                label="Начало работы"
                caption="Начало"
                step={1}
                value={data.work_start_time}
                onChange={set("work_start_time")}
              />
              <TimeField
                label="Конец работы"
                caption="Конец"
                step={1}
                value={data.work_end_time}
                onChange={set("work_end_time")}
              />
            </div>
          </section>
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
                <AddEmployeeLink workplaceId={point.id} from="workplace-edit" />
              </div>
              <EmployeeRows
                employees={employees || []}
                workplaceId={point.id}
                editable
                from="workplace-edit"
              />
              <Link className="detail-link" to={`/employees?workplace=${point.id}`}>
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
                Удалить точку
              </button>
            )}
          </div>
        </fieldset>
      </form>
      {confirm && point && (
        <DeleteDialog
          title="Вы уверены, что хотите удалить рабочую точку?"
          description={`Рабочая точка «${point.name}», связанные сотрудники и смены перестанут отображаться. Отменить удаление в приложении нельзя.`}
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
