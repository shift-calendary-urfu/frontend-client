## Общие правила

- Base URL для всех запросов: `/api/v1`.
- Все запросы, кроме `/auth/*`, требуют JWT Bearer Token.
- Формат данных — JSON.
- В спецификации нет эндпоинтов для чатов, избранного и push-настроек; они помечены как **«нет в спецификации»** и требуют отдельного решения. 

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

> В текущей спецификации вход выполняется по `email` и `password`. Экран входа по номеру телефона и SMS-коду соответствует будущим эндпоинтам `POST /auth/send-code`, `POST /auth/verify-code` и `POST /auth/login-by-phone`, которые пока не реализованы. 

***

## 2. `/verify` — Подтверждение номера телефона

**Заголовок:** Подтверждение номера телефона  
**Текст:** Мы отправили код подтверждения на номер +7 999 585-13-38

### Элементы

- **Кнопка «Назад»**
  - **Action:** переход на `/login`

- **Поле ввода кода**
  - Тип: 6 цифр
  - UI: 6 ячеек
  - Автофокус на первое поле

- **Кнопка «Подтвердить»**
  - **Action:** `POST /api/v1/auth/verify-code` — **нет в текущей спецификации, запланировано**
  - **Request body:**

    ```json
    {
      "phone": "+79995851338",
      "code": "123456"
    }
    ```

  - **Success:** установить `is_phone_verified = true`
  - **Success redirect:** `/workplaces`
  - **Error:** «Неверный код»

- **Ссылка «Отправить код ещё раз»**
  - **Initial state:** disabled, 3 секунды
  - **Timer:** «Доступно через 3 секунды»
  - **Action:** `POST /api/v1/auth/send-code` — **нет в текущей спецификации, запланировано**
  - **Request body:**

    ```json
    {
      "phone": "+79995851338"
    }
    ```

***

## 3. `/register` — Регистрация пользователя

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

  - **Success redirect:** `/verify`
  - **Error:** показать сообщение

> При регистрации создаётся только `User`; привязка к рабочей точке выполняется отдельно через `POST /employees`. Поле `is_phone_verified` автоматически равно `false`. 

***

## 4. `/workplaces` — Список рабочих точек

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
    - Рекомендация: добавить `PATCH /api/v1/workplaces/{workplace_id}/favorite`

  - **Иконка карандаша**
    - **Action:** переход на `/workplace/{workplace_id}/edit`

- **Bottom Navigation Bar**

| Иконка | Label | Route |
|---|---|---|
| 🏠 | Рабочие точки | `/workplaces` |
| 👥 | Сотрудники | `/employees` |
| 📅 | Календарь | `/calendar` |
| 💬 | Чаты | `/chats` |
| ⚙️ | Настройки | `/settings` |

***

## 5. `/workplace/add` — Добавление рабочей точки

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

- **Поле «Телефон»**
  - Тип: `tel`
  - Placeholder: `+7 (XXX) XXX-XX-XX`
  - Валидация: необязательное

- **Поле «Описание»**
  - Тип: `text`
  - Placeholder: `Описание рабочей точки`
  - Валидация: необязательное

- **Селект «Тип точки»**
  - Варианты:
    - `ozon`
    - `wildberries`
    - `yandex_market`
    - `other`
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
      "phone": "+79995851338",
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

## 6. `/workplace/:workplace_id/edit` — Редактирование рабочей точки

**Заголовок:** Редактировать рабочую точку

### Элементы

- **Кнопка «Назад»**
  - **Action:** переход на `/workplaces`

- **Загрузка данных точки**
  - **Action:** `GET /api/v1/workplaces/{workplace_id}`
  - **Response fields:** `id`, `name`, `address`, `phone`, `description`, `workplace_type`, `work_start_time`, `work_end_time`, `owner_id`

- **Поле «Название точки»**
  - Тип: `text`
  - Значение: текущее `name`

- **Поле «Адрес»**
  - Тип: `text`
  - Значение: текущее `address`

