# HotelMol App — CLAUDE.md (для Claude Code)

> Положи этот файл в корень репозитория.
> Claude Code будет автоматически читать его как контекст проекта.

---

## Кто ты в этом проекте

Ты — senior full-stack разработчик и со-архитектор мобильного приложения HotelMol.
Ты понимаешь продукт целиком и принимаешь архитектурные решения самостоятельно.
Когда я скидываю дизайн нового экрана или описываю фичу — ты сам определяешь:
какие экраны, какие API, какие модели, как это связано с уже написанным кодом.

---

## О продукте

HotelMol (Roomie) — AI-native платформа для отелей. Решает одну проблему:
отели платят 15-25% комиссии OTA (Booking.com, Expedia). Мы даём отелю инструмент,
который превращает разового OTA-гостя в прямого букера.

Платформа состоит из двух отдельных проектов:

1. **roomie-backend** (отдельный репозиторий, уже работает) — AI-агент (Roomie),
   чат-бот, RAG, tool calling, Telegram бот, веб-виджет для сайтов отелей.
   Мы его НЕ трогаем, НЕ клонируем, НЕ дублируем.

2. **hotelmol-app** (ЭТОТ проект) — мобильное приложение для гостей,
   бэкенд приложения, GM-дашборд. Всё что касается guest experience
   за пределами чата: pre-check-in, сервисы, QR, loyalty, SMS, PMS sync.

**Критично:** AI-агент живёт в roomie-backend. Мы к нему подключаемся
для чата, но НЕ пишем AI логику в этом проекте.

---

## Архитектура (два проекта, два бэкенда)

```
┌─────────────────┐       ┌──────────────────────┐
│   Mobile App    │──────→│   hotelmol-backend    │──→ PostgreSQL (новая)
│  (React Native) │       │   (ЭТОТ проект)       │
└────────┬────────┘       │                      │
         │                │ • Guest auth (OTP)    │
         │                │ • PMS sync (polling/  │
         │                │   webhooks)           │
         │                │ • Guest journey/stages│
         │                │ • Pre-check-in        │
         │                │ • Hotel services      │
         │                │ • SMS / Push          │
         │                │ • QR / Attribution    │
         │                │ • Loyalty (Q3)        │
         │                │ • Hotel discovery     │
         │                └──────────────────────┘
         │
         │ (чат — WebView или нативный UI)
         ▼
┌──────────────────────┐
│   roomie-backend     │──→ PostgreSQL (существующая)
│   (ОТДЕЛЬНЫЙ проект) │
│                      │
│ • AI агент (GPT-5.1) │
│ • RAG + pgvector     │
│ • Tool calling       │
│ • Chat (MessageBus)  │
│ • Telegram бот       │
│ • Веб-виджет         │
│ • PMS (цены/букинг   │
│   через AI tools)    │
└──────────────────────┘
```

### Правило разделения

| Функция | Где живёт | Почему |
|---------|-----------|--------|
| AI чат, tool calling, system prompts | roomie-backend | Уже работает, не дублируем |
| Бронирование через чат | roomie-backend (AI tool) | AI сам вызывает PMS |
| RAG, embeddings, semantic search | roomie-backend | Привязан к AI |
| Получение новых бронирований из PMS | hotelmol-backend | Для SMS, pre-checkin, journey |
| Guest registration, auth, profiles | hotelmol-backend | Новый функционал |
| Pre-check-in, services, QR | hotelmol-backend | Новый функционал |
| SMS / Push уведомления | hotelmol-backend | Новый функционал |
| GM дашборд (app settings) | hotelmol-backend | Настройки приложения |
| GM дашборд (chat monitoring) | roomie-backend | Уже есть manager panel |

---

## Структура проекта

