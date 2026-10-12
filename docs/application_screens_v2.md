Отлично, добавляю эндпоинты отчетов (`/reports/workplace/{workplace_id}` и `/reports/employee/{employee_id}`) в Экран №18, обновляю таблицу согласований и итоговую сводную таблицу. Ниже представлен финальный, полностью согласованный документ.

---

# СПИСОК ЭКРАНОВ (Финальная согласованная версия)

## Общие правила

- Base URL для всех запросов: `/api/v1`.
- Все запросы, кроме `/auth/*`, требуют JWT Bearer Token.
- Формат данных — JSON.
- В спецификации нет эндпоинтов для чатов, избранного и push-настроек; они помечены как **«нет в спецификации»** и требуют отдельного решения. 
- **Часовые пояса:** В MVP часовые пояса не выводятся и не редактируются в интерфейсе. Все времена хранятся и обрабатываются на бэкенде относительно одного фиксированного региона (например, МСК), что исключает сложную математику конвертации и усложнение UI.

***

## 1. `/login` — Вход в аккаунт

**Заголовок:** Вход  
**Подзаголовок:** Чтобы получить доступ к календарю рабочих точек

### Элементы

- **Поле «Email»**
  - Тип: `email`
  - Placeholder: `email@example.com`
  - Валидация: обязательное, корректный email

- **Поле «Пароль»**
  - Тип: `password`
  - Placeholder: `Пароль`
  - Валидация: обязательное

- **Кнопка «Войти»**
  - **Action:** `POST /api/v1/auth/login`
  - **Request body:**
    ```json
    {
      "email": "user@example.com",
      "password": "string"
    }
    ```
  - **Success:** сохранить `access_token` и `token_type`
  - **Success redirect:** `/workplaces`
  - **Error:** показать сообщение под кнопкой

- **Ссылка «Зарегистрироваться»**
  - **Action:** переход на `/register`

- **Ссылка «Политика конфиденциальности»**
  - **Action:** переход на `/privacy-policy`

> В текущей спецификации вход выполняется по `email` и `password`. Экран входа по номеру телефона и SMS-коду соответствует будущим эндпоинтам, которые пока не реализованы. 

***

## 2. `/register` — Регистрация пользователя

**Заголовок:** Регистрация

### Элементы

- **Кнопка «Назад»**
  - **Action:** переход на `/login`

- **Поле «Email»**
  - Тип: `email`
  - Placeholder: `email@example.com`
  - Валидация: обязательное, уникальное

- **Поле «Пароль»**
  - Тип: `password`
  - Валидация: обязательное

- **Поле «Телефон»**
  - Тип: `tel`
  - Placeholder: `+7 (XXX) XXX-XX-XX`
  - Валидация: обязательное

- **Поле «Имя»**
  - Тип: `text`
  - Placeholder: `Имя`
  - Валидация: обязательное

- **Поле «Фамилия»**
  - Тип: `text`
  - Placeholder: `Фамилия`
  - Валидация: обязательное

- **Поле «Отчество»**
  - Тип: `text`
  - Placeholder: `Отчество`
  - Валидация: необязательное

- **Кнопка «Зарегистрироваться»**
  - **Action:** `POST /api/v1/auth/register`
  - **Request body:**
    ```json
    {
      "email": "user@example.com",
      "password": "string",
      "phone": "+79995851338",
      "first_name": "Иван",
      "second_name": "Иванов",
      "third_name": "Иванович"
    }
    ```
  - **Success redirect:** `/workplaces`
  - **Error:** показать сообщение

> При регистрации создаётся только `User`; привязка к рабочей точке выполняется отдельно через `POST /api/v1/employees/`. 

***

## 3. `/workplaces` — Список рабочих точек

**Заголовок:** Рабочие точки

### Элементы

- **FAB «+»**
  - **Action:** переход на `/workplace/add`

- **Список рабочих точек**
  - **Action:** `GET /api/v1/workplaces/`
  - **Response:** список точек, где текущий пользователь является owner или employee

  **Карточка рабочей точки:**
  - Название: `Машинная`
  - Адрес: `ул. Машинная, д. 31Д`
  - Тип точки: `ozon` / `wildberries` / `yandex_market` / `other`
  - График: `10:00–16:00`

  - **Иконка звезды**
    - **Action:** добавить/убрать из избранного — **нет в спецификации**
    - Рекомендация: добавить `PATCH /api/v1/workplaces/{workplace_id}/favorite` в будущих спринтах.

  - **Иконка карандаша**
    - **Action:** переход на `/workplace/{workplace_id}/edit`