- **Поле «Телефон»**
  - Тип: `tel`
  - Значение: текущее `phone`

- **Поле «Описание»**
  - Тип: `text`
  - Значение: текущее `description`

- **Селект «Тип точки»**
  - Значение: текущее `workplace_type`
  - Варианты: `ozon`, `wildberries`, `yandex_market`, `other`

- **Поля графика работы**
  - `work_start_time`
  - `work_end_time`

- **Секция «Сотрудники»**
  - **Action:** `GET /api/v1/workplaces/{workplace_id}/employees`
  - Параметр: `is_active` — опциональный фильтр
  - **Кнопка «+»**
    - **Action:** открыть модальное окно `/workplace/{workplace_id}/employees`

- **Кнопка «Сохранить»**
  - **Action:** `PUT /api/v1/workplaces/{workplace_id}`
  - **Request body:**

    ```json
    {
      "name": "Машинная",
      "address": "ул. Машинная, д. 31Д",
      "phone": "+79995851338",
      "description": "ПВЗ Ozon",
      "workplace_type": "ozon",
      "work_start_time": "10:00",
      "work_end_time": "16:00"
    }
    ```

  - **Success redirect:** `/workplaces`
  - **Доступ:** owner или admin точки. 

- **Кнопка «Удалить рабочую точку»**
  - **Action:** открыть подтверждение удаления
  - **Route:** `/workplace/{workplace_id}/delete`
  - **Доступ:** только owner. 

> В спецификации нет отдельного эндпоинта для маркетплейсов. Роль поля `marketplaces` выполняет `workplace_type` со значениями `ozon`, `wildberries`, `yandex_market`, `other`. 

***

## 7. `/workplace/:workplace_id/delete` — Подтверждение удаления точки

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

## 8. `/workplace/:workplace_id/employees` — Управление сотрудниками точки

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
  - Отдельного `PATCH /workplaces/{id}/employees` в спецификации нет.

**Пример добавления сотрудника:**

```json
{
  "user_id": "user_id_1",
  "workplace_id": "workplace_id_1",
  "role_in_workplace": "admin",
  "position": "Администратор",
  "hire_date": "2026-10-11"
}
```

> Сотрудник добавляется только если `user_id` существует и этот пользователь ещё не привязан к данной точке. Удаление — soft delete: `is_active = false`. 

***

## 9. `/employees` — Сотрудники

**Заголовок:** Сотрудники  
**Подзаголовок:** Машинная — кнопка «Выбрать»

### Элементы

- **Кнопка «Выбрать»**
  - **Action:** открыть модальное окно `/workplace-select`
  - **Data source:** `GET /api/v1/employees/me/workplaces`
  - **Response:** список точек, где текущий пользователь является сотрудником

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

- **Bottom Navigation Bar**
  - Активна вкладка «Сотрудники»

***

## 10. `/employee/add` — Добавление сотрудника в точку

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
  - Варианты:
    - `owner`
    - `admin`
    - `employee`
  - Валидация: обязательное

- **Поле «Должность»**
  - Тип: `text`
  - Placeholder: `Должность`
  - Валидация: необязательное

- **Поле «Дата найма»**
  - Тип: `date`
  - Валидация: необязательное

- **Секция «Рабочие точки»**
  - Список доступных точек
  - **Кнопка «+»**
    - **Action:** открыть `/workplace-select`

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

## 11. `/employee/:employee_id/edit` — Редактирование сотрудника

**Заголовок:** Редактировать сотрудника

### Элементы

- **Кнопка «Назад»**
  - **Action:** переход на `/employees`

- **Загрузка данных сотрудника**
  - **Action:** `GET /api/v1/employees/{employee_id}`
  - **Response fields:** `id`, `user_id`, `workplace_id`, `role_in_workplace`, `position`, `is_active`

- **Поле «Пользователь»**
  - Тип: readonly
  - Значение: пользователь, связанный с `user_id`

