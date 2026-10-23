export type Profile = {
  id: number;
  first_name: string;
  second_name: string;
  third_name: string | null;
  email: string;
  phone: string;
  is_active: boolean;
};
export type ProfileInput = Pick<
  Profile,
  "first_name" | "second_name" | "third_name" | "email" | "phone"
>;
export type WorkplaceInput = {
  name: string;
  address: string | null;
  phone: string | null;
  description: string | null;
  workplace_type: string;
  work_start_time: string;
  work_end_time: string;
};
export type Workplace = WorkplaceInput & { id: number; owner_id: number };
export type Employee = {
  id: number;
  user_id: number;
  workplace_id: number;
  role: "owner" | "admin" | "employee";
  position?: string | null;
  hire_date?: string | null;
  is_active: boolean;
  user: {
    id: number;
    first_name: string;
    second_name: string;
    third_name?: string | null;
    phone: string;
  };
};
export type EmployeeCreate = {
  phone: string;
  role: Employee["role"];
  position?: string | null;
};
export type EmployeeUpdate = {
  role?: Employee["role"];
  position?: string | null;
};
export type WorkplaceDetailData = Workplace & { employees: Employee[] };
export type Shift = {
  id: number;
  workplace_id: number;
  employee_id: number;
  date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  first_name: string;
  second_name: string;
  third_name: string | null;
};
export type ShiftCreate = Pick<
  Shift,
  "employee_id" | "date" | "start_time" | "end_time" | "notes"
