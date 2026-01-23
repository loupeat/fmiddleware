# @loupeat/fmiddleware

A framework-agnostic HTTP middleware for building APIs that run on both **Express.js** and **AWS Lambda**.

## Features

- **Framework-agnostic**: Write your API once, deploy to Express.js or AWS Lambda
- **Powerful routing**: Path parameters, wildcards, and pattern matching
- **Pre-processors**: Enrich requests with authentication, context, and validation
- **Post-processors**: Handle errors, logging, and response transformation
- **Built-in validation**: JSON Schema validation with custom keywords (uuid, email, json)
- **Typed errors**: Semantic error classes that map to HTTP status codes
- **TypeScript-first**: Full type safety for requests and responses

## Installation

```bash
npm install @loupeat/fmiddleware
```

For AWS Lambda support, also install the types:

```bash
npm install --save-dev @types/aws-lambda
```

## Quick Start

### Express.js

```typescript
import express from "express";
import { FExpressMiddleware, FRequest } from "@loupeat/fmiddleware";

const app = express();
const api = new FExpressMiddleware();

interface Note {
  id: string;
  title: string;
}

// Register a simple GET endpoint
api.get("/api/notes", async (request: FRequest<any, any>) => {
  const notes: Note[] = [{ id: "1", title: "Hello World" }];
  return api.responses.OK<any, Note[]>(request, notes);
});

// Use FMiddleware as Express middleware
app.use(express.json());
app.use(async (req, res) => {
  const response = await api.process(req);
  res.status(response.statusCode).set(response.headers).json(response.body);
});

app.listen(3000);
```

### AWS Lambda

```typescript
import { APIGatewayProxyHandler } from "aws-lambda";
import { FAWSLambdaMiddleware, FRequest } from "@loupeat/fmiddleware";

interface Note {
  id: string;
  title: string;
}

const api = new FAWSLambdaMiddleware();

api.get("/api/notes", async (request: FRequest<any, any>) => {
  const notes: Note[] = [{ id: "1", title: "Hello World" }];
  return api.responses.OK<any, Note[]>(request, notes);
});

export const handler: APIGatewayProxyHandler = async (event) => {
  return api.process(event);
};
```

## Routing

### Registering Handlers

FMiddleware provides methods for all common HTTP verbs:

```typescript
api.get(path, handler);
api.post(path, handler, schema?);
api.put(path, handler, schema?);
api.delete(path, handler);
```

### Path Parameters

Capture dynamic segments using `{paramName}` syntax:

```typescript
import { FRequest } from "@loupeat/fmiddleware";

api.get("/api/notes/{noteId}", async (request: FRequest<any, any>) => {
  const noteId = api.pathParameter(request, "noteId");
  const note = await notesService.get(noteId);

  if (!note) {
    return api.responses.NotFound(request, `Note ${noteId} not found`);
  }

  return api.responses.OK<any, Note>(request, note);
});
```

### Greedy Path Parameters

Capture multiple path segments using `{paramName+}`:

```typescript
interface FilePathResponse {
  filepath: string;
}

api.get("/api/files/{filepath+}", async (request: FRequest<any, any>) => {
  // For /api/files/documents/2024/report.pdf
  // filepath = "documents/2024/report.pdf"
  const filepath = api.pathParameter(request, "filepath");
  return api.responses.OK<any, FilePathResponse>(request, { filepath });
});
```

> **Security Warning:** Path parameters can contain traversal sequences like `../`. If you use path parameters for file system operations, always validate that the resolved path stays within your intended directory:
> ```typescript
> import * as path from "path";
>
> const baseDir = "/var/uploads";
> const userPath = api.pathParameter(request, "filepath");
> const resolved = path.resolve(baseDir, userPath);
>
> if (!resolved.startsWith(baseDir)) {
>   throw new ForbiddenError("Invalid file path");
> }
> ```

### Query Parameters

```typescript
api.get("/api/notes/search", async (request: FRequest<any, any>) => {
  // Required parameter - throws ValidationError if missing
  const query = api.queryStringParameter(request, "q");

  // Optional parameter - returns undefined if missing
  const tag = api.queryStringParameterOptional(request, "tag");

  const results = await notesService.search(query, tag);
  return api.responses.OK<any, Note[]>(request, results);
});
```

