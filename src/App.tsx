import React, { useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  api,
  hasSession,
  logout,
  type Profile,
  type ProfileInput,
} from "./api";
import "./style.css";
import { Field, Notice, BottomNav, LegalLinks } from "./ui";
import {
  Workplaces,
  WorkplaceDetail,
  WorkplaceEditor,
  Employees,
} from "./management";
const empty: ProfileInput = {
  first_name: "",
  second_name: "",
  third_name: "",
  email: "",
  phone: "",
};
function profileData(data: ProfileInput): ProfileInput {
  return {
    first_name: data.first_name.trim(),
    second_name: data.second_name.trim(),
    third_name: data.third_name?.trim() || null,
    email: data.email.trim(),
    phone: data.phone.trim(),
  };
}
function validate(data: ProfileInput) {
  if (!data.first_name.trim() || !data.second_name.trim())
    throw new Error("Заполните имя и фамилию.");
}
function ProfileFields({
  value,
  set,
}: {
  value: ProfileInput;
  set: (v: ProfileInput) => void;
}) {
  return (
    <div className="fields">
      {(
        [
          ["second_name", "Фамилия", "text", "family-name"],
          ["first_name", "Имя", "text", "given-name"],
          ["third_name", "Отчество (необязательно)", "text", "additional-name"],
          ["email", "Email", "email", "email"],
          ["phone", "Телефон", "tel", "tel"],
        ] as const
      ).map(([name, label, type, autoComplete]) => (
        <Field
          key={name}
          {...{ name, label, type, autoComplete }}
          value={value[name] || ""}
          onChange={(v) => set({ ...value, [name]: v })}
          required={name !== "third_name"}
        />
      ))}
      <p className="sr-only">Телефон: +7XXXXXXXXXX или 8XXXXXXXXXX</p>
    </div>
  );
}
function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (hasSession()) return <Navigate to="/settings" replace />;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.login(email.trim(), password);
      navigate("/settings", { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page auth login">
      <header className="login-heading">
        <h1>
          Войдите в
          <br />
          аккаунт
        </h1>
        <p>
          Чтобы получить доступ
          <br />к календарю ПВЗ
        </p>
      </header>
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy}>
          <div className="fields">
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={setEmail}
            />
            <Field
              label="Пароль"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
            />
          </div>
          <Notice text={location.state?.message || ""} />
          <Notice text={error} error />
          <div className="auth-actions">
            <Link to="/register">Создать аккаунт</Link>
            <button className="primary" type="submit">
              {busy ? "Входим…" : "Войти"}
            </button>
            <LegalLinks policyOnly />
          </div>
        </fieldset>
      </form>
    </main>
  );
}
function Register() {
  const navigate = useNavigate();
  const [data, setData] = useState(empty);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (hasSession()) return <Navigate to="/settings" replace />;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    try {
      validate(data);
      if (password !== confirm) throw new Error("Пароли не совпадают.");
      setBusy(true);
      await api.register({ ...profileData(data), password });
      navigate("/login", {
        replace: true,
        state: {
          email: data.email.trim(),
          message: "Аккаунт создан. Войдите с вашим паролем.",
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page auth register">
      <Link className="back" to="/login">
        Назад
      </Link>
      <h1>Регистрация</h1>
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy}>
          <ProfileFields value={data} set={setData} />
          <div className="fields">
            <Field
              label="Пароль"
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
            />
            <Field
              label="Повторите пароль"
              name="confirm"
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={setConfirm}
            />
            <p className="sr-only">Не менее 8 символов</p>
          </div>
          <Notice text={error} error />
          <div className="auth-actions">
            <button className="primary" type="submit">
              {busy ? "Регистрируем…" : "Зарегистрироваться"}
            </button>
          </div>
        </fieldset>
      </form>
    </main>
  );
}
function Settings() {
  const navigate = useNavigate();
  const [original, setOriginal] = useState<Profile | null>(null);
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mounted = useRef(true);
  function fail(e: unknown) {
    if (!hasSession()) {
      navigate("/login", {
        replace: true,
        state: { message: "Сессия истекла. Войдите снова." },
      });
    } else setError((e as Error).message);
  }
  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const p = await api.me();
      if (mounted.current) {
        setOriginal(p);
        setData(p);
      }
    } catch (e) {
      if (mounted.current) {
        if (!hasSession()) fail(e);
        else setLoadError((e as Error).message);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    try {
      validate(data);
      setBusy(true);
      const p = await api.update(profileData(data));
      if (p.email !== original?.email) {
        logout();
        navigate("/login", {
          replace: true,
          state: {
            email: p.email,
            message: "Email изменён. Войдите снова с новым адресом.",
          },
        });
        return;
      }
      setOriginal(p);
      setData(p);
      setMessage("Изменения сохранены.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    try {
      if (newPassword !== confirm)
        throw new Error("Новые пароли не совпадают.");
      setBusy(true);
      await api.password(oldPassword, newPassword);
      setOldPassword("");
      setNewPassword("");
      setConfirm("");
      setPasswordOpen(false);
      setMessage("Пароль изменён.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <main className="page settings">
        <Link className="back" to="/workplaces">
          Назад
        </Link>
        <h1>Настройки</h1>
        {loading ? (
          <p role="status">Загружаем профиль…</p>
        ) : loadError ? (
          <>
            <Notice text={loadError} error />
            <button className="primary" onClick={() => void load()}>
              Повторить
            </button>
          </>
        ) : (
          <>
            <form onSubmit={save} aria-busy={busy}>
              <fieldset disabled={busy}>
                <ProfileFields value={data} set={setData} />
                <label className="push">
                  <input type="checkbox" disabled />
                  Получать пуш-уведомления
                </label>
                <p className="sr-only">Push-уведомления пока недоступны</p>
                {data.email.trim() !== original?.email && (
                  <p className="hint">
                    После изменения email потребуется повторный вход.
                  </p>
                )}
                <button className="primary" type="submit">
                  {busy ? "Подождите…" : "Сохранить"}
                </button>
              </fieldset>
            </form>
            <div className="settings-actions">
              {" "}
              <button
                className="text-button password-toggle"
                disabled={busy}
                aria-expanded={passwordOpen}
                onClick={() => {
                  setPasswordOpen(!passwordOpen);
                  setError("");
                  setMessage("");
                }}
              >
                Изменить пароль
              </button>{" "}
              <button
                className="text-button logout"
                disabled={busy || loading}
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
              >
                Выйти из аккаунта
              </button>
            </div>
            {passwordOpen && (
              <form className="password-form" onSubmit={changePassword}>
                <fieldset disabled={busy}>
                  <h2>Смена пароля</h2>
                  <div className="fields">
                    <Field
                      label="Текущий пароль"
                      name="old_password"
                      type="password"
                      autoComplete="current-password"
                      minLength={8}
                      value={oldPassword}
                      onChange={setOldPassword}
                    />
                    <Field
                      label="Новый пароль"
                      name="new_password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={newPassword}
                      onChange={setNewPassword}
                    />
                    <Field
                      label="Повторите новый пароль"
                      name="confirm"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={confirm}
                      onChange={setConfirm}
                    />
                  </div>
                  <button className="primary" type="submit">
                    Обновить пароль
                  </button>
                </fieldset>
              </form>
            )}
          </>
        )}
        <Notice text={error} error />
        <Notice text={message} />
        <LegalLinks />
      </main>
    </>
  );
}
function ProtectedLayout() {
  const { pathname } = useLocation();
  const editor = /^\/workplaces\/(new|[1-9]\d*\/edit)$/.test(pathname);
  return hasSession() ? (
    <>
      <Outlet />
      {!editor && <BottomNav />}
    </>
  ) : (
    <Navigate to="/login" replace />
  );
}
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/settings" element={<Settings />} />
        <Route path="/workplaces" element={<Workplaces />} />
        <Route path="/workplaces/new" element={<WorkplaceEditor key="new" />} />
        <Route path="/workplaces/:id" element={<WorkplaceDetail />} />
        <Route
          path="/workplaces/:id/edit"
          element={<WorkplaceEditor key="edit" />}
        />
        <Route path="/employees" element={<Employees />} />
      </Route>
      <Route
        path="*"
        element={
          <Navigate to={hasSession() ? "/settings" : "/login"} replace />
        }
      />
    </Routes>
  );
}
