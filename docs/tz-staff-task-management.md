# ТЗ: Staff Task Management System
### HotelMol — внутренняя документация

**Версия:** 1.0
**Дата:** 2026-02-27
**Статус:** Draft

---

## 1. Обзор

### Что это

Staff Task Management System (Staff TMS) — операционный инструмент для персонала отеля.
Получает задачи из гостевого мобильного приложения и позволяет персоналу управлять
их выполнением в реальном времени.

### Проблема которую решаем

Гость заказывает уборку/еду/такси в мобильном приложении → заказ уходит в базу →
**персонал не знает об этом** (нет инструмента). Менеджер видит заказы только
в admin панели, но не может их распределить по сотрудникам.

### Scope этого ТЗ

```
✅ Backend: Staff Auth + Task API + Staff модели
✅ apps/staff-web/ — PWA на Next.js для персонала
✅ TaskFactory — абстракция для внешних TMS
✅ Admin Panel: настройка TMS провайдера
❌ Native Staff Mobile App (отдельное ТЗ, Q3)
❌ Интеграции с HotSOS/Quore/Alice (отдельное ТЗ по мере появления клиентов)
```

---

## 2. Пользователи системы

### 2.1 Роли персонала

| Роль | Что видит | Что может |
|------|-----------|-----------|
| `MANAGER` | Все задачи всех отделов | Назначать, переназначать, отменять, видеть аналитику |
| `ROOM_SERVICE` | Задачи: FOOD, TRANSPORT | Принять, обновить статус, завершить |
| `HOUSEKEEPING` | Задачи: HOUSEKEEPING | Принять, обновить статус, завершить |
| `SPA` | Задачи: SPA | Принять, обновить статус, завершить |
| `RECEPTIONIST` | Все задачи (только просмотр) + ввод ручных задач | Создать задачу вручную |
| `MAINTENANCE` | Задачи типа MAINTENANCE (будущее) | Принять, завершить |

### 2.2 Как сотрудник попадает в систему

- GM создаёт аккаунт сотрудника в Dashboard Panel
- Сотрудник получает SMS/email с логином и временным паролем
- Заходит на `staff.hotelmol.com` с телефона/планшета
- Меняет пароль при первом входе

---

## 3. Архитектура

### 3.1 Место в проекте

```
hotelmol-app/
├── backend/                    ← добавляем Staff модели + API
│   ├── src/modules/staff/      ← НОВЫЙ модуль
│   └── prisma/schema.prisma    ← добавляем StaffMember, StaffShift
│
└── apps/
    ├── mobile/                 ← без изменений (гость)
    ├── dashboard/              ← добавляем страницу управления стаффом
    └── staff-web/              ← НОВОЕ приложение (Next.js PWA)
```

### 3.2 Поток данных

```
[Гость] → заказывает в mobile app
       ↓
[Backend] → создаёт Order/ServiceRequest → публикует в Redis pub/sub
       ↓
[Staff Web] → SSE подписка → видит новую задачу мгновенно
       ↓
[Сотрудник] → берёт в работу → меняет статус
       ↓
[Backend] → обновляет Order → публикует событие
       ↓
[Mobile App] → гость видит "Confirmed / Preparing / On the Way"
```

### 3.3 TaskFactory (абстракция для внешних TMS)

```typescript
// backend/src/modules/tms/TaskFactory.ts

interface TaskAdapter {
  createTask(request: ServiceRequest | Order): Promise<ExternalTask>
  updateTaskStatus(externalId: string, status: string): Promise<void>
  getTask(externalId: string): Promise<ExternalTask>
  handleWebhook(payload: any): Promise<TaskStatusUpdate>
  supportsWebhook(): boolean
  getCapabilities(): TMSCapabilities
}

// Провайдеры
class InternalAdapter implements TaskAdapter  // наш Staff Web
class HotSOSAdapter implements TaskAdapter    // будущее
class QuoreAdapter implements TaskAdapter     // будущее
class WebhookAdapter implements TaskAdapter  // универсальный
```

