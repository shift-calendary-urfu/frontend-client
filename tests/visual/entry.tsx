// Test-only entry for visual review. Does not send requests to a real backend.
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { App } from "../../src/App";
import { api } from "../../src/api";
const profile = {
  id: 1,
  first_name: "Павел",
  second_name: "Ивачёв",
  third_name: null,
  email: "user@example.test",
  phone: "+79990000000",
  is_active: true,
};
const points = [
  {
    id: 11,
    owner_id: 1,
    name: "Машинная",
    address: "ул. Машинная 31д",
    phone: null,
    description: null,
    workplace_type: "ozon",
    work_start_time: "10:00",
    work_end_time: "16:00",
  },
  {
    id: 12,
    owner_id: 1,
    name: "Машинная",
    address: "ул. Машинная 31д",
    phone: null,
    description: null,
    workplace_type: "wildberries",
    work_start_time: "10:00",
    work_end_time: "16:00",
  },
  {
    id: 13,
    owner_id: 1,
    name: "Машинная",
    address: "ул. Машинная 31д",
    phone: null,
    description: null,
    workplace_type: "yandex_market",
    work_start_time: "10:00",
    work_end_time: "16:00",
  },
];
const employees = [
  {
    id: 101,
    user_id: 3,
    workplace_id: 11,
    role: "admin",
    position: null,
    hire_date: null,
    is_active: true,
    user: {
      id: 3,
      first_name: "Никита",
      second_name: "Изюмов",
      third_name: null,
    },
  },
  {
    id: 102,
    user_id: 1,
    workplace_id: 11,
    role: "employee",
    position: null,
    hire_date: null,
    is_active: true,
    user: {
      id: 1,
      first_name: "Павел",
      second_name: "Ивачёв",
      third_name: null,
    },
  },
  {
    id: 103,
    user_id: 4,
    workplace_id: 11,
    role: "owner",
    position: null,
    hire_date: null,
    is_active: true,
    user: {
      id: 4,
      first_name: "Дмитрий",
      second_name: "Киверин",
      third_name: null,
    },
  },
];
window.fetch = async (input, init) => {
  const url = String(input),
    method = init?.method || "GET";
  let data: unknown;
  if (url.endsWith("/auth/login") || url.endsWith("/auth/refresh-token"))
    data = {
      access_token: "visual-access",
      refresh_token: "visual-refresh",
      token_type: "Bearer",
    };
  else if (url.endsWith("/users/me")) data = profile;
  else if (url.endsWith("/workplaces/")) data = points;
  else if (/\/workplaces\/\d+\/employees$/.test(url)) data = employees;
  else if (/\/workplaces\/\d+$/.test(url))
    data = {
      ...points.find((p) => p.id === Number(url.split("/").pop())),
      employees,
    };
  else return new Response("{}", { status: 404 });
  if (method !== "GET" && !url.includes("/auth/"))
    return new Response("{}", { status: 405 });
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};
const screen = location.hash.slice(1) || "workplaces";
const routes: Record<string, string> = {
  login: "/login",
  register: "/register",
  settings: "/settings",
  workplaces: "/workplaces",
  employees: "/employees?workplace=11",
  edit: "/workplaces/11/edit",
  add: "/workplaces/new",
  detail: "/workplaces/11",
};
async function main() {
  if (screen !== "login" && screen !== "register")
    await api.login("user@example.test", "VisualFixture123");
  createRoot(document.getElementById("root")!).render(
    <MemoryRouter initialEntries={[routes[screen] || "/workplaces"]}>
      <App />
    </MemoryRouter>,
  );
}
void main();
