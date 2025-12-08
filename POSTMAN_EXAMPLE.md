# Postman тестування /api/contact

## Локальний тест (localhost:3001)

**Method:** `POST`  
**URL:** `http://localhost:3001/api/contact`

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "name": "Test User",
  "email": "test@example.com",
  "message": "Test message from Postman"
}
```

## Тест на Vercel

**Method:** `POST`  
**URL:** `https://node-backend-ai-creact-objects-zoif.vercel.app/api/contact`

**Headers:**
```
Content-Type: application/json
Origin: https://2025-folio-one.vercel.app
```

**Body (raw JSON):**
```json
{
  "name": "Test User",
  "email": "test@example.com",
  "message": "Test message from Postman"
}
```

## Очікувані відповіді

### Успіх (200):
```json
{
  "ok": true
}
```

### Помилка валідації (400):
```json
{
  "error": "Invalid payload"
}
```

### Помилка конфігурації (500):
```json
{
  "error": "Mail config missing"
}
```

### Помилка доступу (403):
```json
{
  "error": "forbidden"
}
```

