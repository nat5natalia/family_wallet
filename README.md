# Семейный Кошелёк ВТБ

Система "Семейный кошелёк" представляет собой платформу для управления семейными финансами на базе продуктов ВТБ, включая групповые счета, вклады и интеграцию с внешними сервисами.

Архитектура объединяет фронтенд на React/Vue, бэкенд на Java Spring, контейнеризированные сервисы и базы данных для обработки контента, платежей и аналитики. 
## Описание системы

Платформа предназначена для совместного управления финансами семьи: от создания семейных счетов до анализа расходов.

Ключевые роли пользователей: Организатор (создает группу), Супруг, Дети 5+, 14-17, 10-13 лет.

Система использует семантический анализ контента для рекомендаций и персонализации.

# Архитектура

## Архитектура системы

Диаграмма показывает взаимодействие компонентов:

- **Пользователи** взаимодействуют через HTTPS с фронтендом (React Native, React/Vue).
- **Центральная система** агрегирует данные из контейнеров: Nginx.
- **Сервисы**: Семантический контент.

## Быстрый запуск

### Требования

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (20.10+)
- Свободные порты: **80**, **3306**

### Запуск

```bash
# Перейти в папку проекта
cd family_wallet

# Запустить все сервисы
docker-compose up --build -d
```

Подождите 30–60 секунд пока MySQL инициализируется.

### Открыть приложение

```
http://localhost
```

### Проверить статус

```bash
docker-compose ps
```

Все 5 контейнеров должны быть в статусе `Up`:
| Контейнер | Порт | Назначение |
|-----------|------|------------|
| `family_wallet_mysql` | 3306 | База данных |
| `family_wallet_auth` | 8001 | Сервис аутентификации |
| `family_wallet_family` | 8002 | Сервис семьи |
| `family_wallet_nginx` | 80 | Reverse proxy + сайт |
| `family_wallet_web` | — | Статика (HTML/CSS/JS) |

---

## Остановка

```bash
# Остановить (данные сохранятся)
docker-compose down

# Остановить и удалить всё (БД очистится)
docker-compose down -v
```

---

## Первый вход

1. Откройте **http://localhost**
2. Нажмите **«Регистрация»**
3. Создайте аккаунт
4. Войдите — вы увидите страницу **«Добро пожаловать!»**


## API

Все запросы идут через Nginx на порту **80**:

```bash
# Регистрация
curl -X POST http://localhost/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","username":"user","password":"pass123"}'

# Логин → JWT
curl -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"pass123"}'

# Мои приглашения (с JWT)
curl http://localhost/family/family-waiters.json \
  -H "Authorization: Bearer <ВАШ_TOKEN>"

# Принять приглашение
curl -X POST http://localhost/family/family-waiters/1/accept \
  -H "Authorization: Bearer <ВАШ_TOKEN>"
```

---

## Структура проекта

```
family_wallet/
├── docker-compose.yml          # Оркестрация
├── nginx/nginx.conf            # Reverse proxy
├── database/init.sql           # Схема БД
├── auth-service/               # FastAPI: регистрация, логин, JWT
├── family-service/             # FastAPI: семья, задачи, подписки, юниор
├── web/                        # Фронтенд (HTML/CSS/JS)
└── docs/                       # Документация
```

---