- **Поле «Рабочая точка»**
  - Тип: readonly или селект
  - Значение: `workplace_id`

- **Селект «Роль в точке»**
  - Варианты: `owner`, `admin`, `employee`
  - Значение: текущее `role_in_workplace`

- **Поле «Должность»**
  - Тип: `text`
  - Значение: текущее `position`

- **Поле «Дата найма»**
  - Тип: `date`
  - Значение: текущее `hire_date`

- **Чекбокс «Активен»**
  - Значение: текущее `is_active`

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

## 12. `/calendar` — Календарь смен

**Заголовок:** Машинная — кнопка «Выбрать»

### Элементы

- **Кнопка «Выбрать»**
  - **Action:** открыть `/workplace-select`
  - **Data source:** `GET /api/v1/employees/me/workplaces`

- **Навигация по месяцам**
  - **Action:** `GET /api/v1/shifts/calendar`
  - **Query params:**

    ```text
    workplace_id={workplace_id}
    date_from=2026-10-01
    date_to=2026-10-31
    ```

- **Сетка календаря**
  - Дни недели: пн–вс
  - Смены сотрудников отображаются цветными блоками
  - **Клик по дню:** переход на `/calendar/{date}`

- **Bottom Navigation Bar**
  - Активна вкладка «Календарь»

**Формат ответа:**

```json
{
  "dates": {
    "2026-10-15": [
      {
        "employee_id": "user_id_1",
        "start_time": "10:00",
        "end_time": "16:00"
      }
    ]
  }
}
```

***

## 13. `/workplace-select` — Выбор рабочей точки

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

## 14. `/calendar/:date` — Смены выбранного дня

**Заголовок:** Сегодня, 28 января

### Элементы

- **Кнопка «Закрыть»**
  - **Action:** возврат на `/calendar`

- **Мини-календарь**
  - Выбранный день подсвечен

- **Список смен дня**
  - **Action:** `GET /api/v1/shifts/`
  - **Query params:**

    ```text
    workplace_id={workplace_id}
    date_from={date}
    date_to={date}
    ```

  - **Response fields:** `id`, `workplace_id`, `employee_id`, `date`, `start_time`, `end_time`, `status`, `notes`

- **Поля времени смены**
  - `start_time`
  - `end_time`
  - Шаг: 30 или 60 минут

- **Кнопка «Добавить смену»**
  - **Action:** открыть `/calendar/{date}/shift/add`

- **Ссылка «Размножить смены»**
  - **Action:** открыть `/calendar/{date}/shifts/copy`

- **Действие «Удалить смену»**
  - **Action:** `DELETE /api/v1/shifts/{shift_id}`
  - **Доступ:** owner или admin точки. 

***

## 15. `/calendar/:date/shift/add` — Добавление смены

**Заголовок:** Добавить смену  
**Подзаголовок:** Сегодня, 28 января

### Элементы

- **Кнопка «Закрыть»**
  - **Action:** закрыть модальное окно

- **Мини-календарь**
  - Выбранная дата: `date`

- **Список смен дня**
  - **Action:** `GET /api/v1/shifts/?workplace_id={workplace_id}&date_from={date}&date_to={date}`

- **Селект «Сотрудник»**
  - **Data source:** `GET /api/v1/workplaces/{workplace_id}/employees?is_active=true`
  - Валидация: обязательное

- **Поле «Дата»**
  - Тип: `date`
  - Значение: выбранная дата
  - Валидация: обязательное

- **Поле «Начало»**
  - Тип: time picker
  - Шаг: 30 или 60 минут
  - Валидация: обязательное

- **Поле «Конец»**
  - Тип: time picker
  - Шаг: 30 или 60 минут
  - Валидация: обязательное

- **Поле «Комментарий»**
  - Тип: `text`
  - Валидация: необязательное

- **Кнопка «Проверить доступность»**
  - **Action:** `GET /api/v1/shifts/check-availability`
  - **Query params:**

    ```text
    employee_id={employee_id}
    date={date}
    start_time={start_time}
    end_time={end_time}
    ```

  - **Response:**

    ```json
    {
      "available": true,
      "conflicts": []
    }
    ```

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

