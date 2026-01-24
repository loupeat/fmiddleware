# Hello World - Express

Minimal Express.js API using `@loupeat/fmiddleware`.

## Quick Start

```bash
npm install
npm start
```

## Test

```bash
curl http://localhost:3000/api/hello
```

Response:
```json
{
  "message": "Hello, World!",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## What's in index.ts

- Creates an Express app and FExpressMiddleware instance
- Registers a single GET route at `/api/hello`
- Routes all `/api/*` requests through the middleware
- Starts the server on port 3000