При создании ServiceRequest:
```typescript
const adapter = TaskFactory.create(hotel.tmsConfig)
const externalTask = await adapter.createTask(serviceRequest)
// сохраняем serviceRequest.externalTaskId = externalTask.id
```

---

## 4. База данных (Prisma)

### 4.1 Новые модели

```prisma
// Сотрудник отеля
model StaffMember {
  id            String      @id @default(uuid())
  hotelId       String
  email         String
  phone         String?
  firstName     String
  lastName      String?
  role          StaffRole
  passwordHash  String
  pin           String?     // 4-значный PIN для быстрого входа
  isActive      Boolean     @default(true)
  avatarUrl     String?
  fcmToken      String?     // для Push уведомлений
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  hotel         Hotel       @relation(...)
  assignments   TaskAssignment[]
  shifts        StaffShift[]

  @@unique([hotelId, email])
  @@map("staff_members")
}

// Рабочая смена
model StaffShift {
  id          String      @id @default(uuid())
  staffId     String
  hotelId     String
  startedAt   DateTime    @default(now())
  endedAt     DateTime?
  isActive    Boolean     @default(true)

  staff       StaffMember @relation(...)
  @@map("staff_shifts")
}

// Назначение задачи сотруднику
model TaskAssignment {
  id                String    @id @default(uuid())
  staffId           String
  serviceRequestId  String?
  orderId           String?
  assignedAt        DateTime  @default(now())
  acceptedAt        DateTime?
  completedAt       DateTime?
  note              String?

  staff             StaffMember    @relation(...)
  serviceRequest    ServiceRequest? @relation(...)
  order             Order?          @relation(...)

  @@map("task_assignments")
}
```

### 4.2 Изменения в существующих моделях

```prisma
// Order — добавить поля
model Order {
  // ... существующие поля ...
  assignedStaffId   String?     // кто выполняет
  staffNote         String?     // заметка для персонала
  estimatedMinutes  Int?        // обещанное время гостю
  tmsTaskId         String?     // ID в внешней TMS если используется
}

// ServiceRequest — добавить поля
model ServiceRequest {
  // ... существующие поля ...
  assignedStaffId   String?
  staffNote         String?
  priority          String      @default("normal") // low/normal/high/urgent
  tmsTaskId         String?
}
```

### 4.3 Новый enum

```prisma
enum StaffRole {
  MANAGER
  ROOM_SERVICE
  HOUSEKEEPING
  SPA
  RECEPTIONIST
  MAINTENANCE
}
```

---

## 5. Backend API

### 5.1 Staff Auth

```
POST   /api/staff/login              — вход по email + password
POST   /api/staff/login/pin          — вход по PIN (быстрый)
POST   /api/staff/refresh            — обновить JWT
POST   /api/staff/logout             — выход, инвалидировать токен
GET    /api/staff/me                 — текущий пользователь

POST   /api/staff/shift/start        — начать смену
POST   /api/staff/shift/end          — завершить смену
```

**JWT:** отдельный secret `STAFF_JWT_SECRET`, access 8h (смена), refresh 30d

### 5.2 Tasks (Orders + ServiceRequests в едином виде)

```
GET    /api/staff/tasks              — список задач (с фильтрами)
GET    /api/staff/tasks/:id          — детали задачи
PATCH  /api/staff/tasks/:id/status   — обновить статус
PATCH  /api/staff/tasks/:id/assign   — назначить на себя / на другого
PATCH  /api/staff/tasks/:id/note     — добавить заметку
POST   /api/staff/tasks              — создать задачу вручную (RECEPTIONIST)

GET    /api/staff/tasks/stream       — SSE поток новых задач
```

**Фильтры GET /api/staff/tasks:**
```
?status=pending,confirmed
?type=FOOD,HOUSEKEEPING
?assignedToMe=true
?roomNumber=305
?date=2026-02-27
```

### 5.3 Staff Management (для Dashboard/Admin)

```
GET    /api/dashboard/staff/:hotelId           — список персонала
POST   /api/dashboard/staff/:hotelId           — создать сотрудника
PATCH  /api/dashboard/staff/:hotelId/:staffId  — редактировать
DELETE /api/dashboard/staff/:hotelId/:staffId  — деактивировать (soft delete)
POST   /api/dashboard/staff/:hotelId/:staffId/reset-password
```