### Path Patterns

FMiddleware supports wildcards for pre/post-processors:

| Pattern | Matches |
|---------|---------|
| `/api/notes` | Exact match |
| `/api/notes/*` | Single segment wildcard |
| `/api/notes/**` | Multi-segment wildcard |
| `/api/notes/{id}` | Path parameter |
| `/api/notes/{path+}` | Greedy path parameter |

## Request Validation

Validate request bodies using JSON Schema (Draft-07):

```typescript
import { FRequest } from "@loupeat/fmiddleware";

interface CreateNoteRequest {
  title: string;
  content: string;
  tags?: string[];
}

const CreateNoteSchema = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 1 },
    content: { type: "string" },
    tags: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["title", "content"]
};

api.post("/api/notes", async (request: FRequest<any, CreateNoteRequest>) => {
  // request.body is validated against the schema and typed
  const { title, content, tags } = request.body;
  const note = await notesService.create({ title, content, tags });
  return api.responses.OK<CreateNoteRequest, Note>(request, note);
}, CreateNoteSchema);
```

### Custom Validation Keywords

The built-in validator supports custom keywords:

```typescript
// UUID validation
const schema = {
  type: "object",
  properties: {
    id: { type: "string", uuid: true }
  }
};

// Email validation
const schema = {
  type: "object",
  properties: {
    email: { type: "string", email: true }
  }
};

// JSON string validation
const schema = {
  type: "object",
  properties: {
    metadata: { type: "string", json: true }
  }
};
```

## Pre-Processors

Pre-processors run before the handler and can enrich the request context:

```typescript
import {
  FMiddleware,
  FRequest,
  FHandler,
  RequestPreProcessor,
  AuthenticationError
} from "@loupeat/fmiddleware";

interface User {
  id: string;
  email: string;
}

const AuthPreProcessor: RequestPreProcessor = {
  name: "AuthPreProcessor",
  pathPatterns: ["/api/notes/**"],
  requestSource: "*", // "express", "aws-lambda", or "*" for both
  process: async (
    api: FMiddleware<any, any>,
    request: FRequest<any, any>,
    handler: FHandler<any, any>
  ) => {
    const authHeader = request.headers["authorization"];

    if (!authHeader) {
      throw new AuthenticationError("Missing authorization header");
    }

    const token = authHeader.replace(/^Bearer /, "");
    const user = await authService.verifyToken(token);

    // Add user to request context
    request.context["user"] = user;
  }
};

// Register the pre-processor
api.addRequestPreProcessor(AuthPreProcessor);

// Access context in handlers
api.get("/api/notes", async (request: FRequest<any, any>) => {
  const user = api.context<User>(request, "user");
  const notes = await notesService.listByUser(user.id);
  return api.responses.OK<any, Note[]>(request, notes);
});
```

### Pre-Processor Options

```typescript
const MyPreProcessor: RequestPreProcessor = {
  name: "MyPreProcessor",
  pathPatterns: ["/api/**"],      // Which paths to match
  httpMethods: [FHttpMethod.POST, FHttpMethod.PUT], // Optional: specific methods only
  requestSource: "*",              // "express", "aws-lambda", or "*"
  process: async (api, request, handler) => {
    // Your logic here
  }
};
```

## Post-Processors

Post-processors run after the handler and can transform responses or handle errors:

```typescript
import { FMiddleware, FResponse, ResponsePostProcessor } from "@loupeat/fmiddleware";

const LoggingPostProcessor: ResponsePostProcessor = {
  name: "LoggingPostProcessor",
  pathPatterns: ["/**"],
  requestSource: "*",
  process: async (api: FMiddleware<any, any>, response: FResponse<any, any, any>) => {
    console.log(`${response.request.httpMethod} ${response.request.path} - ${response.statusCode}`);

    if (response.error) {
      console.error("Request failed:", response.error);
    }
  }
};

api.addResponsePostProcessor(LoggingPostProcessor);
```

