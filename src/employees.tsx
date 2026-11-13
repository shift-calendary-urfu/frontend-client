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
  ApiError,
  type Employee,
  type Profile,
  type Workplace,
  type WorkplaceDetailData,
} from "./api";
import { AddMark, Field, Icon, Notice } from "./ui";
import {
  DeleteDialog,
  Empty,
  LoadState,
  MarketBadge,
  WorkplacePicker,
  positiveId,
  useResource,
  useSessionError,
} from "./management-ui";

type Origin = "employees" | "workplace" | "workplace-edit";
const roles: Record<Employee["role"], string> = {
  owner: "Владелец",
  admin: "Администратор",
  employee: "Сотрудник",
};
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
export function canManageEmployees(
  point: Workplace,
  userId: number,
  employees: Employee[],
) {
  return (
    point.owner_id === userId ||
    employees.some(
      (employee) =>
        employee.workplace_id === point.id &&
        employee.user_id === userId &&
        employee.is_active &&
        employee.role === "admin",
    )
  );
}
function editorPath(workplaceId: number, from: Origin, employeeId?: number) {
  return `/workplaces/${workplaceId}/employees/${employeeId ? `${employeeId}/edit` : "new"}?from=${from}`;
}
function returnPath(workplaceId: number, from: Origin) {
  if (from === "workplace") return `/workplaces/${workplaceId}`;
  if (from === "workplace-edit") return `/workplaces/${workplaceId}/edit`;
  return `/employees?workplace=${workplaceId}`;
}
export function AddEmployeeLink({
  workplaceId,
  from = "employees",
}: {
  workplaceId: number;
  from?: Origin;
}) {
  return (
    <Link
      className="add-button"
      to={editorPath(workplaceId, from)}
      aria-label="Добавить сотрудника"
    >
      <AddMark />
    </Link>
  );
}
export function EmployeeRows({
  employees,
  workplaceId,
  editable = false,
  from = "employees",
}: {
  employees: Employee[];
  workplaceId: number;
  editable?: boolean;
  from?: Origin;
}) {
  const active = employees.filter(
    (employee) => employee.is_active && employee.workplace_id === workplaceId,
  );
  return active.length ? (
    <ul className="employee-list" aria-label="Список сотрудников">
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
          {editable && (
            <Link
              className="edit-button"
              to={editorPath(workplaceId, from, employee.id)}
              aria-label={`Редактировать сотрудника ${fullName(employee)}`}
            >
              <Icon name="edit" />
            </Link>
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

export function Employees() {
  const [search, setSearch] = useSearchParams();
  const location = useLocation();
  const points = useResource("employees-workplaces", async () => {
    const [items, me] = await Promise.all([api.workplaces.list(), api.me()]);
    return { items, me };
  });
  const raw = search.get("workplace");
  const selected =
    raw === null ? points.data?.items[0]?.id || null : positiveId(raw);
  const point = points.data?.items.find((item) => item.id === selected);
  const employees = useResource(`employees-${point?.id || "none"}`, () =>
    point
      ? api.workplaces.employees(point.id)
      : Promise.resolve([] as Employee[]),
  );
  const canManage =
    !!point &&
    !!points.data &&
    !!employees.data &&
    canManageEmployees(point, points.data.me.id, employees.data);
  return (
    <main className="page workspace-page employees-page">
      <header className="page-heading">
        <h1>Сотрудники</h1>
        {point && canManage && <AddEmployeeLink workplaceId={point.id} />}
      </header>
      <Notice
        text={
          typeof location.state?.message === "string"
            ? location.state.message
            : ""
        }
      />
      <LoadState {...points} />
      {points.data &&
        (points.data.items.length ? (
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
              <WorkplacePicker
                points={points.data.items}
                selected={point?.id}
                change={(id) => setSearch({ workplace: id }, { state: null })}
              />
            </div>
            {point ? (
              <>
                <LoadState {...employees} />
                {employees.data && (
                  <EmployeeRows
                    employees={employees.data}
                    workplaceId={point.id}
                    editable={canManage}
                  />
                )}
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

export function EmployeeEditor() {
  const params = useParams();
  const workplaceId = positiveId(params.workplaceId);
  const employeeId =
    params.employeeId === undefined ? undefined : positiveId(params.employeeId);
  const [search] = useSearchParams();
  const origin = search.get("from");
  const from: Origin =
    origin === "workplace" || origin === "workplace-edit"
      ? origin
      : "employees";
  if (!workplaceId || employeeId === null)
    return (
      <main className="page workspace-page editor-page">
        <Link className="back" to="/employees">
          Назад
        </Link>
        <h1>Сотрудник не найден</h1>
        <p>Проверьте адрес страницы или откройте сотрудника из списка.</p>
      </main>
    );
  return (
    <EmployeeEditorContent
      key={`${workplaceId}-${employeeId || "new"}-${from}`}
      workplaceId={workplaceId}
      employeeId={employeeId}
      from={from}
    />
  );
}
function EmployeeEditorContent({
  workplaceId,
  employeeId,
  from,
}: {
  workplaceId: number;
  employeeId?: number;
  from: Origin;
}) {
  const resource = useResource(
    `employee-editor-${workplaceId}-${employeeId || "new"}`,
    async () => {
      const [point, me] = await Promise.all([
        api.workplaces.get(workplaceId),
        api.me(),
      ]);
      const allowed = canManageEmployees(point, me.id, point.employees);
      // Check point permissions before requesting a different user's employee record.
      const employee =
        allowed && employeeId
          ? await api.employees.get(workplaceId, employeeId)
          : undefined;
      return { point, me, allowed, employee };
    },
  );
  const back = returnPath(workplaceId, from);
  if (!resource.data)
    return (
      <main className="page workspace-page editor-page">
        <Link className="back" to={back}>
          Назад
        </Link>
        <h1>
          {employeeId ? "Редактировать сотрудника" : "Добавить сотрудника"}
        </h1>
        <LoadState {...resource} />
      </main>
    );
  if (!resource.data.allowed)
    return (
      <main className="page workspace-page editor-page">
        <Link className="back" to={back}>
          Назад
        </Link>
        <h1>Сотрудники</h1>
        <Notice
          text="Управлять сотрудниками может только владелец или администратор этого ПВЗ."
          error
        />
      </main>
    );
  // A wrong-context response must not populate an editor for a different point.
  const { employee, point, me } = resource.data;
  if (
    employee &&
    (employee.workplace_id !== workplaceId ||
      employee.id !== employeeId ||
      !employee.is_active)
  )
    return (
      <main className="page workspace-page editor-page">
        <Link className="back" to={back}>
          Назад
        </Link>
        <h1>Сотрудник не найден</h1>
        <Notice text="Сотрудник не найден в этом ПВЗ или уже удалён." error />
      </main>
    );
  return <EmployeeForm point={point} me={me} employee={employee} from={from} />;
}
function EmployeeForm({
  point,
  me,
  employee,
  from,
}: {
  point: WorkplaceDetailData;
  me: Profile;
  employee?: Employee;
  from: Origin;
}) {
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState(employee?.position || "");
  const [role, setRole] = useState<Employee["role"]>(
    employee?.role || "employee",
  );
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const mounted = useRef(false);
  const navigate = useNavigate();
  const fail = useSessionError();
  const back = returnPath(point.id, from);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function handleError(error: unknown) {
    if (!mounted.current) return;
    setError(fail(error));
    if (
      error instanceof ApiError &&
      (error.status === 403 || (employee && error.status === 404))
    )
      setBlocked(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || blocked) return;
    setError("");
    if (!employee && !/^(\+7\d{10}|8\d{10})$/.test(phone.trim())) {
      setError("Укажите телефон в формате +7XXXXXXXXXX или 8XXXXXXXXXX.");
      return;
    }
    if (position.trim().length > 100) {
      setError("Должность должна быть не длиннее 100 символов.");
      return;
    }
    setBusy(true);
    try {
      const data = { role, position: position.trim() || null };
      if (employee) await api.employees.update(point.id, employee.id, data);
      else
        await api.employees.create(point.id, { ...data, phone: phone.trim() });
      if (mounted.current)
        navigate(back, {
          replace: true,
          state: {
            message: employee
              ? "Изменения сотрудника сохранены."
              : "Сотрудник добавлен.",
          },
        });
    } catch (error) {
      handleError(error);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function remove() {
    if (!employee || busy || blocked) return;
    setBusy(true);
    setError("");
    try {
      await api.employees.remove(point.id, employee.id);
      const selfRemoved =
        employee.user_id === me.id && point.owner_id !== me.id;
      if (mounted.current)
        navigate(selfRemoved ? "/employees" : back, {
          replace: true,
          state: { message: "Сотрудник удалён из ПВЗ." },
        });
    } catch (error) {
      handleError(error);
      if (mounted.current) setConfirm(false);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <main className="page workspace-page editor-page employee-editor">
      <Link
        className="back"
        to={back}
        aria-disabled={busy || undefined}
        onClick={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        Назад
      </Link>
      <h1>{employee ? "Редактировать сотрудника" : "Добавить сотрудника"}</h1>
      <form onSubmit={save} aria-busy={busy}>
        <fieldset disabled={busy || blocked}>
          <div className="fields employee-fields">
            {employee ? (
              <>
                <div className="field">
                  <span>Имя и фамилия</span>
                  <div
                    className="readonly-field"
                    role="textbox"
                    aria-label="Имя и фамилия"
                    aria-readonly="true"
                  >
                    {fullName(employee)}
                  </div>
                </div>
                <div className="field">
                  <span>Телефон</span>
                  <div
                    className="readonly-field"
                    role="textbox"
                    aria-label="Телефон"
                    aria-readonly="true"
                  >
                    {employee.user.phone}
                  </div>
                </div>
              </>
            ) : (
              <Field
                label="Телефон"
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={12}
                value={phone}
                onChange={setPhone}
                placeholder="+7XXXXXXXXXX"
              />
            )}
            <Field
              label="Должность (необязательно)"
              name="position"
              required={false}
              maxLength={100}
              value={position}
              onChange={setPosition}
              placeholder=""
            />
          </div>
          <p className="hint">
            {employee
              ? "Имя и телефон сотрудник меняет в настройках своего аккаунта."
              : "Сотруднику нужно зарегистрироваться в сервисе. Укажите телефон точно как в его аккаунте: +7XXXXXXXXXX или 8XXXXXXXXXX."}
          </p>
          <fieldset className="access-options">
            <legend>Уровень доступа</legend>
            {(employee?.role === "owner"
              ? (["owner", "admin", "employee"] as const)
              : (["admin", "employee"] as const)
            ).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                />
                {roles[value]}
              </label>
            ))}
          </fieldset>
          <section
            className="employee-point"
            aria-label="Пункт выдачи сотрудника"
          >
            <h2>Пункт выдачи</h2>
            <div className="workplace-link">
              <MarketBadge type={point.workplace_type} />
              <span className="workplace-address">
                {point.address || point.name}
              </span>
            </div>
            {employee?.hire_date && (
              <p className="hint">Работает с {dateLabel(employee.hire_date)}</p>
            )}
          </section>
          <div className="editor-actions">
            <Notice text={error} error />
            <button className="primary" type="submit">
              {busy ? "Подождите…" : employee ? "Сохранить" : "Создать"}
            </button>
            {employee && (
              <button
                className="text-button danger delete-workplace"
                type="button"
                onClick={() => {
                  setError("");
                  setConfirm(true);
                }}
              >
                Удалить сотрудника
              </button>
            )}
          </div>
        </fieldset>
      </form>
      {confirm && employee && (
        <DeleteDialog
          title="Удалить сотрудника из ПВЗ?"
          description={`Сотрудник «${fullName(employee)}» будет удалён из ПВЗ «${point.name}». Его аккаунт сохранится. Позже сотрудника можно добавить в эту точку снова.`}
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
