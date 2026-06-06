# Session 6 Homework — Food Ordering API

A pure backend Node.js REST API built with Express.js for managing a food menu, members, and orders. All data is stored in memory.

## Getting Started

```bash
npm install
npm start
```

The server runs on port 3001 (or `process.env.PORT` if set).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/menu` | Get the full food menu by category |
| GET | `/api/members` | Get all members |
| POST | `/api/orders` | Place an order for a member |
| PUT | `/api/orders/:memberCode` | Update an existing order |

## Request body format (POST / PUT)

Use valid JSON with **double quotes** around keys and string values:

```json
{
  "memberCode": "M001",
  "dishCode": "IR001"
}
```

Common mistakes that cause errors:
- Wrong: `"dishCode": IR001` — values must be quoted strings
- Wrong: `{"memberCode": "M001", "dishCode": "IR001"}'` — do not add `'` after `}`
- In Postman: set **Body → raw → JSON** and paste the JSON above

## cURL Commands

### Get menu

```bash
curl -X GET http://localhost:3001/api/menu
```

### Get members

```bash
curl -X GET http://localhost:3001/api/members
```

### Place an order

```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"memberCode": "M001", "dishCode": "IR001"}'
```

### Update an order

```bash
curl -X PUT http://localhost:3001/api/orders/M001 \
  -H "Content-Type: application/json" \
  -d '{"dishCode": "SA001"}'
```

### Test invalid dish code

```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"memberCode": "M002", "dishCode": "INVALID999"}'
```

### Test duplicate order (400 error)

```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"memberCode": "M001", "dishCode": "WE001"}'
```

## Project Structure

```
project-root/
├── src/
│   ├── data/
│   │   ├── menu.js
│   │   ├── members.js
│   │   └── orders.js
│   ├── routes/
│   │   ├── menu.js
│   │   ├── members.js
│   │   └── orders.js
│   ├── middleware/
│   │   └── errorHandler.js
│   └── app.js
├── server.js
├── .env
├── .gitignore
├── package.json
└── README.md
```