## Error Handling

FMiddleware provides semantic error classes that automatically map to HTTP status codes:

```typescript
import {
  FRequest,
  ValidationError,     // 400 Bad Request
  AuthenticationError, // 401 Unauthorized
  ForbiddenError,      // 403 Forbidden
  NotFoundError,       // 404 Not Found
  ConflictError        // 409 Conflict
} from "@loupeat/fmiddleware";

interface User {
  id: string;
}

api.get("/api/notes/{noteId}", async (request: FRequest<any, any>) => {
  const noteId = api.pathParameter(request, "noteId");
  const user = api.context<User>(request, "user");

  const note = await notesService.get(noteId);

  if (!note) {
    throw new NotFoundError(`Note ${noteId} not found`);
  }

  if (note.userId !== user.id) {
    throw new ForbiddenError("You don't have access to this note");
  }

  return api.responses.OK<any, Note>(request, note);
});
```

## Response Helpers

```typescript
interface Note {
  id: string;
  title: string;
}

// 200 OK with typed body
api.responses.OK<any, Note>(request, { id: "1", title: "Hello" });

// 200 OK with custom headers
api.responses.OK<any, Note>(request, note, { "Cache-Control": "max-age=60" });

// 204 No Content
api.responses.NoContent(request);

// 400 Bad Request
api.responses.BadRequest(request, "Invalid input");

// 404 Not Found
api.responses.NotFound(request, "Resource not found");

// Custom status code with typed body
api.responses._<any, Note>(request, 201, { id: "1", title: "Created" });
```

## Complete Example: Notes API

Here's a complete example of a Notes API with authentication:

```typescript
import {
  FExpressMiddleware,
  FMiddleware,
  FRequest,
  FHandler,
  RequestPreProcessor,
  AuthenticationError,
  NotFoundError,
  ForbiddenError,
  validator
} from "@loupeat/fmiddleware";

// Types
interface User {
  id: string;
  email: string;
}

interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
}

interface CreateNoteRequest {
  title: string;
  content: string;
  tags?: string[];
}

interface UpdateNoteRequest {
  title?: string;
  content?: string;
  tags?: string[];
}

// Schemas
const CreateNoteSchema = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 1 },
    content: { type: "string" },
    tags: { type: "array", items: { type: "string" } }
  },
  required: ["title", "content"]
};

const UpdateNoteSchema = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 1 },
    content: { type: "string" },
    tags: { type: "array", items: { type: "string" } }
  }
};

// Initialize middleware
const api = new FExpressMiddleware();

// Authentication pre-processor
const AuthPreProcessor: RequestPreProcessor = {
  name: "AuthPreProcessor",
  pathPatterns: ["/api/notes/**", "/api/notes"],
  requestSource: "*",
  process: async (
    _api: FMiddleware<any, any>,
    request: FRequest<any, any>,
    _handler: FHandler<any, any>
  ) => {
    const authHeader = request.headers["authorization"];
    if (!authHeader) {
      throw new AuthenticationError("Missing authorization header");
    }

    const token = authHeader.replace(/^Bearer /, "");
    const user = await verifyToken(token); // Your auth logic
    request.context["user"] = user;
  }
};

api.addRequestPreProcessor(AuthPreProcessor);

// Routes
export function registerNotesApi(api: FExpressMiddleware) {

  // List all notes for user
  api.get("/api/notes", async (request: FRequest<any, any>) => {
    const user = api.context<User>(request, "user");
    const notes = await notesService.listByUser(user.id);
    return api.responses.OK<any, Note[]>(request, notes);
  });

  // Create a new note
  api.post("/api/notes", async (request: FRequest<any, CreateNoteRequest>) => {
    const user = api.context<User>(request, "user");
    const { title, content, tags } = request.body;

    const note = await notesService.create({
      userId: user.id,
      title,
      content,
      tags: tags || []
    });

    return api.responses.OK<CreateNoteRequest, Note>(request, note);
  }, CreateNoteSchema);

  // Get a specific note
  api.get("/api/notes/{noteId}", async (request: FRequest<any, any>) => {
    const user = api.context<User>(request, "user");
    const noteId = api.pathParameter(request, "noteId");
    validator.validateUuid(noteId);

    const note = await notesService.get(noteId);

    if (!note) {
      throw new NotFoundError(`Note ${noteId} not found`);
    }

    if (note.userId !== user.id) {
      throw new ForbiddenError("Access denied");
    }

    return api.responses.OK<any, Note>(request, note);
  });

  // Update a note
  api.put("/api/notes/{noteId}", async (request: FRequest<any, UpdateNoteRequest>) => {
    const user = api.context<User>(request, "user");
    const noteId = api.pathParameter(request, "noteId");
    validator.validateUuid(noteId);

    const note = await notesService.get(noteId);

    if (!note) {
      throw new NotFoundError(`Note ${noteId} not found`);
    }

    if (note.userId !== user.id) {
      throw new ForbiddenError("Access denied");
    }

    const updated = await notesService.update(noteId, request.body);
    return api.responses.OK<UpdateNoteRequest, Note>(request, updated);
  }, UpdateNoteSchema);

  // Delete a note
  api.delete("/api/notes/{noteId}", async (request: FRequest<any, any>) => {
    const user = api.context<User>(request, "user");
    const noteId = api.pathParameter(request, "noteId");
    validator.validateUuid(noteId);

    const note = await notesService.get(noteId);

    if (!note) {
      throw new NotFoundError(`Note ${noteId} not found`);
    }

    if (note.userId !== user.id) {
      throw new ForbiddenError("Access denied");
    }

    await notesService.delete(noteId);
    return api.responses.NoContent(request);
  });

  // Search notes
  api.get("/api/notes/search", async (request: FRequest<any, any>) => {
    const user = api.context<User>(request, "user");
    const query = api.queryStringParameterOptional(request, "q") || "";
    const tag = api.queryStringParameterOptional(request, "tag");

    const notes = await notesService.search(user.id, { query, tag });
    return api.responses.OK<any, Note[]>(request, notes);
  });
}
```