- **Bottom Navigation Bar**

| Иконка | Label | Route |
|---|---|---|
| 🏠 | Рабочие точки | `/workplaces` |
| 👥 | Сотрудники | `/employees` |
| 📅 | Календарь | `/calendar` |
| 💬 | Чаты | `/chats` *(нет в спецификации)* |
| ⚙️ | Настройки | `/settings` |

***

## 4. `/workplace/add` — Добавление рабочей точки

**Заголовок:** Добавить рабочую точку

### Элементы

- **Кнопка «Назад»**
  - **Action:** переход на `/workplaces`

- **Поле «Название точки»**
  - Тип: `text`
  - Placeholder: `Машинная`
  - Валидация: обязательное

- **Поле «Адрес»**
  - Тип: `text`
  - Placeholder: `ул. Машинная, д. 31Д`
  - Валидация: обязательное

- **Поле «Описание»**
  - Тип: `text`
  - Placeholder: `Описание рабочей точки`
  - Валидация: необязательное

- **Селект «Тип точки»**
  - Варианты: `ozon`, `wildberries`, `yandex_market`, `other`
  - Валидация: обязательное

- **Поле «Начало рабочего дня»**
  - Тип: time picker
  - Пример: `10:00`
  - Валидация: обязательное

- **Поле «Конец рабочего дня»**
  - Тип: time picker
  - Пример: `16:00`
  - Валидация: обязательное

- **Кнопка «Сохранить»**
  - **Action:** `POST /api/v1/workplaces/`
  - **Request body:**
    ```json
    {
      "name": "Машинная",
      "address": "ул. Машинная, д. 31Д",
      "description": "ПВЗ Ozon",
      "workplace_type": "ozon",
      "work_start_time": "10:00",
      "work_end_time": "16:00"
    }
    ```
  - **Success redirect:** `/workplaces`
  - **Примечание:** создавший точку пользователь автоматически становится её `owner`. 

- **Кнопка «Удалить точку»**
  - На экране создания не показывается; доступна только на экране редактирования существующей точки.

***

## 5. `/workplace/:workplace_id/edit` — Редактирование рабочей точки

**Заголовок:** Редактировать рабочую точку

### Элементы

- **Кнопка «Назад»**
  - **Action:** переход на `/workplaces`

- **Загрузка данных точки**
  - **Action:** `GET /api/v1/workplaces/{workplace_id}`
  - **Response fields:** `id`, `name`, `address`, `phone`, `description`, `workplace_type`, `work_start_time`, `work_end_time`, `owner_id`

- **Поля формы** (`name`, `address`, `description`, `workplace_type`, `work_start_time`, `work_end_time`)
  - Значения предзаполняются из ответа `GET`.

- **Секция «Сотрудники»**
  - **Action:** `GET /api/v1/workplaces/{workplace_id}/employees`
  - Параметр: `is_active` — опциональный фильтр
  - **Кнопка «+»**
    - **Action:** открыть модальное окно `/workplace/{workplace_id}/employees`

- **Кнопка «Сохранить»**
  - **Action:** `PUT /api/v1/workplaces/{workplace_id}`
  - **Request body:** (аналогичен созданию, поля опциональны)
  - **Success redirect:** `/workplaces`
  - **Доступ:** owner или admin точки. 

- **Кнопка «Удалить рабочую точку»**
  - **Action:** открыть подтверждение удаления
  - **Route:** `/workplace/{workplace_id}/delete`
  - **Доступ:** только owner. 

***

## 6. `/workplace/:workplace_id/delete` — Подтверждение удаления точки

**Заголовок:** Подтверждение удаления  
**Текст:** Вы уверены, что хотите удалить рабочую точку?

### Элементы

- **Кнопка «Оставить»**
  - **Action:** закрыть модальное окно

- **Кнопка «Удалить»**
  - **Action:** `DELETE /api/v1/workplaces/{workplace_id}`
  - **Success redirect:** `/workplaces`
  - **Доступ:** только owner. 

> В спецификации требуется решить, используется ли hard delete с каскадным удалением или soft delete; это влияет на судьбу сотрудников, смен и шаблонов. 

***

## 7. `/workplace/:workplace_id/employees` — Управление сотрудниками точки

**Заголовок:** Сотрудники рабочей точки

### Элементы

- **Кнопка «Закрыть»**
  - **Action:** закрыть модальное окно

- **Поле «Поиск»**
  - Тип: `text`
  - Placeholder: `Поиск`
  - **Action:** клиентская фильтрация списка