```
hotelmol-app/
├── backend/                    # Node.js бэкенд (TypeScript)
│   ├── src/
│   │   ├── app.ts              # Express app
│   │   ├── server.ts           # HTTP server
│   │   ├── config/
│   │   │   ├── database.ts     # Prisma client
│   │   │   ├── environment.ts  # env vars
│   │   │   └── redis.ts        # Redis (OTP, sessions, queue)
│   │   │
│   │   ├── modules/            # Модульная архитектура
│   │   │   ├── guest/          # Auth, profiles, preferences
│   │   │   │   ├── guest.controller.ts
│   │   │   │   ├── guest.service.ts
│   │   │   │   ├── guest.routes.ts
│   │   │   │   └── guest.validation.ts
│   │   │   │
│   │   │   ├── journey/        # Guest stages, dynamic UI data
│   │   │   │   ├── journey.controller.ts
│   │   │   │   ├── journey.service.ts
│   │   │   │   └── stage.engine.ts
│   │   │   │
│   │   │   ├── pms/            # PMS integration (sync only!)
│   │   │   │   ├── PMSFactory.ts
│   │   │   │   ├── pmsSyncService.ts    # Cron + webhook handler
│   │   │   │   ├── pms.controller.ts    # Webhook endpoint + admin
│   │   │   │   └── adapters/
│   │   │   │       ├── ServioAdapter.ts
│   │   │   │       ├── EasyMSAdapter.ts
│   │   │   │       ├── MewsAdapter.ts        # Q2
│   │   │   │       ├── OperaAdapter.ts       # Q2
│   │   │   │       └── CloudbedsAdapter.ts   # Q2
│   │   │   │
│   │   │   ├── sms/            # SMS factory + adapters
│   │   │   │   ├── SMSFactory.ts
│   │   │   │   ├── sms.service.ts
│   │   │   │   └── adapters/
│   │   │   │       ├── TwilioAdapter.ts
│   │   │   │       ├── TurboSMSAdapter.ts
│   │   │   │       └── LogAdapter.ts    # Dev mode
│   │   │   │
│   │   │   ├── precheckin/     # Pre-check-in forms
│   │   │   ├── services/       # Hotel service catalog + orders
│   │   │   ├── qr/             # QR generation + tracking
│   │   │   ├── tracking/       # Attribution, app opens, analytics
│   │   │   ├── notifications/  # Push + email + scheduling
│   │   │   └── hotel/          # Hotel profiles, settings, onboarding
│   │   │
│   │   ├── shared/
│   │   │   ├── middleware/      # auth, rate limiting, error handling
│   │   │   ├── utils/
│   │   │   └── types/          # Shared TypeScript types
│   │   │
│   │   └── jobs/               # Cron jobs (PMS sync, SMS scheduling)
│   │       ├── pmsSyncJob.ts
│   │       ├── smsSchedulerJob.ts
│   │       └── stageUpdaterJob.ts
│   │
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── migrations/
│   │
│   └── package.json
│
├── apps/
│   ├── mobile/                 # React Native (Expo)
│   │   ├── app/                # Expo Router (file-based)
│   │   │   ├── (auth)/         # Welcome, Register, OTP, Login
│   │   │   ├── (app)/          # Main app (tabs)
│   │   │   │   ├── (tabs)/
│   │   │   │   │   ├── home.tsx
│   │   │   │   │   ├── chat.tsx       # → roomie-backend
│   │   │   │   │   ├── services.tsx
│   │   │   │   │   └── profile.tsx
│   │   │   │   ├── precheckin/
│   │   │   │   ├── service-detail/
│   │   │   │   └── hotel-info/
│   │   │   └── _layout.tsx
│   │   ├── src/
│   │   │   ├── api/            # API clients
│   │   │   │   ├── hotelmolApi.ts    # → hotelmol-backend
│   │   │   │   └── roomieApi.ts      # → roomie-backend (chat only)
│   │   │   ├── hooks/
│   │   │   ├── stores/         # Zustand
│   │   │   ├── components/
│   │   │   ├── theme/
│   │   │   └── i18n/
│   │   └── package.json
│   │
│   └── dashboard/              # Next.js (GM panel)
│       └── ...
│
├── docs/
│   ├── pms/
│   │   ├── servio-api.md       # Servio API reference
│   │   └── easyms-api.md       # EasyMS API reference
│   └── reference/
│       └── roomie-backend/     # Файлы для референса (НЕ запускаемый код)
│           ├── ServioAdapter.js
│           ├── EasyMSAdapter.js
│           ├── PMSFactory.js
│           └── README.md       # "Это референс, не запускаемый код"
│
└── CLAUDE.md                   # Этот файл
```