## 16. `/calendar/:date/shifts/copy` — Размножение смен

**Заголовок:** Выберите рабочие дни

### Элементы

- **Кнопка «Отменить»**
  - **Action:** закрыть модальное окно

- **Мини-календарь месяца**
  - Чекбоксы или выделение целевых дней

- **Список смен исходного дня**
  - **Action:** `GET /api/v1/shifts/?workplace_id={workplace_id}&date_from={source_date}&date_to={source_date}`

- **Кнопка «Скопировать»**
  - **Action:** `POST /api/v1/shifts/bulk`
  - **Request body:**

    ```json
    [
      {
        "workplace_id": "workplace_id_1",
        "employee_id": "user_id_1",
        "date": "2026-10-12",
        "start_time": "10:00",
        "end_time": "16:00"
      },
      {
        "workplace_id": "workplace_id_1",
        "employee_id": "user_id_1",
        "date": "2026-10-13",
        "start_time": "10:00",
        "end_time": "16:00"
      }
    ]
    ```

  - **Response:**

    ```json
    {
      "created": [],
      "errors": []
    }
    ```

  - **Success redirect:** `/calendar`
  - **Доступ:** owner или admin точки. 

***

## 17. `/chats` — Чаты

**Заголовок:** Чаты

> Раздел чатов отсутствует в спецификации первого спринта. Для его реализации необходимо добавить отдельные эндпоинты, например `GET /chats`, `GET /chats/{chat_id}/messages` и `POST /chats/{chat_id}/messages`. 

### Элементы

- **FAB «+»**
  - **Action:** открыть `/employee-select`

- **Список чатов**
  - **Action:** `GET /api/v1/chats` — **нет в спецификации**

- **Карточка чата**
  - Имя сотрудника
  - Статус: онлайн / не в сети
  - Последнее сообщение
  - Время
  - **Клик:** переход на `/chat/{chat_id}`

***

## 18. `/chat/:chat_id` — Переписка

**Заголовок:** Имя сотрудника  
**Подзаголовок:** Телефон сотрудника

### Элементы

- **Кнопка «Назад»**
  - **Action:** переход на `/chats`

- **Список сообщений**
  - **Action:** `GET /api/v1/chats/{chat_id}/messages` — **нет в спецификации**

- **Поле ввода сообщения**
  - Тип: `text`
  - Placeholder: `Сообщение`

- **Кнопка отправки**
  - **Action:** `POST /api/v1/chats/{chat_id}/messages` — **нет в спецификации**
  - **Request body:**

    ```json
    {
      "text": "Привет"
    }
    ```

  - **Success:** добавить сообщение в список и очистить поле ввода

***

## 19. `/settings` — Настройки профиля

**Заголовок:** Настройки

### Элементы

- **Кнопка «Назад»**
  - **Action:** возврат на предыдущий экран

- **Загрузка профиля**
  - **Action:** `GET /api/v1/users/me`
  - **Response fields:** `id`, `email`, `phone`, `first_name`, `second_name`, `third_name`, `is_phone_verified`

- **Поле «Имя»**
  - Тип: `text`
  - Значение: `first_name`
  - Валидация: обязательное, минимум 2 символа

- **Поле «Фамилия»**
  - Тип: `text`
  - Значение: `second_name`

- **Поле «Отчество»**
  - Тип: `text`
  - Значение: `third_name`
  - Валидация: необязательное

- **Поле «Email»**
  - Тип: `email`
  - Значение: текущий `email`

- **Поле «Телефон»**
  - Тип: `tel`
  - Значение: текущий `phone`
  - **Примечание:** при изменении телефона `is_phone_verified` сбрасывается в `false`. 

