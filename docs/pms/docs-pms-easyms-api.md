# EasyMS — API Reference для HotelMol

> Источники: существующий EasyMSAdapter.js + docs.easyms.co/swagger-ui.html
> EasyMS — украинская cloud PMS для отелей и хостелов

---

## Подключение

| Параметр | Значение |
|----------|----------|
| Base URL | `https://my.easyms.co` |
| Auth | Bearer token (получается через /api/integration/auth) |
| Content-Type | `application/json` |
| Ответ | JSON: `{ data: {...}, error: null }` |

### Аутентификация

```
POST /api/integration/auth
```

**Request:**
```json
{
  "username": "...",
  "password": "..."
}
```

**Response:**
```json
{
  "data": {
    "access_token": "eyJhbGci..."
  }
}
```

Все последующие запросы: `Authorization: Bearer {access_token}`

### Конфигурация per-hotel (HotelPMSInfo.data)

```json
{
  "organizationId": 42,
  "defaultRateId": 7
}
```

---

## Существующие методы (уже используются в адаптере)

### 1. Get Categories (Room Types)

```
GET /api/integration/categories?organizationId={id}
```

**Response:**
```json
[
  { "id": 1, "name": "Standard" },
  { "id": 2, "name": "Deluxe" },
  { "id": 3, "name": "Suite" }
]
```

---

### 2. Get Availability

```
GET /api/integration/availability?organizationId={id}&dateFrom={date}&dateTo={date}
```

**Response:**
```json
[
  {
    "categoryId": 1,
    "dailyOccupancies": [
      { "date": "2026-03-15T00:00:00Z", "available": 3, "occupancy": 2 },
      { "date": "2026-03-16T00:00:00Z", "available": 2, "occupancy": 3 }
    ]
  }
]
```

---

### 3. Get Prices

```
GET /api/integration/prices?organizationId={id}&categories={catId}&dateFrom={date}&dateTo={date}&rateId={rateId}&detailed=true
```

**Response:**
```json
{
  "prices": [
    { "categoryId": 1, "date": "2026-03-15", "value": 1500 },
    { "categoryId": 1, "date": "2026-03-16", "value": 1500 },
    { "categoryId": 1, "date": "2026-03-17", "value": 1800 }
  ]
}
```

---

### 4. Create Order (Reservation)

```
POST /api/integration/orders
```

**Request:**
```json
{
  "organizationId": 42,
  "customer": {
    "name": "Олег Петренко",
    "telephone": "+380501234567",
    "email": "oleg@example.com",
    "remarks": "Нужна подушка"
  },
  "rooms": [
    {
      "arrival": "2026-03-15",
      "departure": "2026-03-18",
      "categoryId": 1,
      "rateId": 7,
      "invoice": 4800
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "orderId": 9876
  }
}
```

---

## Методы для PMS Sync (НУЖНО ПРОВЕРИТЬ В SWAGGER)

Swagger UI доступен по адресу: https://docs.easyms.co/swagger-ui.html#/API
Swagger JSON (предположительно): https://docs.easyms.co/v3/api-docs

### Предполагаемые endpoints (нужно верифицировать):

```
GET /api/integration/orders?organizationId={id}&dateFrom={date}&dateTo={date}
    → Список бронирований за период

GET /api/integration/orders/{orderId}
    → Детали бронирования

GET /api/integration/guests?organizationId={id}
    → Список гостей

GET /api/integration/occupancy?organizationId={id}&date={date}
    → Текущая заселённость (кто в каком номере)
```

**⚠️ TODO для CEO:**
Открой https://docs.easyms.co/swagger-ui.html → 
посмотри все endpoints в категории "API" или "Integration" →
скопируй сюда те, которые связаны с:
- Получение списка бронирований (orders)
- Получение данных гостя
- Получение текущей заселённости
- Webhooks (если есть)

Также проверь:
- Есть ли у EasyMS webhook support (push уведомления при новом бронировании)?
- Есть ли endpoint для получения check-in / check-out событий?
- Можно ли фильтровать orders по дате создания (для incremental sync)?

---

## Webhooks

**Статус: НЕИЗВЕСТНО — нужно проверить в документации.**

EasyMS — cloud-based система, поэтому есть шанс что webhooks поддерживаются.
Если да — это предпочтительнее polling.

Если webhooks нет — используем polling:
1. Каждые 15 мин: GET /api/integration/orders?dateFrom={lastSync}
2. Сравниваем с нашими Reservations
3. Новые → сохранить + SMS

---

## EasyMS capabilities (для PMSFactory)

```javascript
static capabilities = {
  getRoomTypes: true,          // GET /api/integration/categories ✅
  getAvailability: true,       // GET /api/integration/availability ✅
  getPrices: true,             // GET /api/integration/prices ✅
  createReservation: true,     // POST /api/integration/orders ✅
  getReservations: 'unknown',  // GET /api/integration/orders? — НУЖНО ПРОВЕРИТЬ
  getGuestInfo: 'unknown',     // — НУЖНО ПРОВЕРИТЬ
  webhooks: 'unknown',         // — НУЖНО ПРОВЕРИТЬ
  webhookEvents: []
};
```

---

## Отличия от Servio

| | Servio | EasyMS |
|---|---|---|
| Протокол | POST для всех методов | REST (GET/POST) |
| Auth | Static AccessToken header | OAuth-like (login → Bearer token) |
| Base URL | On-premise (`http://host:port`) | Cloud (`https://my.easyms.co`) |
| Response format | Flat JSON with Error/ErrorCode | `{ data: {...}, error: null }` |
| Webhooks | ✅ Confirmed (v06.00.096+) | ❓ Unknown |
| ID формат | Числовые ID | Числовые ID |
| Валюта | Строки ("2500.00") | Числа (1500) |
| Бронирование | AddRoomReservation (requires PriceListID) | POST /orders (requires invoice sum) |

---

## Ссылки

- Swagger UI: https://docs.easyms.co/swagger-ui.html#/API
- EasyMS сайт: https://easyms.co/
- Поддержка: t.me/easyms
