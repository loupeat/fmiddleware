# Hello World - AWS Lambda

Minimal AWS Lambda API using `@loupeat/fmiddleware`.

## Quick Start

```bash
npm install
npm run deploy
```

## Test

After deployment, test with:

```bash
curl https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/hello
```

Response:
```json
{
  "message": "Hello, World!",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## What's in index.ts

- Creates an FAWSLambdaMiddleware instance
- Registers a single GET route at `/hello`
- Exports a Lambda handler that processes API Gateway events
- That's it - just 15 lines of code!

## Local Testing

You can test locally with serverless-offline:

```bash
npm install -D serverless-offline
npx serverless offline
```