### 5.4 TMS Configuration (для Dashboard/Admin)

```
GET    /api/dashboard/tms/:hotelId             — текущая конфигурация
PUT    /api/dashboard/tms/:hotelId             — сохранить конфигурацию
POST   /api/dashboard/tms/:hotelId/test        — проверить подключение
GET    /api/dashboard/tms/providers            — список доступных провайдеров

POST   /api/pms/tms-webhook/:hotelId           — webhook от внешней TMS
```

---

## 6. Staff Web App (apps/staff-web/)

### 6.1 Стек

- **Framework:** Next.js 14 (App Router)
- **UI:** shadcn/ui + Tailwind CSS
- **State:** TanStack Query (server) + Zustand (auth)
- **Real-time:** SSE (EventSource)
- **PWA:** next-pwa (иконка, offline страница, Add to Home Screen)
- **Push:** Web Push API + VAPID keys

### 6.2 Структура страниц

```
apps/staff-web/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx        — вход для персонала
│   │
│   ├── (staff)/
│   │   ├── layout.tsx            — шапка с именем + смена + выход
│   │   ├── tasks/
│   │   │   ├── page.tsx          — ГЛАВНАЯ: список/канбан задач
│   │   │   └── [id]/page.tsx     — детали задачи
│   │   ├── my-tasks/page.tsx     — только мои назначенные
│   │   └── new-task/page.tsx     — создать задачу вручную
│   │
│   └── (manager)/                — только MANAGER роль
│       ├── dashboard/page.tsx    — аналитика смены
│       ├── staff/page.tsx        — онлайн сотрудники
│       └── reports/page.tsx      — отчёты
│
├── public/
│   ├── manifest.json             — PWA манифест
│   └── icons/                    — иконки для home screen
└── ...
```

### 6.3 Главный экран (Tasks)

**Два вида:**

