# Servio HMS — API Reference для HotelMol

> Источники: существующий ServioAdapter.js + wiki.servio.support + wiki.expertsolution.com.ua
> Страница документации: wiki.expertsolution.com.ua → API Протокол взаємодії Servio External Service

---

## Подключение

| Параметр | Значение |
|----------|----------|
| Base URL | `http://{host}:{port}/ReservationService_1_10` |
| Пример | `http://svc8.servio.support/8007/ReservationService_1_10` |
| Протокол | HTTP POST (все методы) |
| Auth | Header `AccessToken: {token}` |
| Content-Type | `application/json` |
| Ответ | JSON |

### Конфигурация per-hotel (HotelPMSInfo.data)

```json
{
  "CompanyID": 123,
  "CompanyCodeID": 456,
  "HotelID": 789,
  "ContractConditionID": 101
}
```

---

## Существующие методы (уже используются в адаптере)

### 1. GetRoomTypesList

Получить список типов номеров отеля.

```
POST /ReservationService_1_10/GetRoomTypesList
```

**Request:**
```json
{
  "HotelID": 789
}
```

**Response:**
```json
{
  "ClassNames": ["Standard", "Deluxe", "Suite"],
  "IDs": [1, 2, 3]
}
```

---

### 2. GetRooms (Availability)

Получить доступность номеров на даты.

```
POST /ReservationService_1_10/GetRooms
```

**Request:**
```json
{
  "HotelID": 789,
  "Adults": 2,
  "Childs": 0,
  "ChildAges": [],
  "DateArrival": "2026-03-15",
  "DateDeparture": "2026-03-18",
  "TimeArrival": "14:00",
  "TimeDeparture": "12:00",
  "IsExtraBedUsed": false,
  "CompanyCodeID": 456,
  "IsoLanguage": "uk"
}
```

**Response:**
```json
{
  "RoomTypes": [
    {
      "ID": 1,
      "FreeRoom": 3,
      "MainPlacesCount": 2,
      "NearestDateToReservation": "2026-03-15"
    }
  ],
  "Error": null,
  "ErrorCode": null
}
```

---

### 3. GetPrices

Получить цены на конкретный тип номера.

```
POST /ReservationService_1_10/GetPrices
```

**Request:**
```json
{
  "HotelID": 789,
  "Adults": 2,
  "Childs": 0,
  "ChildAges": [],
  "DateArrival": "2026-03-15",
  "DateDeparture": "2026-03-18",
  "RoomTypeIDs": [1],
  "PaidType": 200,
  "ContractConditionID": 101,
  "CompanyID": 123,
  "IsExtraBedUsed": false,
  "IsoLanguage": "uk",
  "TimeArrival": "14:00",
  "TimeDeparture": "12:00",
  "NeedTransport": 0,
  "LoyaltyAuthCode": "",
  "IsTouristTax": 0,
  "ShowBedSale": null,
  "ContractConditionAddIDs": null
}
```

**Response:**
```json
{
  "PriceLists": [
    {
      "PriceListID": 555,
      "RoomTypes": [
        {
          "ID": 1,
          "Services": [
            {
              "ServiceSystemCode": "dwelling",
              "PriceDates": [
                { "Date": "2026-03-15 14:00:00", "Price": "2500.00" },
                { "Date": "2026-03-16 14:00:00", "Price": "2500.00" },
                { "Date": "2026-03-17 14:00:00", "Price": "2500.00" }
              ]
            },
            {
              "ServiceSystemCode": "TouristTax",
              "PriceDates": [
                { "Date": "2026-03-15 14:00:00", "Price": "47.50" }
              ]
            }
          ]
        }
      ]
    }
  ],
  "Error": null,
  "ErrorCode": null
}
```

---

### 4. AddRoomReservation

Создать бронирование.

```
POST /ReservationService_1_10/AddRoomReservation
```

**Request:**
```json
{
  "HotelID": 789,
  "PriceListID": 555,
  "DateArrival": "2026-03-15",
  "DateDeparture": "2026-03-18",
  "RoomTypeID": 1,
  "TimeArrival": "14:00",
  "TimeDeparture": "12:00",
  "Adults": 2,
  "Childs": 0,
  "ChildAges": [],
  "GuestFirstName": "Олег",
  "GuestLastName": "Петренко",
  "Phone": "+380501234567",
  "eMail": "oleg@example.com",
  "Comment": "Нужна подушка",
  "PaidType": 200,
  "CompanyID": 123,
  "ContractConditionID": 101,
  "IsTouristTax": 1,
  "IsExtraBedUsed": false,
  "ISOCodeValute": "UAH",
  "NeedTransport": 0,
  "LoyaltyCardNumber": "",
  "AgentCategory": 0
}
```

**Response (успех):**
```json
{
  "Account": 12345,
  "Error": null,
  "ErrorCode": null
}
```