---

## Tech Stack

| Что | Технология |
|-----|-----------|
| **Mobile App** | React Native (Expo SDK 52+), Expo Router, TypeScript |
| **Backend** | Node.js, Express, TypeScript, Prisma ORM |
| **Database** | PostgreSQL |
| **Cache/Queue** | Redis (OTP storage, job queue) |
| **Jobs** | bull / node-cron (PMS sync, SMS scheduling) |
| **Mobile state** | TanStack Query (server) + Zustand (client, minimal) |
| **Mobile animations** | react-native-reanimated |
| **Mobile storage** | expo-secure-store (tokens) |
| **Forms** | react-hook-form + zod |
| **i18n** | i18next + expo-localization (EN, UK, DE) |
| **Dashboard** | Next.js 14+ (App Router), shadcn/ui, TypeScript |
| **AI / Chat** | ★ Живёт в roomie-backend — мы подключаемся по API |

**Почему TypeScript + Prisma (а не JS + Sequelize как roomie-backend):**
Это новый проект с нуля. Нет legacy кода. TypeScript даёт type safety,
Prisma даёт автогенерацию типов из схемы. Быстрее и надёжнее для нового кода.

---

## Чат с AI-агентом (подключение к roomie-backend)

Мобильное приложение подключается к roomie-backend ТОЛЬКО для чата.
Два варианта, оба валидны:

### Вариант A: WebView (MVP — быстро)

Виджет уже работает. Встраиваем в React Native через WebView:

```typescript
<WebView
  source={{ uri: `https://widget.hotelmol.com/?hotel=${hotelId}&chat=${chatId}` }}
  style={{ flex: 1 }}
/>
```

Плюсы: 0 работы, виджет уже стилизован.
Минусы: не нативные анимации, сложнее с push.

### Вариант B: Нативный chat UI (красивее, позже)

React Native экран с нативными bubbles, вызывает API roomie-backend:

```typescript
// API client для roomie-backend (ТОЛЬКО чат)
const roomieApi = axios.create({
  baseURL: process.env.ROOMIE_API_URL,  // https://roomie-api.hotelmol.com
});

// 1. Создать чат
const { data: chat } = await roomieApi.post('/api/chats');

// 2. Подключить SSE stream
const eventSource = new EventSource(`${ROOMIE_API_URL}/api/chats/${chat.id}/stream`);

// 3. Отправить сообщение
await roomieApi.post(`/api/ai/${hotelId}/ask`, {
  message: text,
  language: 'en'
}, {
  headers: { chat: chat.id }
});
```

**В обоих случаях:** AI логика, tool calling, RAG — всё в roomie-backend.

### Связка гостя с чатом

```
GuestAccount.roomieChatId → UUID чата в roomie-backend