- **Список сотрудников**
  - **Action:** `GET /api/v1/workplaces/{workplace_id}/employees`
  - **Query params:** `is_active` — опционально
  - **Response fields:** `id`, `user_id`, `role_in_workplace`, `position`, `is_active`

- **Чекбоксы сотрудников**
  - Позволяют выбрать активных сотрудников точки

- **Ссылка «Добавить сотрудника»**
  - **Action:** переход на `/employee/add?workplace_id={workplace_id}`

- **Кнопка «Сохранить»**
  - **Действие зависит от выбранных сотрудников:**
    - Добавление существующего пользователя: `POST /api/v1/employees/`
    - Деактивация сотрудника: `DELETE /api/v1/employees/{employee_id}`

> Сотрудник добавляется только если `user_id` существует и этот пользователь ещё не привязан к данной точке. Удаление — soft delete: `is_active = false`. 

***

## 8. `/employees` — Сотрудники

**Заголовок:** Сотрудники  
**Подзаголовок:** Машинная — кнопка «Выбрать»

### Элементы

- **Кнопка «Выбрать»**
  - **Action:** открыть модальное окно `/workplace-select`
  - **Data source:** `GET /api/v1/employees/me/workplaces`

- **FAB «+»**
  - **Action:** переход на `/employee/add?workplace_id={workplace_id}`

- **Список сотрудников**
  - **Action:** `GET /api/v1/workplaces/{workplace_id}/employees`
  - **Query params:** `is_active=true`

  **Карточка сотрудника:**
  - Имя: `Павел Ивачёв`
  - Роль: `owner` / `admin` / `employee`
  - Должность: `position`
  - Статус: активен / деактивирован

  - **Иконка карандаша**
    - **Action:** переход на `/employee/{employee_id}/edit`

***

## 9. `/employee/add` — Добавление сотрудника в точку

**Заголовок:** Добавить сотрудника

### Элементы

- **Кнопка «Назад»**
  - **Action:** переход на `/employees`

- **Селект «Пользователь»**
  - Тип: поиск существующего пользователя по email или телефону
  - Валидация: обязательное
  - **Примечание:** в текущей спецификации сотрудник не создаётся с нуля; привязывается уже существующий `user_id`. 

- **Поле «Рабочая точка»**
  - Тип: скрытое или предзаполненное поле
  - Значение: `workplace_id`
  - Валидация: обязательное

- **Селект «Роль в точке»**
  - Варианты: `owner`, `admin`, `employee`
  - Валидация: обязательное

- **Поле «Должность»**
  - Тип: `text`
  - Placeholder: `Должность`
  - Валидация: необязательное

- **Поле «Дата найма»**
  - Тип: `date`
  - Валидация: необязательное

- **Кнопка «Добавить»**
  - **Action:** `POST /api/v1/employees/`
  - **Request body:**
    ```json
    {
      "user_id": "user_id_1",
      "workplace_id": "workplace_id_1",
      "role_in_workplace": "admin",
      "position": "Администратор",
      "hire_date": "2026-10-11"
    }
    ```
  - **Success redirect:** `/employees`
  - **Доступ:** owner или admin точки. 

***

## 10. `/employee/:employee_id/edit` — Редактирование сотрудника

**Заголовок:** Редактировать сотрудника

### Элементы

- **Кнопка «Назад»**
  - **Action:** переход на `/employees`

- **Загрузка данных сотрудника**
  - **Action:** `GET /api/v1/employees/{employee_id}`
  - **Response fields:** `id`, `user_id`, `workplace_id`, `role_in_workplace`, `position`, `is_active`

- **Поля формы** (`role_in_workplace`, `position`, `hire_date`, `is_active`)
  - Значения предзаполняются из ответа `GET`. Поля `user_id` и `workplace_id` — readonly.

- **Кнопка «Сохранить»**
  - **Action:** `PUT /api/v1/employees/{employee_id}`
  - **Request body:**
    ```json
    {
      "role_in_workplace": "admin",
      "position": "Администратор",
      "hire_date": "2026-10-11",
      "is_active": true
    }
    ```
  - **Success redirect:** `/employees`
  - **Доступ:** owner или admin точки. 

- **Кнопка «Удалить сотрудника»**
  - **Action:** `DELETE /api/v1/employees/{employee_id}`
  - **Success redirect:** `/employees`
  - **Поведение:** soft delete, `is_active = false`
  - **Предупреждение:** если у сотрудника есть будущие смены, показать предупреждение или запретить удаление. 

***

## 11. `/calendar` — Календарь смен

**Заголовок:** Машинная — кнопка «Выбрать»

