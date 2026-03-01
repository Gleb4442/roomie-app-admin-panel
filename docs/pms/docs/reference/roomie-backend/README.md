# Reference Files from roomie-backend

## ⚠️ Это НЕ запускаемый код

Эти файлы скопированы из отдельного проекта **roomie-backend** для справки.
Они написаны на JavaScript (Sequelize). Наш проект использует TypeScript + Prisma.

**Используй эти файлы ТОЛЬКО как референс для:**
- Формат запросов/ответов Servio API (ServioAdapter.js)
- Формат запросов/ответов EasyMS API (EasyMSAdapter.js)
- Factory паттерн для PMS адаптеров (PMSFactory.js)
- Структура данных PMS подключений (hotelPMSInfo.model.js)

**НЕ копируй этот код напрямую.** Напиши свои адаптеры на TypeScript,
используя те же API endpoints и форматы данных.

## Файлы

| Файл | Зачем нужен |
|------|-------------|
| ServioAdapter.js | HTTP POST запросы к Servio: auth, URL, параметры, парсинг ответов |
| EasyMSAdapter.js | REST запросы к EasyMS: auth flow, endpoints, параметры |
| PMSFactory.js | Паттерн выбора адаптера по pms.name |
| pms.service.js | Как AI-агент вызывает PMS через tool calling |
| hotelPMSInfo.model.js | Sequelize модель конфига PMS (наш аналог — HotelPMSConfig в Prisma) |
| hotel.model.js | Sequelize модель отеля (наш аналог — Hotel в Prisma) |

## Полная API документация

Для детальных описаний endpoints, параметров и ответов см.:
- `docs/pms/servio-api.md`
- `docs/pms/easyms-api.md`