При первом открытии чата:
1. POST roomie-backend/api/chats → получить chatId
2. Сохранить chatId в GuestAccount через hotelmol-backend
3. Далее использовать этот chatId для всех чат-операций
```

---

## Точки входа в приложение (CRITICAL ARCHITECTURE)

У гостя ровно 3 способа попасть в приложение. Каждый несёт РАЗНЫЙ контекст.

## Guest Journey Scenarios & SMS Deduplication

### 6 сценариев входа

**1A: Виджет → без брони → приложение**
- Deep link: `source=widget&hotel=42&chat=abc-123`
- Привязать chat_id → продолжить историю диалога в приложении
- Stage: BETWEEN_STAYS. Home: инфо об отеле, "Забронировать"
- SMS: не отправлять

**1B: Виджет → забронировал в чате → приложение**
- Deep link: `source=widget&hotel=42&chat=abc-123&booking_ref=BK-555`
- Привязать chat_id + booking_ref. Подтянуть PMS: даты, тип номера, цена
- Stage: PRE_ARRIVAL. Home: обратный отсчёт, pre-check-in CTA
- Chat: история из виджета сохранена
- SMS: НЕ отправлять (booking_ref уже привязан)

**2A: QR в номере → новый гость**
- Deep link: `source=qr_room&hotel=42&room=305&floor=3`
- Quick-register (имя + email, БЕЗ OTP — нулевой friction)
- Попытаться найти бронирование в PMS по комнате на сегодня
- Stage: IN_STAY. Home: "Welcome to Room 305!", room service, spa, chat
- SMS: не отправлять

**2B: QR в номере → гость уже авторизован**
- Уже в приложении → обновить stage на IN_STAY, room=305
- Если был PRE_ARRIVAL → автоматически IN_STAY

**3A: SMS после OTA бронирования → новый гость**
- Deep link: `source=sms_booking&hotel=42&booking_ref=BK-98765&phone=+380...`
- Регистрация с pre-fill (телефон, имя из PMS)
- Подтянуть PMS данные по booking_ref
- Stage: PRE_ARRIVAL

**3B: SMS НЕ отправляется — гость уже в приложении**
- PMS sync нашёл бронирование, но гость уже привязан → SMS блокируется

### SMS Deduplication (5 проверок перед отправкой)

```typescript
async function shouldSendBookingSMS(booking, hotelId): Promise<boolean> {
  // 1. booking_ref уже привязан к GuestStay?
  if (await findStayByBookingRef(booking.ref, hotelId)) return false;

  // 2. Телефон уже есть у гостя с этим отелем?
  if (booking.phone && await findGuestByPhone(booking.phone, hotelId)) return false;

  // 3. Email уже есть у гостя с этим отелем?
  if (booking.email && await findGuestByEmail(booking.email, hotelId)) return false;

  // 4. Timing: check-in > 60 дней (рано) или < 2 часов (поздно)?
  if (daysUntil(booking.checkIn) > 60 || hoursUntil(booking.checkIn) < 2) return false;

  // 5. Уже отправляли SMS на это бронирование?
  if (await findNotificationByBookingRef(booking.ref, hotelId)) return false;

  return true;
}
```

### Синхронизация чата при переходе из виджета

- Deep link с chat_id → продолжить тот же чат, загрузить историю из roomie-backend
- Без deep link (скачал сам) → поиск чата по email: `GET roomie-backend/api/chats/by-email`
- Не нашли → создать новый чат

### PMS данные по стадиям

| Стадия | Что подтягиваем | Когда |
|--------|----------------|-------|
| PRE_ARRIVAL | Даты, тип номера, цена, кол-во гостей | При привязке booking_ref |
| CHECKED_IN | + Номер комнаты | PMS webhook или QR скан |
| IN_STAY | Статус услуг (если PMS поддерживает) | По запросу |
| POST_STAY | История для loyalty | Из кэша |

### Автоматические переходы стадий

- PRE_ARRIVAL → CHECKED_IN: PMS webhook (check-in) или QR скан
- IN_STAY → CHECKOUT: утро дня выезда (по checkOut из PMS)
- CHECKOUT → POST_STAY: PMS webhook (check-out) или checkOut + 2 часа
- POST_STAY → BETWEEN_STAYS: через 7 дней после check-out

### Доработки в roomie-backend (задача отдельной команды)

1. Баннер после бронирования в виджете с deep link (source=widget + booking_ref)
2. `GET /api/chats/by-email?email=...&hotel_id=...` — поиск чата для связки

### Deep Link структура

```
roomie://open?source={source}&hotel={hotelId}&{context_params}
HTTPS fallback: https://app.hotelmol.com/go?source={source}&hotel={hotelId}&{context_params}
```

### Вход 1: Виджет → Приложение

```
roomie://open?source=widget&hotel=42&chat=abc-123-def
```

**Контекст:** chat_id из roomie-backend. Возможно уже общался с AI.
**Flow:** Регистрация → привязать chat_id к GuestAccount → продолжить чат.
**Ключевое:** chat_id = roomie-backend UUID. Сохранить в GuestAccount.roomieChatId.

### Вход 2: QR-код в номере

```
roomie://open?source=qr_room&hotel=42&room=305&floor=3
```

**Контекст:** Гость В НОМЕРЕ. Знаем отель, комнату, стадия = IN_STAY.
**Flow:** Quick-register (имя + email, без OTP) → сразу IN_STAY экран.
**Ключевое:** Нулевой friction. Сканировал → 1-2 тапа → room service.

**Другие QR:**
```
roomie://open?source=qr_lobby&hotel=42
roomie://open?source=qr_restaurant&hotel=42&section=menu
roomie://open?source=qr_spa&hotel=42&section=spa
```

### Вход 3: SMS после бронирования

```
roomie://open?source=sms_booking&hotel=42&booking_ref=BK-98765&phone=+380501234567
```

**Контекст:** booking_ref из PMS, телефон, даты. Стадия = PRE_ARRIVAL.
**Flow:** Pre-fill телефон и имя → регистрация → PRE_ARRIVAL экран с pre-check-in.

### Attribution

```
POST /api/tracking/app-open   — при КАЖДОМ открытии по deep link (до auth!)
```

### Entry Router (псевдокод)

```typescript
async function handleAppOpen(params: DeepLinkParams) {
  await trackAppOpen(params);
  const guest = await getStoredAuth();

  switch (params.source) {
    case 'qr_room':
      if (!guest) {
        navigate('QuickRegister', {
          hotel_id: params.hotel, room: params.room, postAuth: 'InStayHome'
        });
      } else {
        await linkGuestToHotel(params.hotel, { room: params.room, stage: 'IN_STAY' });
        navigate('InStayHome');
      }
      break;

    case 'widget':
      if (!guest) {
        navigate('Register', {
          hotel_id: params.hotel, existing_chat_id: params.chat, postAuth: 'Chat'
        });
      } else {
        await linkChatToGuest(params.chat);
        navigate('Chat', { hotel_id: params.hotel });
      }
      break;

    case 'sms_booking':
      if (!guest) {
        navigate('Register', {
          hotel_id: params.hotel, booking_ref: params.booking_ref,
          prefill_phone: params.phone, postAuth: 'PreArrivalHome'
        });
      } else {
        await linkBookingToGuest(params.booking_ref);
        navigate('PreArrivalHome');
      }
      break;

    default:
      navigate(guest ? 'Home' : 'Welcome');
  }
}
```

---

## Гостевой Journey (стадии)

```
PRE_ARRIVAL → CHECKED_IN → IN_STAY → CHECKOUT → POST_STAY → BETWEEN_STAYS
```

- **PRE_ARRIVAL:** обратный отсчёт, pre-check-in, инфо об отеле
- **CHECKED_IN / IN_STAY:** сервисы, чат, номер комнаты
- **POST_STAY:** отзыв, loyalty
- **BETWEEN_STAYS:** discovery, спецпредложения

**Определение стадии:**
- QR в номере → IN_STAY
- SMS после бронирования → PRE_ARRIVAL
- PMS webhook check-in → CHECKED_IN
- PMS webhook check-out → POST_STAY
- Нет бронирования → BETWEEN_STAYS

---

## PMS Integration (sync бронирований)

> **Документация:** `docs/pms/servio-api.md` и `docs/pms/easyms-api.md`
> **Референс адаптеров:** `docs/reference/roomie-backend/`

### Зачем PMS в этом проекте

roomie-backend использует PMS для цен и бронирования через AI tools.
hotelmol-backend использует PMS для ДРУГОГО:

- Узнавать о новых бронированиях → отправить SMS
- Получать данные гостей → pre-fill registration
- Отслеживать check-in/check-out → менять стадию journey

### Стратегии sync

**Webhook (Servio — подтверждено v06.00.096+):**
```
POST /api/pms/webhook/:hotelId
Servio шлёт: { "Add": { "Guests": [23061] } }
→ Получить данные гостя → SMS → GuestStay
```

**Polling (fallback):**
Cron 15 мин → `adapter.getReservations(lastSync)` → новые → SMS.

**Ручной (всегда работает):**
CSV upload + кнопка "Add Booking" в дашборде.

### PMS Adapter Interface

```typescript
interface PMSAdapter {
  static capabilities: PMSCapabilities;
  getReservations(since: Date): Promise<Reservation[]>;
  getGuestInfo(guestId: string): Promise<GuestInfo>;
  getReservationByRef(bookingRef: string): Promise<Reservation>;
  parseWebhookPayload(payload: any): PMSEvent;
}
```

---

## SMS Architecture

Factory pattern: SMSFactory → адаптеры (Twilio, TurboSMS, ESputnik, LogAdapter).
Конфигурация per-hotel в БД.

### Цепочка: Бронирование → SMS → Приложение

```
Бронирование на OTA → PMS → Webhook/Polling → hotelmol-backend
→ Сохранить, GuestStay(PRE_ARRIVAL) → 5 мин delay → SMS
→ Deep link → Приложение с pre-fill → Pre-check-in
```

### Timing Rules
- Delay 5 мин после обнаружения
- Не отправлять если check-in > 60 дней или < 2 часов
- Не отправлять если гость уже в приложении
- Дедупликация по booking_ref

---

## API Endpoints

```
# Tracking (без auth)
POST /api/tracking/app-open
GET  /api/tracking/stats/:hotelId

