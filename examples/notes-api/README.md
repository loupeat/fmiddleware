# Notes API Example

This example demonstrates the framework-agnostic nature of `@loupeat/fmiddleware` by implementing a Notes API that can be deployed to both **Express.js** and **AWS Lambda** using the exact same API code.

## Project Structure

```
notes-api/
├── src/
│   ├── api/
│   │   ├── index.ts       # Shared API registration
│   │   ├── public.ts      # Public endpoints (no auth)
│   │   └── private.ts     # Private endpoints (requires JWT)
│   ├── auth/
│   │   └── cognito.ts     # Cognito JWT verification
│   ├── processors/
│   │   └── auth-preprocessor.ts  # Auth pre-processors for Express & Lambda
│   ├── express.ts         # Express.js entry point
│   └── lambda.ts          # AWS Lambda handlers
├── serverless.yml         # Serverless Framework config
├── package.json
└── tsconfig.json
```

## Key Concepts

### Framework-Agnostic API

The API logic in `src/api/` is completely framework-agnostic. It uses `FMiddleware<any, any>` as the type, which works with both `FExpressMiddleware` and `FAWSLambdaMiddleware`.

### Authentication Context Splitting

For Lambda deployment, the API is split into separate functions by authentication context:

- **publicHandler**: Handles `/api/public/**` - no auth required
- **privateHandler**: Handles `/api/private/**` - requires JWT

This splitting provides:
- **Faster cold starts**: Each function only loads relevant routes
- **Security isolation**: Auth processors only loaded where needed
- **Different configurations**: More memory/timeout for authenticated requests

### Platform-Specific Pre-Processors

The auth pre-processor has two implementations that FMiddleware selects automatically:

- **Express**: Manually verifies JWT using `jsonwebtoken` + `jwks-rsa`
- **Lambda**: Extracts claims from API Gateway's Cognito authorizer

## Running Locally (Express)

```bash
# Install dependencies
npm install

# Set Cognito config (required for JWT verification on private routes)
export COGNITO_REGION=eu-west-1
export COGNITO_USER_POOL_ID=your-user-pool-id

# Run in development mode
npm run dev

# Or build and run
npm run build && npm start
```

## Deploying to AWS Lambda

```bash
# Install dependencies
npm install

# Deploy to dev stage
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

The Serverless Framework configuration creates:
- Cognito User Pool (for demo purposes)
- API Gateway with Cognito authorizer
- Two Lambda functions (public and private)

## API Endpoints

### Public (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/public/health` | Health check |
| GET | `/api/public/info` | API info |
| GET | `/api/public/notes/featured` | Featured notes |

### Private (JWT required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/private/me` | Current user profile |
| GET | `/api/private/notes` | List user's notes |
| POST | `/api/private/notes` | Create note |
| GET | `/api/private/notes/{id}` | Get note |
| PUT | `/api/private/notes/{id}` | Update note |
| DELETE | `/api/private/notes/{id}` | Delete note |

## Testing

```bash
# Public endpoint (no auth)
curl http://localhost:3000/api/public/health

# Private endpoint (requires JWT)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/private/me
```
