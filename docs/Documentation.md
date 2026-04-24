# Документация Family Wallet

## Описание системы

**Family Wallet** — платформа для совместного управления семейными финансами на базе продуктов ВТБ. Система обеспечивает:

- Регистрацию и аутентификацию пользователей
- Создание семейных групп и управление участниками
- Совместное отслеживание транзакций
- Управление задачами и подписками
- Календарь семейных событий
- Интеграция с ВТБ Джуниор для детей

## Архитектура

```
┌─────────────┐     ┌─────────────┐
│   Nginx     │────▶│ Auth Svc   │
│  (port 80)  │     │ (port 8001) │
│             │     └─────────────┘
│             │     ┌─────────────┐
│  Reverse    │────▶│ Family Svc  │
│  Proxy      │     │ (port 8002)  │
│             │     └─────────────┘
│             │     ┌─────────────┐
│             │────▶│   MySQL     │
│             │     │ (port 3306) │
└─────────────┘     └─────────────┘
```

### Компоненты

| Компонент | Порт | Технология | Описание |
|-----------|------|------------|----------|
| `nginx` | 80 | Nginx | Reverse proxy, статика |
| `auth-service` | 8001 | FastAPI | Аутентификация, JWT |
| `family-service` | 8002 | FastAPI | Управление семьёй |
| `mysql` | 3306 | MySQL 8.0 | База данных |

## База данных

### Таблицы

**users** — пользователи системы:
- `id` — первичный ключ
- `email` — уникальный email
- `username` — уникальное имя пользователя
- `hashed_password` — хэш пароля
- `is_active` — активность
- `is_verified` — верификация email

**families** — семейные группы:
- `id` — первичный ключ
- `name` — название
- `owner_id` — ID создателя (FK → users)

**family_members** — участники семьи:
- `family_id` — ID семьи
- `user_id` — ID пользователя
- `role` — роль (owner, admin, member)

**family_waiters** — ожидающие приглашения:
- `family_id` — ID семьи
- `email` — приглашённый email
- `status` — статус (pending, accepted, rejected)

**transactions** — транзакции:
- `family_id` — ID семьи
- `user_id` — кто создал
- `amount` — сумма
- `transaction_type` — тип (income, expense)

## API Endpoints

### Auth Service (порт 8001)

| Метод | Путь | Описание |
|-------|-----|----------|
| POST | `/auth/register` | Регистрация пользователя |
| POST | `/auth/login` | Вход, получение JWT |
| GET | `/auth/me` | Текущий пользователь |
| GET | `/auth/verify-email` | Подтверждение email |
| POST | `/auth/forgot-password` | Восстановление пароля |
| POST | `/auth/logout` | Выход |

### Family Service (порт 8002)

#### Приглашения

| Метод | Путь | Описание |
|-------|-----|----------|
| GET | `/family/family-waiters.json` | Сп��сок ожидающих |
| POST | `/family/family-waiters` | Создать приглашение |
| POST | `/family/family-waiters/{id}/accept` | Принять приглашение |
| POST | `/family/family-waiters/{id}/reject` | Отклонить приглашение |
| DELETE | `/family/family-waiters/{id}` | Удалить приглашение |

#### Семья

| Метод | Путь | Описание |
|-------|-----|----------|
| GET | `/family/my` | Информация о семье |
| GET | `/family/members` | Список участников |
| GET | `/family/has-family` | Проверка наличия семьи |

#### Задачи

| Метод | Путь | Описание |
|-------|-----|----------|
| GET | `/family/tasks` | Список задач |
| POST | `/family/tasks` | Создать задачу |

#### Подписки

| Метод | Путь | Описание |
|-------|-----|----------|
| GET | `/family/subscriptions` | Список подписок |

#### Календарь

| Метод | Путь | Описание |
|-------|-----|----------|
| GET | `/family/calendar` | Список событий |
| POST | `/family/calendar` | Создать событие |

#### Junior (ВТБ Джуниор)

| Метод | Путь | Описание |
|-------|-----|----------|
| GET | `/family/junior/tasks` | Задания для детей |
| POST | `/family/junior/tasks` | Создать задание |
| GET | `/family/junior/quests` | Квесты |
| GET | `/family/junior/requests` | Запросы денег |

## Конфигурация

### Переменные окружения

**auth-service:**
- `DATABASE_URL` — строка подключения к MySQL
- `JWT_SECRET_KEY` — ключ для подписи JWT
- `JWT_ALGORITHM` — алгоритм (HS256)
- `JWT_EXPIRE_MINUTES` — время жизни токена (30)

**family-service:**
- `DATABASE_URL` — строка подключения к MySQL
- `JWT_SECRET_KEY` — ключ для подписи JWT
- `AUTH_SERVICE_URL` — URL auth-service

## Запуск

```bash
docker-compose up --build -d
```

Проверка статуса:
```bash
docker-compose ps
```

## Структура проекта

```
family_wallet/
├── docker-compose.yml       # Оркестрация сервисов
├── nginx/nginx.conf       # Конфиг Nginx
├── database/init.sql       # Схема БД
├── auth-service/          # FastAPI: аутентификация
│   ├── main.py           # Приложение
│   ├── views.py          # Эндпоинты
│   ├── models.py         # Модели SQLAlchemy
│   ├── schemas.py        # Pydantic схемы
│   ├── crud.py           # Операции с БД
│   └── dependencies.py  # Зависимости (JWT)
├── family-service/       # FastAPI: семья
│   ├── main.py
│   ├── views.py
│   ├── models.py
│   ├── schemas.py
│   ├── crud.py
│   └── auth_client.py   # Клиент auth-service
├── web/                 # Статика (HTML/CSS/JS)
└── docs/                # Документация
```

## Безопасность

- Пароли хэшируются (bcrypt)
- JWT токены с expiration
- CORS настроен для всех источников (для разработки)
- В production заменить `JWT_SECRET_KEY`