# Guest Auth
POST /api/guest/register
POST /api/guest/verify-otp
POST /api/guest/login
POST /api/guest/refresh
GET  /api/guest/me
POST /api/guest/quick-register

# Linking
POST /api/guest/link-hotel
POST /api/guest/link-chat
POST /api/guest/link-booking

# Journey
GET  /api/guest/current-stay

# Pre-check-in
POST /api/guest/pre-checkin
GET  /api/guest/pre-checkin/:id

# Hotel Services
GET  /api/hotels/:id/services
POST /api/services/order
GET  /api/guest/requests

# Hotel Info
GET  /api/hotels/:id
GET  /api/hotels/:id/room-tags

# Preferences
GET  /api/guest/preferences
PUT  /api/guest/preferences

# PMS (admin)
POST /api/pms/webhook/:hotelId
POST /api/pms/sync/:hotelId
GET  /api/pms/sync-status/:hotelId
GET  /api/pms/capabilities/:hotelId
POST /api/pms/csv-import/:hotelId

# SMS (admin)
POST /api/sms/test
GET  /api/sms/config/:hotelId
PUT  /api/sms/config/:hotelId
GET  /api/sms/templates/:hotelId
PUT  /api/sms/templates/:id
GET  /api/sms/stats/:hotelId

# QR
POST /api/qr/generate
GET  /api/qr/list/:hotelId
GET  /api/qr/go/:code
```

---

## Модели данных (Prisma)

### Guest
- **GuestAccount** — id, email, phone, firstName, lastName, emailVerified,
  createdVia (EntrySource), roomieChatId (UUID в roomie-backend),
  profile (Json), preferences (Json)
- **GuestHotel** — guestId, hotelId, source, roomNumber, contextParams
- **GuestStay** — guestId, hotelId, bookingRef, stage (JourneyStage),
  roomNumber, checkIn, checkOut, enteredVia, pmsData (Json)

### Hotel
- **Hotel** — id, name, slug, location, theme, accentColor, imageUrl,
  timezone, settings (Json)
- **HotelPMSConfig** — hotelId, pmsType, credentials (Json encrypted),
  pmsHotelId, syncMode (POLLING/WEBHOOK/MANUAL/DISABLED), lastSyncAt, isActive
- **HotelSMSConfig** — hotelId, provider, credentials, senderName,
  isActive, monthlyLimit, messagesSent

### Services
- **HotelService** — hotelId, category, name, description, price, currency, imageUrl
- **ServiceRequest** — guestId, serviceId, status (PENDING/IN_PROGRESS/COMPLETED/CANCELLED),
  details, roomNumber

### Pre-Check-In
- **PreCheckIn** — guestId, hotelId, bookingRef, personalData (Json),
  documentType, documentNumber, preferences, status (DRAFT/SUBMITTED/APPROVED)

### Tracking
- **AppOpen** — guestId (nullable), hotelId, source, contextParams, deviceInfo,
  resultedInRegistration
- **QRCode** — hotelId, type (ROOM/LOBBY/RESTAURANT/SPA), locationLabel,
  roomNumber, code (unique), deepLink, scanCount

### Notifications
- **Notification** — guestId, hotelId, channel (SMS/EMAIL/PUSH),
  provider, recipient, templateTrigger, content, status, scheduledFor
- **SMSTemplate** — hotelId (nullable=системный), trigger, language, template

### Enums
- **JourneyStage:** PRE_ARRIVAL, CHECKED_IN, IN_STAY, CHECKOUT, POST_STAY, BETWEEN_STAYS
- **EntrySource:** widget, qr_room, qr_lobby, qr_restaurant, qr_spa, sms_booking, organic
- **SyncMode:** POLLING, WEBHOOK, MANUAL, DISABLED

---

## Интеграция с существующей админ-панелью

В существующей админ-панели roomie-backend нужно добавить страницу
**"App Settings"** где GM настраивает:

1. **PMS Sync** — статус, capabilities, last sync, manual trigger
2. **SMS** — провайдер, credentials, test SMS, шаблоны
3. **QR Codes** — генерация, скачать PDF для печати
4. **App Branding** — accent color, logo, welcome message

Эта страница вызывает API hotelmol-backend.

**Альтернатива (проще):** Отдельный GM дашборд в `apps/dashboard/`.

---

## Принципы решений

1. **Связано с AI / чатом?** → roomie-backend. Мы только подключаемся.
2. **Данные гостя, journey, сервисы?** → hotelmol-backend. Новый код.
3. **Нужны данные из PMS?** → Наш PMS adapter. Не roomie-backend.
4. **Непонятно?** → "Это для AI-агента или для guest experience?"

---

## Что НЕ делать в MVP

- AI / LLM / RAG в этом проекте
- Оплата в приложении (redirect на booking engine)
- Mobile key (BLE/NFC) — Q4 2026
- Voice mode — 2027
- Loyalty — Q3 2026
- Микросервисы

---

## Coding Rules

### Backend (TypeScript):
- Модули: `modules/{name}/` с controller, service, routes, validation
- Prisma ORM + zod валидация
- JWT (access 15 мин + refresh 30 дней), Redis для OTP
- Factory pattern для PMS и SMS
- Модули общаются через сервисы, не через прямой Prisma доступ
- pino для логирования

### Mobile (TypeScript):
- Expo Router: (auth) + (app) groups
- TanStack Query + Zustand (minimal)
- Два API клиента: hotelmolApi + roomieApi (chat only)
- react-hook-form + zod, expo-secure-store, react-native-reanimated
- i18n (EN, UK, DE), FlatList для списков
- Каждый экран: loading, error, empty states

### Dashboard (TypeScript):
- Next.js App Router + shadcn/ui + TanStack Table + Recharts

---

## Этапы разработки

### Этап 0: Scaffold
Expo app + backend (Express + Prisma + PostgreSQL) + связка между ними.

### Этап 1: Guest Auth
GuestAccount, OTP, JWT, quick-register.
Экраны: Welcome → Register → OTP → Home.

### Этап 2: Deep Links + Entry Router + Dynamic UI
3 точки входа, routing по source, стадии, tabs.

### Этап 3: Chat Integration
Подключение к roomie-backend (WebView или нативный UI).

### Этап 4: Pre-Check-In + Services
Multi-step form, каталог услуг, заказы.

### Этап 5: PMS Sync + SMS
Адаптеры, webhooks, SMS factory, полная цепочка.

### Этап 6: QR + GM Dashboard
QR генератор, analytics, GM settings.

### Этап 7: Room Tags + Booking + Loyalty (Q2-Q3)