## AWS Lambda Deployment

FMiddleware works great with serverless frameworks. Here's how to deploy to AWS Lambda.

### With Serverless Framework

We recommend using [Serverless Framework](https://www.serverless.com/) or [AWS CDK](https://aws.amazon.com/cdk/) for Lambda deployments.

**serverless.yml:**

```yaml
service: notes-api

plugins:
  - serverless-esbuild  # For TypeScript bundling

custom:
  esbuild:
    bundle: true
    minify: false
    sourcemap: true
    target: node20

provider:
  name: aws
  runtime: nodejs20.x
  region: eu-west-1
  environment:
    LOG_LEVEL: info

functions:
  api:
    handler: src/handler.main
    events:
      - http:
          method: any
          path: "api/{proxy+}"
          cors: true
    timeout: 15
```

**src/handler.ts:**

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { FAWSLambdaMiddleware } from "@loupeat/fmiddleware";
import { registerNotesApi } from "./notes-api";

let api: FAWSLambdaMiddleware;

export const main = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Initialize once per cold start
  if (!api) {
    api = new FAWSLambdaMiddleware();
    registerNotesApi(api);
  }

  return api.process(event);
};
```

### Splitting by Authentication Context

A common pattern is to split Lambda functions by authentication context rather than by resource. This approach:

- **Optimizes cold starts**: Public handlers don't load auth processors
- **Improves security**: Authentication code is isolated to protected functions
- **Enables different configurations**: More memory/timeout for authenticated requests

**serverless.yml:**

```yaml
functions:
  # Public endpoints - no authentication
  public:
    handler: src/lambda.publicHandler
    events:
      - http:
          method: any
          path: "api/public/{proxy+}"
          cors: true
    timeout: 15
    memorySize: 256

  # Private endpoints - requires JWT
  private:
    handler: src/lambda.privateHandler
    events:
      - http:
          method: any
          path: "api/private/{proxy+}"
          cors: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId:
              Ref: ApiGatewayAuthorizer
    timeout: 30
    memorySize: 512
