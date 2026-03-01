# Dashboard API Documentation

Base URL: `http://localhost:3001` (dev) / `https://api.hotelmol.com` (prod)

All protected endpoints require: `Authorization: Bearer <token>`

---

## Auth

### POST /api/dashboard/auth/login

Login as GM (hotel manager).

**Request:**
```json
{ "username": "gm_kyiv", "password": "secret123" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "manager": {
      "id": "uuid",
      "username": "gm_kyiv",
      "role": "manager",
      "hotels": [
        { "id": "hotel-uuid", "name": "Grand Hotel Kyiv", "slug": "grand-kyiv" }
      ]
    }
  }
}
```

```bash
curl -X POST http://localhost:3001/api/dashboard/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"gm_kyiv","password":"secret123"}'
```

---

## Overview

### GET /api/dashboard/hotels/:hotelId/overview

Key metrics for today. Refresh every 30–60 seconds.

**Response:**
```json
{
  "success": true,
  "data": {
    "todayGuests": 12,
    "todayOrders": 34,
    "todayQRScans": 7,
    "todaySMS": 5,
    "todayRevenue": 1240.50,
    "recentOrders": [
      {
        "id": "uuid",
        "roomNumber": "305",
        "guestName": "Іван Петренко",
        "items": "Капучино x2, Круасан x1",
        "status": "PREPARING",
        "totalAmount": 18.50,
        "createdAt": "2026-02-26T09:14:00.000Z"
      }
    ],
    "recentGuestChanges": [
      {
        "guestName": "Марія Коваль",
        "fromStage": "PRE_ARRIVAL",
        "toStage": "IN_STAY",
        "roomNumber": "301",
        "changedAt": "2026-02-26T14:00:00.000Z"
      }
    ]
  }
}
```

```bash
curl http://localhost:3001/api/dashboard/hotels/HOTEL_ID/overview \
  -H "Authorization: Bearer TOKEN"
```

---

## Guests

### GET /api/dashboard/hotels/:hotelId/guests

Paginated guest list with filters.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `stage` | string | Filter: `PRE_ARRIVAL`, `IN_STAY`, `POST_STAY`, `BETWEEN_STAYS` |
| `search` | string | Search by name / email / phone |
| `page` | number | Default: 1 |
| `limit` | number | Default: 20, max: 100 |

**Response:**
```json
{
  "success": true,
  "data": {
    "guests": [
      {
        "id": "stay-uuid",
        "guestName": "Іван Петренко",
        "phone": "+380501234567",
        "email": "ivan@example.com",
        "roomNumber": "305",
        "stage": "IN_STAY",
        "checkIn": "2026-02-25T14:00:00.000Z",
        "checkOut": "2026-02-28T12:00:00.000Z",
        "source": "booking.com",
        "preCheckinCompleted": true
      }
    ],
    "total": 47,
    "page": 1,
    "totalPages": 3
  }
}
```

```bash
curl "http://localhost:3001/api/dashboard/hotels/HOTEL_ID/guests?stage=in_stay&page=1&limit=20" \
  -H "Authorization: Bearer TOKEN"

# With search
curl "http://localhost:3001/api/dashboard/hotels/HOTEL_ID/guests?search=Іван" \
  -H "Authorization: Bearer TOKEN"
```

---

## Orders

### GET /api/dashboard/hotels/:hotelId/orders

Paginated orders list.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `active` (pending+preparing+in_transit) \| `completed` (delivered) \| `all` |
| `date` | string | ISO date: `2026-02-26` |
| `page` | number | Default: 1 |
| `limit` | number | Default: 20 |

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "order-uuid",
        "orderNumber": "HM-00042",
        "roomNumber": "305",
        "guestName": "Іван Петренко",
        "items": [
          { "name": "Капучино", "quantity": 2, "price": 4.50 },
          { "name": "Круасан", "quantity": 1, "price": 3.00 }
        ],
        "totalAmount": 12.00,
        "status": "PREPARING",
        "createdAt": "2026-02-26T09:14:00.000Z",
        "updatedAt": "2026-02-26T09:18:00.000Z"
      }
    ],
    "total": 34,
    "page": 1,
    "totalPages": 2
  }
}
```

```bash
curl "http://localhost:3001/api/dashboard/hotels/HOTEL_ID/orders?status=active" \
  -H "Authorization: Bearer TOKEN"

# By date
curl "http://localhost:3001/api/dashboard/hotels/HOTEL_ID/orders?date=2026-02-26" \
  -H "Authorization: Bearer TOKEN"
```

---

## Orders SSE Stream

### GET /api/dashboard/hotels/:hotelId/orders/stream

Real-time order events via Server-Sent Events (SSE).

**Auth:** Token passed as query param (EventSource doesn't support headers).

**Events:**
```
data: {"type":"order_created","order":{...}}
data: {"type":"order_status_changed","orderId":"uuid","status":"PREPARING","updatedAt":"..."}
data: {"type":"order_completed","orderId":"uuid"}
: ping
```

Heartbeat comment `: ping` is sent every 30 seconds.

```bash
# curl example
curl "http://localhost:3001/api/dashboard/hotels/HOTEL_ID/orders/stream?token=JWT_TOKEN"