>;
export type ShiftUpdate = Pick<Shift, "start_time" | "end_time">;
export type ShiftCalendar = Record<string, Shift[]>;
export type ShiftDuplicate = { shift_ids: number[]; dates: string[] };
export type ShiftDuplicateResult = {
  count_duplicated_shifts_created: number;
  workplace_id: number;
  period: { start_date: string; end_date: string };
  message: string;
};
type Tokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};
const key = "shift-calendar.session";
const base = (import.meta.env.VITE_API_BASE_URL || "/backend").replace(
  /\/$/,
  "",
);
let tokens: Tokens | null = readTokens();
let generation = 0;
let refreshing: Promise<void> | null = null;
function readTokens(): Tokens | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    return value?.access_token && value?.refresh_token ? value : null;
  } catch {
    return null;
  }
}
export function hasSession() {
  return !!tokens;
}
export function logout() {
  generation++;
  tokens = null;
  sessionStorage.removeItem(key);
}
function saveTokens(value: Tokens) {
  tokens = value;
  sessionStorage.setItem(key, JSON.stringify(value));
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public detail?: unknown,
  ) {
    super(message);
  }
}
const labels: Record<string, string> = {
  first_name: "Имя",
  second_name: "Фамилия",
  third_name: "Отчество",
  email: "Email",
  phone: "Телефон",
  password: "Пароль",
  old_password: "Текущий пароль",
  new_password: "Новый пароль",
  name: "Название ПВЗ",
  address: "Адрес",
  description: "Описание",
  workplace_type: "Маркетплейс",
  work_start_time: "Начало работы",
  work_end_time: "Конец работы",
  role: "Уровень доступа",
  position: "Должность",
  workplace_id: "ПВЗ",
  employee_id: "Сотрудник",
  date: "Дата смены",
  start_time: "Начало смены",
  end_time: "Конец смены",
  notes: "Примечание",
  dates: "Даты копирования",
  shift_ids: "Смены для копирования",
};
async function parse(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    let message =
      response.status >= 500
        ? "Сервер временно недоступен. Попробуйте позже."
        : "Не удалось выполнить запрос.";
    if (Array.isArray(data?.detail))
      message = data.detail
        .map(
          (e: { loc?: string[] }) =>
            `${labels[e.loc?.[e.loc.length - 1] || ""] || "Поле"}: проверьте значение.`,
        )
        .join(" ");
    else if (typeof data?.detail === "string" && response.status < 500)
      message = data.detail;
    if (response.status === 403) message = "Нет доступа к этому действию.";
    if (response.status === 404) message = "Данные не найдены или уже удалены.";
    if (
      response.status === 404 &&
      data?.detail === "User with this phone number not found"
    )
      message =
        "Пользователь с таким телефоном не найден. Сначала сотруднику нужно зарегистрироваться в сервисе. Проверьте, что телефон совпадает с указанным при регистрации.";
    if (
      response.status === 409 &&
      data?.detail === "Employee already exists in this workplace"
    )
      message = "Этот сотрудник уже добавлен в выбранный ПВЗ.";
    if (response.status === 404 && data?.detail === "Employee not found")
      message =
        "Сотрудник не найден в этом ПВЗ или уже удалён. Обновите список сотрудников.";
    if (data?.detail === "Workplace with this address and type already exists.")
      message = "ПВЗ с таким адресом и маркетплейсом уже существует.";
    if (data?.detail === "Current password is not matching.")
      message = "Текущий пароль указан неверно.";
    if (response.status === 401) message = "Сессия истекла. Войдите снова.";
    throw new ApiError(message, response.status, data?.detail);
  }
  return data;
}
async function send(path: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    return await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.",
    );
  } finally {
    clearTimeout(timer);
  }
}
async function refresh() {
  if (!refreshing) {
    const current = generation;
    const refreshToken = tokens?.refresh_token;
    refreshing = (async () => {
      if (!refreshToken) throw new ApiError("Войдите снова.", 401);
      try {
        const value = await parse(
          await send("/auth/refresh-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          }),
        );
        if (current !== generation) throw new ApiError("Войдите снова.", 401);
        saveTokens(value);
      } catch (error) {
        if (
          error instanceof ApiError &&
          [400, 401, 403, 422].includes(error.status) &&
          current === generation
        )
          logout();
        throw error;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  auth = true,
) {
  const current = generation;
  const run = () =>
    send(path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(auth && tokens
          ? { Authorization: `Bearer ${tokens.access_token}` }
          : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  let response = await run();
  if (auth && response.status === 401 && tokens) {
    await refresh();
    if (generation !== current) throw new ApiError("Войдите снова.", 401);
    response = await run();
  }
  if (auth && response.status === 401) logout();
  return parse(response);
}
export const api = {
  async login(email: string, password: string) {
    const response = await send("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: email, password }),
    });
    if (response.status === 401)
      throw new ApiError("Неверный email или пароль.", 401);
    const value = await parse(response);
    generation++;
    saveTokens(value);
  },
  register: (data: ProfileInput & { password: string }) =>
    request("/auth/register", "POST", data, false),
  me: (): Promise<Profile> => request("/users/me"),
  update: (data: ProfileInput): Promise<Profile> =>
    request("/users/me", "PUT", data),
  password: (old_password: string, new_password: string) =>
    request("/users/me/password", "PUT", { old_password, new_password }),
  workplaces: {
    list: (): Promise<Workplace[]> => request("/workplaces/"),
    get: (id: number): Promise<WorkplaceDetailData> =>
      request(`/workplaces/${id}`),
    create: (data: WorkplaceInput): Promise<Workplace> =>
      request("/workplaces/", "POST", data),
    update: (id: number, data: WorkplaceInput): Promise<Workplace> =>
      request(`/workplaces/${id}`, "PUT", data),
    remove: (id: number): Promise<{ detail: string }> =>
      request(`/workplaces/${id}`, "DELETE"),
    employees: (id: number): Promise<Employee[]> =>
      request(`/workplaces/${id}/employees`),
  },
  employees: {
    create: (workplaceId: number, data: EmployeeCreate): Promise<Employee> =>
      request(`/employees/?workplace_id=${workplaceId}`, "POST", data),
    get: (workplaceId: number, employeeId: number): Promise<Employee> =>
      request(`/employees/${employeeId}?workplace_id=${workplaceId}`),
    update: (
      workplaceId: number,
      employeeId: number,
      data: EmployeeUpdate,
    ): Promise<Employee> =>
      request(
        `/employees/${employeeId}?workplace_id=${workplaceId}`,
        "PUT",
        data,
      ),
    remove: (
      workplaceId: number,
      employeeId: number,
    ): Promise<{ message: string }> =>
      request(`/employees/${employeeId}?workplace_id=${workplaceId}`, "DELETE"),
  },
  shifts: {
    calendar: (
      workplaceId: number,
      from: string,
      to: string,
    ): Promise<ShiftCalendar> =>
      emptyShifts(
        () =>
          request(
            `/shifts/calendar/?${new URLSearchParams({ workplace_id: String(workplaceId), date_from: from, date_to: to })}`,
          ),
        {} as ShiftCalendar,
      ),
    day: (workplaceId: number, date: string): Promise<Shift[]> =>
      emptyShifts(
        () =>
          request(
            `/shifts/?${new URLSearchParams({ workplace_id: String(workplaceId), date })}`,
          ),
        [] as Shift[],
      ),
    get: (workplaceId: number, shiftId: number): Promise<Shift> =>
      request(`/shifts/${shiftId}?workplace_id=${workplaceId}`),
    create: (workplaceId: number, data: ShiftCreate): Promise<Shift> =>
      request(`/shifts/?workplace_id=${workplaceId}`, "POST", data),
    update: (
      workplaceId: number,
      shiftId: number,
      data: ShiftUpdate,
    ): Promise<Shift> =>
      request(`/shifts/${shiftId}?workplace_id=${workplaceId}`, "PUT", data),
    remove: (
      workplaceId: number,
      shiftId: number,
    ): Promise<{ message: string }> =>
      request(`/shifts/${shiftId}?workplace_id=${workplaceId}`, "DELETE"),
    removeDay: (
      workplaceId: number,
      date: string,
    ): Promise<{ message: string }> =>
      request(
        `/shifts/?${new URLSearchParams({ workplace_id: String(workplaceId), date })}`,
        "DELETE",
      ),
    duplicate: (
      workplaceId: number,
      data: ShiftDuplicate,
    ): Promise<ShiftDuplicateResult> =>
      request(`/shifts/duplicate/?workplace_id=${workplaceId}`, "POST", data),
  },
};

// This backend reports an empty period/day as 404. Other 404s remain errors.
async function emptyShifts<T>(load: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 404 &&
      typeof error.detail === "string" &&
      /^Shifts not found or not active(?:\b|:)/.test(error.detail)
    )
      return empty;
    throw error;
  }
}