```

**src/lambda.ts:**

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { FAWSLambdaMiddleware } from "@loupeat/fmiddleware";
import { registerApi } from "./api";

let publicApi: FAWSLambdaMiddleware;
let privateApi: FAWSLambdaMiddleware;

// Public handler - no auth required
export const publicHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (!publicApi) {
    publicApi = new FAWSLambdaMiddleware();
    publicApi.setPathPrefix("/api/public");
    registerApi(publicApi);
  }
  return publicApi.process(event);
};

// Private handler - JWT validated by API Gateway
export const privateHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (!privateApi) {
    privateApi = new FAWSLambdaMiddleware();
    privateApi.setPathPrefix("/api/private");
    registerApi(privateApi);
  }
  return privateApi.process(event);
};
```

The `setPathPrefix()` method ensures each Lambda only registers handlers matching its prefix, reducing initialization time and memory usage.

## Express.js Integration

**src/app.ts:**

```typescript
import express, { Request, Response } from "express";
import { FExpressMiddleware, FResponse } from "@loupeat/fmiddleware";
import { registerNotesApi } from "./notes-api";

const app = express();
const api = new FExpressMiddleware();

// Register your routes
registerNotesApi(api);

// Parse JSON bodies
app.use(express.json());

// Route all requests through FMiddleware
app.use(async (req: Request, res: Response) => {
  const response: FResponse<any, any, any> = await api.process(req);

  // Set headers
  for (const [key, value] of Object.entries(response.headers)) {
    res.setHeader(key, value);
  }

  // Send response
  res.status(response.statusCode).json(response.body);
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
```

> **Security Note:** `request.sourceIp` in Express comes from `request.ip`, which respects the `X-Forwarded-For` header if `trust proxy` is enabled. If your Express app runs behind a reverse proxy (nginx, load balancer), configure `trust proxy` correctly. If running without a proxy, ensure `trust proxy` is disabled to prevent IP spoofing via the `X-Forwarded-For` header. See [Express trust proxy documentation](https://expressjs.com/en/guide/behind-proxies.html).

## Configuration

### Logging

Set the log level via environment variable:

```bash
LOG_LEVEL=debug  # debug, info, warn, error
```

### Default Headers

Both `FExpressMiddleware` and `FAWSLambdaMiddleware` set CORS headers by default:

```typescript
{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Credentials": "true"
}
```

You can add custom headers to responses:

```typescript
api.responses.OK<any, Note>(request, note, api.headers({
  "Cache-Control": "max-age=60",
  "X-Custom-Header": "value"
}));
```

## API Reference

### Core Types

```typescript
// Request type with generics for original request and body type
FRequest<OriginalRequestType, RequestBodyType>

// Response type with generics
FResponse<OriginalRequestType, RequestBodyType, ResponseBodyType>

// Handler function signature
(request: FRequest<any, RequestBodyType>) => Promise<FResponse<any, RequestBodyType, ResponseBodyType>>
```

### FMiddleware

| Method | Description |
|--------|-------------|
| `get(path, handler)` | Register GET handler |
| `post(path, handler, schema?)` | Register POST handler with optional validation |
| `put(path, handler, schema?)` | Register PUT handler with optional validation |
| `delete(path, handler)` | Register DELETE handler |
| `addRequestPreProcessor(processor)` | Add a pre-processor |
| `addResponsePostProcessor(processor)` | Add a post-processor |
| `pathParameter(request, name)` | Get path parameter value |
| `queryStringParameter(request, name)` | Get required query parameter |
| `queryStringParameterOptional(request, name)` | Get optional query parameter |
| `context<T>(request, key)` | Get typed value from request context |
| `setPathPrefix(prefix)` | Only register handlers matching prefix |
| `responses.OK<Req, Res>(request, body)` | Return 200 with typed response |
| `responses.NoContent(request)` | Return 204 |
| `responses.NotFound(request, message)` | Return 404 |
| `responses.BadRequest(request, message)` | Return 400 |
| `responses._(request, status, body)` | Return custom status code |

### Error Classes

| Class | HTTP Status |
|-------|-------------|
| `ValidationError` | 400 |
| `AuthenticationError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |

## License

MIT