**Kanban (по умолчанию для desktop/tablet):**
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Новые     │  │  В работе   │  │   Готово    │  │  Выполнено  │
│    (3)      │  │    (2)      │  │    (1)      │  │   (12)      │
├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤
│ 🍽 Room 305 │  │ 🧹 Room 201 │  │ 🍽 Room 108 │  │ ...         │
│ Борщ x2     │  │ Уборка      │  │ Завтрак     │  │             │
│ 14:23       │  │ Иван И.     │  │ Готово 14м  │  │             │
├─────────────┤  └─────────────┘  └─────────────┘  └─────────────┘
│ 🧹 Room 412 │
│ Полотенца   │
│ 14:31       │
└─────────────┘
```

**Список (для мобильного телефона):**
```
┌──────────────────────────────────────┐
│ [Все] [Моё] [Еда] [Уборка] [Спа]    │
├──────────────────────────────────────┤
│ 🔴 NEW                               │
│ 🍽 Комната 305 · Только что          │
│ Борщ x2, Сок апельсиновый x1        │
│ "Без лука пожалуйста"               │
│ [Взять]                   ≡          │
├──────────────────────────────────────┤
│ 🟡 IN PROGRESS · Иван               │
│ 🧹 Комната 201 · 12 мин назад        │
│ Замена полотенец, уборка             │
│ [Готово]                  ≡          │
└──────────────────────────────────────┘
```

### 6.4 Карточка задачи (детали)

```
┌─────────────────────────────────────┐
│ ← Задача #SR-2847                   │
│                                     │
│ 🍽 FOOD · Комната 305 · 14:23       │
│ Статус: ● В приготовлении           │
│                                     │
│ ГОСТЬ: Алексей М.                   │
│ ПОЗВОНИТЬ: +380...                  │
│                                     │
│ ПОЗИЦИИ:                            │
│ • Борщ украинский x2          €14   │
│ • Хлеб x1                    €2    │
│ • Сок апельсиновый x1         €4    │
│ ─────────────────────────          │
│ Итого: €20                          │
│                                     │
│ ЗАМЕТКА ГОСТЯ:                      │
│ "Без лука, пожалуйста"              │
│                                     │
│ ИСПОЛНИТЕЛЬ: Иван Иваненко ✏        │
│                                     │
│ ЗАМЕТКА ПЕРСОНАЛА: [текстовое поле] │
│                                     │
│ ┌──────────┐ ┌──────────────────┐   │
│ │ Отменить │ │ ✓ Отдан гостю    │   │
│ └──────────┘ └──────────────────┘   │
└─────────────────────────────────────┘
```

### 6.5 Real-time обновления

- SSE подписка `GET /api/staff/tasks/stream` при открытии приложения
- Новая задача → звуковой сигнал + вибрация (если разрешено) + счётчик в заголовке
- Изменение статуса другим сотрудником → карточка обновляется без reload
- Если SSE отвалился → reconnect через 3 секунды

### 6.6 PWA требования

- **Add to Home Screen:** работает на iOS Safari и Android Chrome
- **Иконки:** 192x192 и 512x512 PNG
- **Offline страница:** "Нет подключения — обновите страницу"
- **Ориентация:** portrait и landscape (планшет)
- **Минимальный размер экрана:** 375px (iPhone SE)

---

## 7. Dashboard Panel — управление персоналом

Добавить раздел в `apps/dashboard/` (существующая GM панель):

### 7.1 Страница "Staff" (`/hotels/[id]/staff`)

```
┌─────────────────────────────────────────────────────┐
│ Персонал · Hotel Grand Plaza         [+ Добавить]   │
├──────────┬────────────────┬───────────┬─────────────┤
│ Имя      │ Роль           │ Статус    │ Действия    │
├──────────┼────────────────┼───────────┼─────────────┤
│ Иван И.  │ Room Service   │ 🟢 Online │ ✏ 🗑        │
│ Марія К. │ Housekeeping   │ ⚫ Offline │ ✏ 🗑        │
│ Олег С.  │ Manager        │ 🟢 Online │ ✏ 🗑        │
└──────────┴────────────────┴───────────┴─────────────┘
```

### 7.2 Страница "Task Management" (`/hotels/[id]/tms`)

```
Система управления задачами
────────────────────────────
Провайдер: [Встроенный (Staff Web) ▼]
           [Встроенный             ]
           [HotSOS                 ]
           [Quore                  ]
           [Webhook URL            ]

[Встроенный выбран]
✓ Staff Web включён
Адрес: staff.hotelmol.com

[Сохранить]      [Открыть Staff Panel →]
```

---

## 8. Интеграция с Guest Mobile App

### 8.1 Что уже работает (не менять)

- `Order` и `ServiceRequest` создаются через существующий API
- SSE канал `orders:{hotelId}` уже работает в Redis
- Статусы Order уже синхронизируются с гостевым приложением

### 8.2 Что добавляем

**В ServiceRequest добавить поля:**
- `assignedStaffId` — кто выполняет (показываем гостю "Иван уже в пути")
- `estimatedMinutes` — обещанное время (показываем гостю таймер)
- `staffNote` — внутренняя заметка (гостю не показывается)
- `priority` — приоритет (urgent для VIP гостей)

**Новые статусы ServiceRequest:**
```
pending → accepted → in_progress → done → cancelled
```

**Push гостю при изменении статуса:**
- `accepted` → "Ваш запрос принят"
- `in_progress` → "Уже выполняем"
- `done` → "Выполнено ✓"

---

## 9. TaskFactory — детальная спецификация

### 9.1 Interface

```typescript
// backend/src/modules/tms/types.ts

interface ExternalTask {
  externalId: string
  externalUrl?: string
  provider: string
  rawData?: any
}

interface TaskStatusUpdate {
  externalId: string
  newStatus: string
  assignedTo?: string
  note?: string
}

interface TMSCapabilities {
  canCreateTasks: boolean
  canUpdateStatus: boolean
  supportsWebhook: boolean
  supportsAssignment: boolean
  supportsPriority: boolean
}