# JavaScript EventSource
const es = new EventSource(
  `http://localhost:3001/api/dashboard/hotels/${hotelId}/orders/stream?token=${token}`
);
es.onmessage = (e) => {
  const event = JSON.parse(e.data);
  if (event.type === 'order_created') {
    // add new order to list
  }
  if (event.type === 'order_status_changed') {
    // update order status
  }
};
```

**Note:** The backend publishes events to Redis channel `orders:{hotelId}`. The orders service must call `redis.publish('orders:HOTEL_ID', JSON.stringify(event))` when order status changes.

---

## QR Codes (read-only)

### GET /api/dashboard/hotels/:hotelId/qr

List all QR codes for the hotel.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "qr-uuid",
      "hotelId": "hotel-uuid",
      "type": "in_room",
      "label": "Кімната 301",
      "roomNumber": "301",
      "deepLink": "roomie://open?hotelId=HOTEL_ID&room=301",
      "qrImagePath": "/path/to/qr.png",
      "pdfPath": "/path/to/qr.pdf",
      "isActive": true,
      "scanCount": 14,
      "createdAt": "2026-02-20T10:00:00.000Z"
    }
  ]
}
```

```bash
curl http://localhost:3001/api/dashboard/hotels/HOTEL_ID/qr \
  -H "Authorization: Bearer TOKEN"
```

### GET /api/dashboard/hotels/:hotelId/qr/:qrId/pdf

Download PDF for a single QR code (A6 format, print-ready).

```bash
curl http://localhost:3001/api/dashboard/hotels/HOTEL_ID/qr/QR_ID/pdf \
  -H "Authorization: Bearer TOKEN" \
  -o "room-301.pdf"
```

### GET /api/dashboard/hotels/:hotelId/qr/download-all

Download ZIP with all QR PDFs for the hotel.

```bash
curl http://localhost:3001/api/dashboard/hotels/HOTEL_ID/qr/download-all \
  -H "Authorization: Bearer TOKEN" \
  -o "all-qr-codes.zip"
```

---

## Statistics

### GET /api/dashboard/hotels/:hotelId/stats

Aggregated stats for a date range.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | string | First day of current month | ISO date: `2026-02-01` |
| `to` | string | Today | ISO date: `2026-02-26` |

**Response:**
```json
{
  "success": true,
  "data": {
    "appOpens": {
      "daily": [
        { "date": "2026-02-01", "uniqueGuests": 5, "totalOpens": 8 }
      ],
      "totalUnique": 42
    },
    "orders": {
      "daily": [
        { "date": "2026-02-01", "count": 12, "revenue": 340.50 }
      ],
      "totalCount": 245,
      "totalRevenue": 8920.00,
      "averageCheck": 36.41,
      "topItems": [
        { "name": "Капучино", "count": 87, "revenue": 391.50 }
      ]
    },
    "sms": {
      "total": 124,
      "delivered": 118,
      "failed": 6,
      "byTemplate": [
        { "template": "booking_confirmation", "count": 45 }
      ]
    },
    "qrScans": {
      "daily": [
        { "date": "2026-02-01", "count": 3 }
      ],
      "byRoom": [
        { "roomNumber": "301", "count": 12 }
      ],
      "total": 87
    },
    "guestJourney": {
      "preArrival": 8,
      "inStay": 12,
      "postStay": 3,
      "preCheckinConversion": 67,
      "totalGuestsInPeriod": 45
    },
    "reservations": {
      "daily": [
        { "date": "2026-02-01", "count": 3 }
      ],
      "bySource": [
        { "source": "booking.com", "count": 28 }
      ],
      "total": 45
    }
  }
}
```

```bash
curl "http://localhost:3001/api/dashboard/hotels/HOTEL_ID/stats?from=2026-02-01&to=2026-02-26" \
  -H "Authorization: Bearer TOKEN"
```

---

## SMS Logs

### GET /api/dashboard/hotels/:hotelId/sms-logs

Paginated SMS delivery logs (read-only).

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter: `queued`, `sent`, `failed` |
| `page` | number | Default: 1 |
| `limit` | number | Default: 20 |

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log-uuid",
        "phone": "+380501234567",
        "template": "booking_confirmation",
        "provider": "turbosms",
        "status": "sent",
        "errorMsg": null,
        "sentAt": "2026-02-26T09:00:00.000Z",
        "createdAt": "2026-02-26T09:00:00.000Z"
      }
    ],
    "total": 124,
    "page": 1,
    "totalPages": 7
  }
}
```

```bash
curl "http://localhost:3001/api/dashboard/hotels/HOTEL_ID/sms-logs?status=failed" \
  -H "Authorization: Bearer TOKEN"
```

---

## Error Responses

All errors follow the same format:

```json
{ "success": false, "error": "Error message here" }
```

| HTTP Code | Meaning |
|-----------|---------|
| 400 | Bad request / validation error |
| 401 | Missing or invalid token |
| 403 | Access denied to this hotel |
| 404 | Resource not found |
| 500 | Internal server error |

---

## Notes for Frontend Integration

1. **SSE stream auth:** Use `?token=JWT` query param — EventSource API doesn't support custom headers.
2. **Hotel access:** Each manager can only see hotels they're assigned to. The `manager.hotels` array from login contains the allowed hotel IDs.
3. **Pagination:** All list endpoints return `{ total, page, totalPages }` — use `totalPages` to determine if there are more pages.
4. **Stats dates:** Both `from` and `to` are inclusive.
5. **Order status values:** `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `IN_TRANSIT`, `DELIVERED`, `COMPLETED`, `CANCELLED`
6. **Stage values:** `PRE_ARRIVAL`, `CHECKED_IN`, `IN_STAY`, `CHECKOUT`, `POST_STAY`, `BETWEEN_STAYS`