### Элементы

- **Кнопка «Выбрать»**
  - **Action:** открыть `/workplace-select`
  - **Data source:** `GET /api/v1/employees/me/workplaces`

- **Навигация по месяцам**
  - **Action:** `GET /api/v1/shifts/calendar`
  - **Query params:** `workplace_id={workplace_id}`, `date_from=2026-10-01`, `date_to=2026-10-31`

- **Сетка календаря**
  - Дни недели: пн–вс
  - Смены сотрудников отображаются цветными блоками
  - **Клик по дню:** переход на `/calendar/{date}`

***

## 12. `/workplace-select` — Выбор рабочей точки

**Заголовок:** Выбрать рабочую точку

### Элементы

- **Кнопка «Закрыть»**
  - **Action:** закрыть модальное окно

- **Список доступных точек**
  - **Action:** `GET /api/v1/employees/me/workplaces`
  - **Response fields:** `id`, `workplace_id`, `role_in_workplace`

- **Клик по точке**
  - **Action:** сохранить выбранный `workplace_id`
  - **Redirect:** `/calendar` или `/employees` — в зависимости от исходного экрана

***

## 13. `/calendar/:date` — Смены выбранного дня

**Заголовок:** Сегодня, 28 января

### Элементы

- **Кнопка «Закрыть»**
  - **Action:** возврат на `/calendar`

- **Список смен дня**
  - **Action:** `GET /api/v1/shifts/`
  - **Query params:** `workplace_id={workplace_id}`, `date_from={date}`, `date_to={date}`
  - **Response fields:** `id`, `workplace_id`, `employee_id`, `date`, `start_time`, `end_time`, `status`, `notes`

  - **Действие «Редактировать смену»**: переход на `/calendar/:date/shift/:shift_id/edit`

- **Кнопка «Добавить смену»**
  - **Action:** открыть `/calendar/{date}/shift/add`

- **Действие «Удалить смену»**
  - **Action:** `DELETE /api/v1/shifts/{shift_id}`
  - **Доступ:** owner или admin точки. 

***

## 14. `/calendar/:date/shift/add` — Добавление смены

**Заголовок:** Добавить смену  
**Подзаголовок:** Сегодня, 28 января

### Элементы

- **Кнопка «Закрыть»**
  - **Action:** закрыть модальное окно

- **Селект «Сотрудник»**
  - **Data source:** `GET /api/v1/workplaces/{workplace_id}/employees?is_active=true`
  - Валидация: обязательное

- **Поля формы** (`date`, `start_time`, `end_time`, `notes`)
  - Шаг времени: 30 или 60 минут

- **Кнопка «Сохранить»**
  - **Action:** `POST /api/v1/shifts/`
  - **Request body:**
    ```json
    {
      "workplace_id": "workplace_id_1",
      "employee_id": "user_id_1",
      "date": "2026-10-11",
      "start_time": "10:00",
      "end_time": "16:00",
      "notes": "string"
    }
    ```
  - **Success:** обновить список смен дня
  - **Доступ:** owner или admin точки. 

- **Кнопка «Удалить»**
  - Показывается только для существующей смены
  - **Action:** `DELETE /api/v1/shifts/{shift_id}`

***

## 15. `/chats` — Чаты

**Заголовок:** Чаты

> ⚠️ **Раздел чатов отсутствует в спецификации первого спринта.** Для его реализации необходимо добавить отдельные эндпоинты.

### Элементы

- **Список чатов**
  - **Action:** `GET /api/v1/chats` — **нет в спецификации**

- **Карточка чата**
  - **Клик:** переход на `/chat/{chat_id}`

***

## 16. `/chat/:chat_id` — Переписка

**Заголовок:** Имя сотрудника  

### Элементы

- **Список сообщений**
  - **Action:** `GET /api/v1/chats/{chat_id}/messages` — **нет в спецификации**

- **Кнопка отправки**
  - **Action:** `POST /api/v1/chats/{chat_id}/messages` — **нет в спецификации**

***

## 17. `/settings` — Настройки профиля

**Заголовок:** Настройки

### Элементы

- **Загрузка профиля**
  - **Action:** `GET /api/v1/users/me`
  - **Response fields:** `id`, `email`, `phone`, `first_name`, `second_name`, `third_name`, `is_phone_verified`

- **Поля формы** (`first_name`, `second_name`, `third_name`, `email`, `phone`)
  - Значения предзаполняются из ответа `GET`.