- **Чекбокс «Получать push-уведомления»**
  - Тип: `checkbox`
  - **Action:** `push_notifications` — **нет в спецификации**
  - Рекомендация: добавить поле в `PUT /users/me` или отдельный эндпоинт настроек уведомлений

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

- **Ссылка «Изменить пароль»**
  - **Action:** открыть `/settings/password`

- **Ссылка «Написать в поддержку»**
  - **Action:** открыть почтовый клиент или чат поддержки

- **Ссылка «Политика конфиденциальности»**
  - **Action:** открыть `/privacy-policy`

- **Ссылка «Оферта»**
  - **Action:** открыть `/offer`

- **Кнопка «Выйти»**
  - **Action:** `POST /api/v1/auth/logout`
  - **Success redirect:** `/login`
  - **Примечание:** токен также можно удалить на клиенте. 

***

## 20. `/settings/password` — Изменение пароля

**Заголовок:** Изменить пароль

### Элементы

- **Поле «Текущий пароль»**
  - Тип: `password`
  - Валидация: обязательное

- **Поле «Новый пароль»**
  - Тип: `password`
  - Валидация: обязательное

- **Поле «Повторите новый пароль»**
  - Тип: `password`
  - Валидация: должна совпадать с новым паролем

- **Кнопка «Сохранить»**
  - **Action:** `PUT /api/v1/users/me/password`
  - **Request body:**

    ```json
    {
      "old_password": "string",
      "new_password": "string"
    }
    ```

  - **Success:** toast «Пароль обновлён»
  - **Error:** показать сообщение

***

## Согласование названий запросов

| Экран / действие | Было в экранах | Стало по спецификации |
|---|---|---|
| Вход | `POST /auth/login` с `phone` | `POST /api/v1/auth/login` с `email`, `password` |
| Подтверждение SMS | `POST /auth/verify` | `POST /api/v1/auth/verify-code` — запланировано |
| Повторный код | `POST /auth/resend-code` | `POST /api/v1/auth/send-code` — запланировано |
| Регистрация | `POST /auth/register` с `phone`, `name` | `POST /api/v1/auth/register` с email, password, phone, ФИО |
| Список объектов | отсутствовал | `GET /api/v1/workplaces/` |
| Создание объекта | `POST /object` | `POST /api/v1/workplaces/` |
| Редактирование объекта | `PATCH /object/:id` | `PUT /api/v1/workplaces/{workplace_id}` |
| Удаление объекта | `DELETE /object/:id` | `DELETE /api/v1/workplaces/{workplace_id}` |
| Избранное | `PATCH /object/:id/favorite` | **нет в спецификации** |
| Маркетплейсы | `PATCH /object/:id/marketplaces` | поле `workplace_type` в `PUT /workplaces/{id}` |
| Сотрудники точки | `PATCH /object/:id/employees` | `GET /workplaces/{id}/employees`, `POST /employees/`, `DELETE /employees/{id}` |
| Добавление сотрудника | `POST /employee` с именем и телефоном | `POST /api/v1/employees/` с существующим `user_id` |
| Редактирование сотрудника | `PATCH /employee/:id` | `PUT /api/v1/employees/{employee_id}` |
| Удаление сотрудника | `DELETE /employee/:id` | `DELETE /api/v1/employees/{employee_id}` — soft delete |
| Календарь | `GET /calendar?object_id=:id` | `GET /api/v1/shifts/calendar?workplace_id=...` |
| Добавление смены | `POST /calendar/:date/shift` | `POST /api/v1/shifts/` |
| Удаление смены | `DELETE /calendar/:date/shift/:shift_id` | `DELETE /api/v1/shifts/{shift_id}` |
| Размножение смен | `POST /calendar/shifts/copy` | `POST /api/v1/shifts/bulk` |
| Настройки профиля | `PATCH /user/settings` | `GET /api/v1/users/me`, `PUT /api/v1/users/me` |
| Выход | отсутствовал | `POST /api/v1/auth/logout` |
| Чаты | `GET /chats`, `POST /chat/:id/message` | **нет в спецификации первого спринта** |