**Response (ошибка):**
```json
{
  "Account": null,
  "Error": "No rooms available for selected dates",
  "ErrorCode": "NO_AVAILABILITY"
}
```

---

## Методы для PMS Sync (НУЖНО ПРОВЕРИТЬ ДОСТУПНОСТЬ)

Судя по URL документации, которую предоставил CEO (#GetGuestsModified),
Servio API вероятно имеет следующие дополнительные методы.
**Их наличие и параметры нужно верифицировать по документации
на wiki.expertsolution.com.ua.**

### GetGuestsModified (предположительно)

Получить гостей, изменённых после указанной даты. Критически важен для sync.

```
POST /ReservationService_1_10/GetGuestsModified
```

**Предполагаемый Request:**
```json
{
  "HotelID": 789,
  "DateFrom": "2026-02-18T00:00:00"
}
```

### Другие возможные методы (нужно проверить в документации):

- `GetReservations` / `GetReservationsList` — получить список бронирований
- `GetReservationDetails` — детали бронирования по ID
- `GetGuestInfo` — информация о госте по ID
- `GetRoomOccupancy` — текущая заселённость номеров
- `GetArrivals` / `GetDepartures` — кто заезжает/выезжает на дату

**⚠️ TODO для CEO:**
Открой wiki.expertsolution.com.ua → API Протокол взаємодії →
скопируй полный список методов и их параметры в этот файл.
Особенно важны: всё что связано с получением бронирований и данных гостей.

---

## Webhooks (ПОДТВЕРЖДЕНО — работает с версии 06.00.096)

**Это ключевая находка!** Servio HMS поддерживает webhooks — push-уведомления
при событиях с гостями, анкетами, компаниями и комнатами.

### Настройка в Servio HMS

1. Settings → Other → Quick response to events
2. Name: "HotelMol Integration"
3. Service address: `https://api.hotelmol.com/api/pms/webhook/{hotelId}`
4. Flags: Guest (Addition ✅, Change ✅, Removal ✅), Room (Change ✅)

### Поддерживаемые события

| Counterparty | Events |
|---|---|
| Questionnaire (Анкета) | Addition, Change, Removal (unification of duplicates) |
| Guest (Гость) | Addition, Change, Removal (cancellation) |
| Company (Компания) | Addition, Change, Removal (cancellation) |
| Room (Комната) | Change (cleaning status) |

### Формат webhook payload (JSON)

**Новый гость (check-in / бронирование):**
```json
{
  "Add": {
    "Clients": null,
    "Companies": null,
    "Guests": [23061]
  },
  "Update": null,
  "Delete": null
}
```

**Изменение гостя:**
```json
{
  "Add": null,
  "Update": {
    "Rooms": null,
    "Clients": null,
    "Companies": null,
    "Guests": [23061]
  },
  "Delete": null
}
```

**Удаление/отмена гостя:**
```json
{
  "Add": null,
  "Update": null,
  "Delete": {
    "Clients": null,
    "Companies": null,
    "Guests": [23061]
  }
}
```

**Изменение статуса комнаты (уборка):**
```json
{
  "Add": null,
  "Update": {
    "Rooms": [160],
    "Clients": null,
    "Companies": null,
    "Guests": null
  },
  "Delete": null
}
```

**Новая анкета + удаление дубликатов:**
```json
{
  "Add": {
    "Clients": [12766],
    "Companies": null,
    "Guests": null
  },
  "Update": null,
  "Delete": null
}
```

### Наш webhook handler

При получении webhook с Guest.Add:
1. Вызвать GetGuestsModified (или GetGuestInfo) чтобы получить данные гостя
2. Если есть телефон → запланировать SMS
3. Создать/обновить GuestStay

При Guest.Delete:
1. Обновить статус бронирования → CANCELLED

При Room.Update:
1. Обновить статус уборки в нашей системе (для GM дашборда)

### Servio capabilities (для PMSFactory)

```javascript
static capabilities = {
  getRoomTypes: true,        // GetRoomTypesList ✅
  getAvailability: true,     // GetRooms ✅
  getPrices: true,           // GetPrices ✅
  createReservation: true,   // AddRoomReservation ✅
  getReservations: 'unknown', // GetGuestsModified? — НУЖНО ПРОВЕРИТЬ
  getGuestInfo: 'unknown',   // — НУЖНО ПРОВЕРИТЬ
  webhooks: true,            // ✅ Confirmed (v06.00.096+)
  webhookEvents: ['guest.add', 'guest.update', 'guest.delete', 'room.update']
};
```

---

## Ссылки

- Webhook документация: https://wiki.servio.support/index.php?title=Налаштування_Webhook/en
- API документация (полная): спросить CEO за доступ к wiki.expertsolution.com.ua
- Servio HMS продукт: https://serviosoft.com/
