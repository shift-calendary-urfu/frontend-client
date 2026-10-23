import { NavLink } from "react-router-dom";
import { icons } from "./assets";
export function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  required = true,
  autoComplete,
  minLength,
  maxLength,
  step,
  caption,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  step?: number;
  caption?: string;
}) {
  return (
    <label className="field">
      <span>{caption || label}</span>
      <input
        name={name}
        aria-label={label}
        type={type}
        onClick={
          type === "time"
            ? (event) => {
                try {
                  event.currentTarget.showPicker?.();
                } catch {
                  /* Native keyboard editing remains available. */
                }
              }
            : undefined
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        step={step}
        placeholder={label}
        pattern={name === "phone" ? "(\\+7[0-9]{10}|8[0-9]{10})" : undefined}
        title={name === "phone" ? "+7XXXXXXXXXX или 8XXXXXXXXXX" : undefined}
      />
    </label>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return text ? (
    <p
      className={`notice ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {text}
    </p>
  ) : null;
}
export function Icon({ name }: { name: string }) {
  return (
    <span
      className={`icon icon-${name}`}
      style={{
        maskImage: `url(${icons[name]})`,
        WebkitMaskImage: `url(${icons[name]})`,
      }}
      aria-hidden="true"
    />
  );
}
export function AddMark() {
  return (
    <span className="add-mark" aria-hidden="true">
      +
    </span>
  );
}
export function LegalLinks({ policyOnly = false }: { policyOnly?: boolean }) {
  const links = [
    { label: "Написать в поддержку", url: import.meta.env.VITE_SUPPORT_URL },
    {
      label: "Политика конфиденциальности",
      url: import.meta.env.VITE_PRIVACY_URL,
    },
    { label: "Оферта", url: import.meta.env.VITE_OFFER_URL },
  ];
  return (
    <div className={policyOnly ? "legal-links policy-only" : "legal-links"}>
      {links
        .filter((_, i) => !policyOnly || i === 1)
        .map(({ label, url }) =>
          typeof url === "string" && /^(https?:\/\/|mailto:)/i.test(url) ? (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          ) : (
            <span
              key={label}
              aria-disabled="true"
              title="Ссылка пока не настроена"
            >
              {label}
            </span>
          ),
        )}
    </div>
  );
}
export function BottomNav() {
  const entries = [
    { label: "ПВЗ", icon: "home", to: "/workplaces" },
    { label: "Сотрудники", icon: "people", to: "/employees" },
    { label: "Календарь", icon: "calendar", to: "/calendar" },
    { label: "Чаты", icon: "chat" },
    { label: "Настройки", icon: "settings", to: "/settings" },
  ];
  return (
    <nav className="bottom-nav" aria-label="Разделы приложения">
      {entries.map((item) =>
        item.to ? (
          <NavLink key={item.icon} to={item.to}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ) : (
          <button key={item.icon} disabled title="Раздел пока недоступен">
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ),
      )}
    </nav>
  );
}