interface TaskAdapter {
  readonly provider: string
  getCapabilities(): TMSCapabilities
  createTask(input: TaskInput): Promise<ExternalTask>
  updateStatus(externalId: string, status: string, note?: string): Promise<void>
  getTask(externalId: string): Promise<ExternalTask>
  handleWebhook(payload: any, secret?: string): Promise<TaskStatusUpdate>
}
```

### 9.2 InternalAdapter

Маршрутизирует задачи во внутреннюю систему (Staff Web):
- `createTask` → сохраняет в БД, публикует в Redis pub/sub
- `updateStatus` → обновляет ServiceRequest.status в БД
- `handleWebhook` → не нужен (система та же)
- `supportsWebhook` → false

### 9.3 WebhookAdapter

Универсальный адаптер для любой внешней системы:
- `createTask` → POST на настроенный URL с JSON payload
- `handleWebhook` → принимает обратный вызов, парсит по настроенному маппингу
- Настройки в `HotelTMSConfig.credentials`:
  ```json
  {
    "webhookUrl": "https://hotel-system.com/tasks",
    "webhookSecret": "...",
    "callbackPath": "/api/pms/tms-webhook/{hotelId}",
    "statusMapping": {
      "open": "pending",
      "in_progress": "accepted",
      "closed": "done"
    }
  }
  ```

---

## 10. Безопасность

- **Staff JWT** — отдельный секрет `STAFF_JWT_SECRET`, не совпадает с Guest/Dashboard секретами
- **Scope по отелю** — сотрудник видит ТОЛЬКО задачи своего отеля (проверка hotelId в каждом запросе)
- **Role-based access** — middleware проверяет роль перед каждым действием
- **PIN код** — хранить как bcrypt hash, не plain text. Минимум 4 символа
- **Rate limiting** — `/api/staff/login`: 5 попыток / 15 минут на IP
- **HTTPS only** — staff.hotelmol.com только через SSL

---

## 11. Этапы реализации

### Этап 1: Backend (3-4 дня)
1. Добавить `StaffMember`, `StaffShift`, `TaskAssignment` в schema.prisma
2. Добавить поля `assignedStaffId`, `estimatedMinutes`, `staffNote`, `priority` в Order и ServiceRequest
3. Создать модуль `backend/src/modules/staff/` (auth, controller, service, routes)
4. Создать `TaskFactory` с `InternalAdapter`
5. Добавить Staff API в `app.ts`
6. Добавить Staff Management API в dashboard routes

### Этап 2: Staff Web MVP (5-7 дней)
1. Инициализировать Next.js в `apps/staff-web/`
2. Страница login
3. Главная страница со списком задач (mobile-first)
4. Детали задачи + обновление статуса
5. SSE подключение + real-time
6. PWA манифест

### Этап 3: Dashboard Integration (2-3 дня)
1. Страница управления персоналом в `apps/dashboard/`
2. Страница настройки TMS провайдера
3. Отображение онлайн-статуса сотрудников

### Этап 4: Kanban + Manager View (3-4 дня)
1. Kanban view для tablet/desktop
2. Manager dashboard (аналитика смены)
3. Назначение задач менеджером
4. Отчёты

### Этап 5: Внешние TMS (по мере необходимости)
1. `WebhookAdapter` — универсальный
2. `HotSOSAdapter` — по запросу клиента
3. `QuoreAdapter` — по запросу клиента

---

## 12. Метрики успеха

| Метрика | Цель |
|---------|------|
| Время от создания заказа до получения персоналом | < 5 секунд |
| Время первого отклика на задачу (acceptance) | < 2 минуты |
| Покрытие статусами (гость видит обновление) | 100% задач |
| Uptime Staff Web | 99.5% |
| Время загрузки (First Load) | < 2 сек на 4G |

---

## 13. Что НЕ входит в этот scope

- Нативное мобильное приложение для персонала (React Native) — Q3 2026
- Интеграция с HotSOS/Quore/Alice — отдельное ТЗ под конкретный отель
- Биллинг/оплата задач
- Планирование расписания сотрудников (HR функционал)
- Чат между сотрудниками
- Отчётность для бухгалтерии

---

*Документ создан на основе существующей схемы БД и архитектуры проекта HotelMol.*