- **Чекбокс «Получать push-уведомления»**
  - **Action:** `push_notifications` — **нет в спецификации**
  - Рекомендация: добавить поле в `PUT /users/me` или отдельный эндпоинт настроек уведомлений.

- **Кнопка «Сохранить»**
  - **Action:** `PUT /api/v1/users/me`
  - **Request body:**
    ```json
    {
      "first_name": "Павел",
      "second_name": "Ивачёв",
      "third_name": "Иванович",
      "phone": "+79995851337",
      "email": "user@example.com"
    }
    ```
  - **Success:** toast «Настройки сохранены»

- **Кнопка «Выйти»**
  - **Action:** `POST /api/v1/auth/logout`
  - **Success redirect:** `/login`

***

## 18. `/reports/monthly` — Отчет за месяц

**Заголовок:** Отчет за месяц

### Элементы

- **Кнопка «Назад»**
  - **Action:** возврат на предыдущий экран (или в навигацию)

- **Селект «Рабочая точка»**
  - **Action:** `GET /api/v1/employees/me/workplaces`

- **Селект «Месяц и год»**
  - Тип: `month picker` (например, "Октябрь 2026")

- **Кнопка «Сформировать отчет по точке»**
  - **Action:** `GET /api/v1/reports/workplace/{workplace_id}`
  - **Query params:** `month=2026-10` (формат: `YYYY-MM`)
  - **Response:** `{workplace: {...}, period: "2026-10", employees: [{employee_id, full_name, shifts_count, hours_worked, hours_planned}, ...]}`

- **Действие «Отчет по конкретному сотруднику»** (переход из карточки сотрудника)
  - **Action:** `GET /api/v1/reports/employee/{employee_id}`
  - **Query params:** `month=2026-10` (формат: `YYYY-MM`)
  - **Response:** `{employee: {...}, workplace: {...}, period: "2026-10", shifts_count, hours_worked, hours_planned, shifts: [...]}`

- **Таблица / Список итогов**
  - Колонки: Сотрудник (ФИО), Количество смен, Часы (отработано / запланировано), Статус.

> **Примечание:** Отчётность в MVP — только вывод на экран, без выгрузок в Excel/PDF. Расчёт строится по актуальному графику (план = факт, таблица `Shift`). Если админ изменил график — отчёт пересчитывается автоматически. Шаг расчёта: 30 или 60 минут.

***

## Сводная таблица эндпоинтов по экранам

| Действие / Запрос | Эндпоинт |
| :--- | :--- |
| Вход в систему | `POST /api/v1/auth/login` |
| Регистрация пользователя | `POST /api/v1/auth/register` |
| Выход из системы | `POST /api/v1/auth/logout` |
| Получение профиля текущего пользователя | `GET /api/v1/users/me` |
| Обновление профиля текущего пользователя | `PUT /api/v1/users/me` |
| Получение списка рабочих точек пользователя | `GET /api/v1/workplaces/` |
| Получение данных конкретной рабочей точки | `GET /api/v1/workplaces/{workplace_id}` |
| Создание новой рабочей точки | `POST /api/v1/workplaces/` |
| Обновление данных рабочей точки | `PUT /api/v1/workplaces/{workplace_id}` |
| Удаление рабочей точки | `DELETE /api/v1/workplaces/{workplace_id}` |
| Получение списка сотрудников точки | `GET /api/v1/workplaces/{workplace_id}/employees` |
| Получение списка точек, где пользователь является сотрудником | `GET /api/v1/employees/me/workplaces` |
| Добавление сотрудника в точку | `POST /api/v1/employees/` |
| Получение данных конкретного сотрудника | `GET /api/v1/employees/{employee_id}` |
| Обновление данных сотрудника | `PUT /api/v1/employees/{employee_id}` |
| Деактивация (удаление) сотрудника | `DELETE /api/v1/employees/{employee_id}` |
| Получение календаря смен (группировка по датам) | `GET /api/v1/shifts/calendar` |
| Получение списка смен (с фильтрами по дате/точке) | `GET /api/v1/shifts/` |
| Создание новой смены | `POST /api/v1/shifts/` |
| Удаление смены | `DELETE /api/v1/shifts/{shift_id}` |
| Получение отчета за месяц по точке | `GET /api/v1/reports/workplace/{workplace_id}?month=YYYY-MM` |
| Получение отчета за месяц по сотруднику | `GET /api/v1/reports/employee/{employee_id}?month=YYYY-MM` |
| Получение списка чатов | *Нет в спецификации* |
| Получение/отправка сообщений чата | *Нет в спецификации* |
| Управление push-уведомлениями / избранным | *Нет в спецификации* |
