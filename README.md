# Календарь смен — frontend

React + TypeScript + Vite. В текущей версии доступны вход, регистрация, настройки профиля, управление ПВЗ и просмотр сотрудников по точке.

Ниже — запуск на **Windows через PowerShell**. Для работы с данными нужны frontend, backend и PostgreSQL. Если проект уже настроен, переходите к [повторному запуску](#повторный-запуск).

## 1. Установить инструменты

| Инструмент     | Версия / установка                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Node.js и npm  | Node.js **24.15+ в ветке 24** или **22.22.2+ в ветке 22**. [Установщик](https://nodejs.org/en/download) |
| uv             | [Инструкция](https://docs.astral.sh/uv/getting-started/installation/) или команда ниже                  |
| Docker Desktop | [Установка для Windows](https://docs.docker.com/desktop/setup/install/windows-install/)                 |

В установщике Node.js оставьте включённым добавление в `PATH`. npm входит в комплект установки.

Установка uv:

```powershell
winget install --id=astral-sh.uv -e
```

После установки полностью перезапустите PowerShell. Если используете встроенный терминал VS Code — перезапустите **весь VS Code**. Откройте Docker Desktop и дождитесь запуска.

Проверьте инструменты в новом терминале:

```powershell
node -v
npm.cmd -v
uv --version
docker --version
docker compose version
```

Команды должны показать версии. Здесь используется `npm.cmd`, чтобы PowerShell не пытался запускать `npm.ps1`.

## 2. Подготовить код и терминалы

Нужны два проекта команды:

- **frontend-client** — этот frontend, в корне лежат `package.json` и `.env.example`.
- **backend-server из ветки `dev`** — в корне лежат `pyproject.toml`, `docker-compose.yaml` и `alembic.ini`.

После распаковки ZIP папка backend может называться `backend-server-dev` — это нормально.

Откройте **два отдельных терминала**: первый в папке backend, второй в папке frontend. Все дальнейшие команды выполняйте в указанной папке. Если шаг завершился ошибкой, сначала устраните её.

## 3. Первый запуск backend

Все команды раздела выполняются в терминале **backend**, рядом с `pyproject.toml`.

### Установить Python и зависимости

В предоставленной версии backend требуется Python **3.13.11**:

```powershell
uv python install 3.13.11
uv sync
```

Активировать `.venv` вручную не требуется: используйте `uv run` с указанной далее командой.

### Создать `.env` backend

Если `.env` и база уже настроены, сохраните существующие значения. Для первого локального запуска создайте `.env` рядом с `docker-compose.yaml`:

```powershell
notepad .env
```

Вставьте и сохраните:

```env
POSTGRES_USER=shift_user
POSTGRES_PASSWORD=local_dev_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DB=shift_calendary_db
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
```

Имя файла — именно `.env`, без `.txt`. Проверка:

```powershell
Get-ChildItem -Force -Name .env*
```

В списке должен быть `.env`. Эти переменные обязательны для Docker Compose; реквизиты из примера предназначены только для локальной разработки. В этой версии backend адрес базы собирается из `POSTGRES_*`, отдельная переменная `DATABASE_URL` не нужна.

### Запустить PostgreSQL

Docker Desktop должен работать:

```powershell
docker compose up -d db
```

Проверьте последние сообщения:

```powershell
docker compose logs --tail 30 db
```

Дождитесь строки:

```text
database system is ready to accept connections
```

Если её ещё нет, повторите просмотр логов через несколько секунд. Если контейнер перезапускается или сообщает об ошибке, миграции пока не запускайте.

### Применить миграции

После готовности базы:

```powershell
uv run alembic upgrade head
```

Дождитесь завершения без ошибок.

### Запустить API

```powershell
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Оставьте терминал открытым. Проверьте [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs): должна открыться документация API.

## 4. Первый запуск frontend

Выполняйте команды во втором терминале — в папке **frontend**, где лежит `package.json`.

### Создать `.env` frontend

Скопируйте пример, если своего файла ещё нет:

```powershell
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}
```

В `.env` frontend должны быть:

```env
VITE_API_BASE_URL=/backend
BACKEND_URL=http://127.0.0.1:8000
```

Это **другой `.env`**, не файл backend. Пароли базы и JWT-секреты сюда не копируются. Необязательные ссылки поддержки, политики и оферты можно оставить пустыми, как в `.env.example`.

### Установить зависимости

```powershell
npm.cmd ci
```

После успешной установки:

```powershell
npm.cmd run dev
```

Откройте [http://localhost:3000](http://localhost:3000). Терминал с Vite тоже оставьте открытым.

Vite перенаправляет запросы `/backend` на `BACKEND_URL`, убирая префикс. Например, `/backend/auth/login` становится `/auth/login` на backend. Добавлять `/api/v1` не нужно.

После изменения `.env` остановите Vite через `Ctrl+C` и снова выполните `npm.cmd run dev`.

## 5. Проверить работу

1. Нажмите **«Создать аккаунт»** и зарегистрируйтесь. Телефон — без пробелов: `+7XXXXXXXXXX` или `8XXXXXXXXXX`, пароль — минимум 8 символов. Отчество необязательно.
2. Войдите с указанными email и паролем — откроются **настройки**.
3. Измените имя, сохраните и обновите страницу: данные должны сохраниться.
4. Через нижнее меню откройте **«ПВЗ»**, создайте тестовую точку и проверьте её редактирование.
5. Откройте **«Сотрудники»** и выберите точку.

Для новой точки пустой список сотрудников нормален: методы их добавления и удаления в предоставленном backend пока содержат `pass`. Сейчас доступен просмотр существующих сотрудников. ПВЗ может изменять и удалять его владелец. Календарь, чаты, push и избранное пока недоступны.

После изменения email потребуется повторный вход с новым адресом — так работает текущая сессия backend.

## Повторный запуск

Повторно устанавливать инструменты и создавать `.env` не нужно.

Откройте Docker Desktop. В терминале backend:

```powershell
docker compose up -d db
```

Дождитесь готовности базы, как описано в разделе 3. После обновления кода backend выполните `uv sync` и `uv run alembic upgrade head`, затем запустите сервер:

```powershell
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

В отдельном терминале frontend:

```powershell
npm.cmd run dev
```

Откройте [http://localhost:3000](http://localhost:3000). После обновления зависимостей frontend сначала выполните `npm.cmd ci`.

## Остановка

В терминалах frontend и backend нажмите `Ctrl+C`. Для остановки базы из папки backend:

```powershell
docker compose stop db
```

Обычная остановка сохраняет данные PostgreSQL в Docker-томе.

## Сборка и тесты

Из папки frontend:

```powershell
npm.cmd run build
npm.cmd test
```

Сборка создаёт `dist/`. Тесты Vitest/jsdom проверяют формы, переходы и API на подменённых ответах. Они не требуют запущенного backend и не заменяют проверку с реальным сервером или визуальную проверку.

Отдельные тесты в Chromium:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Playwright сам запускает frontend, если он ещё не работает на порту `3000`. Ответы API в этих тестах тоже подменяются.

## Частые ошибки

### `npm`, `uv` или `docker` не распознаны

Установите соответствующую программу и полностью перезапустите терминал или VS Code. Для Docker также откройте само приложение Docker Desktop.

### PowerShell запрещает запуск `npm.ps1`

Используйте `npm.cmd`, как в инструкции. Менять политику выполнения PowerShell для этого не требуется.

### Docker требует Virtual Machine Platform

В PowerShell **от имени администратора** выполните команду из подсказки установщика:

```powershell
wsl --install
```

Перезагрузите компьютер и повторите установку Docker Desktop. Подробные требования — в [инструкции Docker](https://docs.docker.com/desktop/setup/install/windows-install/).

### `POSTGRES_* variable is not set` или не указан пароль superuser

Проверьте `.env` в корне **backend**: правильное имя, непустые `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`. После исправления пересоздайте контейнер, сохраняя том:

```powershell
docker compose up -d --force-recreate db
docker compose logs --tail 30 db
```

### Vite пишет `ECONNREFUSED 127.0.0.1:8000`

Backend не принимает подключения по этому адресу. Проверьте его терминал и [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). Если порт другой, исправьте `BACKEND_URL` в `.env` frontend и перезапустите Vite.

### Миграции не могут подключиться к базе

Проверьте готовность PostgreSQL через `docker compose logs --tail 30 db` и значения `POSTGRES_*` в `.env` backend. Затем повторите `uv run alembic upgrade head`.

Если база уже существовала, сохраните её исходные реквизиты вместо примерных значений из инструкции. Удалять том базы для исправления ошибки подключения не нужно.

### Порт `3000` занят

Остановите прежний экземпляр frontend через `Ctrl+C` в его терминале. Vite использует фиксированный порт `3000` и не переключается автоматически.

### Сайт открылся, но вход и регистрация не работают

Открытие страницы подтверждает только запуск frontend. Проверьте backend, базу, миграции и сообщения в терминале API. Перед входом зарегистрируйте пользователя через сайт.

## Git и размещение

`.env`, `node_modules/` и `dist/` исключены из Git. `.env.example` и `package-lock.json` должны быть в репозитории. Правила веток и Pull Request — в [CONTRIBUTING.md](CONTRIBUTING.md).

Для просмотра production-сборки используется `npm.cmd run preview`. У него нет dev-прокси `/backend`: для работы с данными потребуется настроенный адрес API при сборке или reverse proxy. При размещении сервер должен отдавать `index.html` для маршрутов приложения, например `/settings` и `/workplaces/11/edit`.

Особенности оформления и источники графики — в [DESIGN_NOTES.md](DESIGN_NOTES.md).
