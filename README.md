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
import { FExpressMiddleware } from "@loupeat/fmiddleware";

const app = express();
const api = new FExpressMiddleware();

// Register a simple GET endpoint
api.get("/api/notes", async (request) => {
  const notes = [{ id: "1", title: "Hello World" }];
  return api.responses.OK(request, notes);
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
import { FAWSLambdaMiddleware } from "@loupeat/fmiddleware";

const api = new FAWSLambdaMiddleware();

api.get("/api/notes", async (request) => {
  const notes = [{ id: "1", title: "Hello World" }];
  return api.responses.OK(request, notes);
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
api.get("/api/notes/{noteId}", async (request) => {
  const noteId = api.pathParameter(request, "noteId");
  const note = await notesService.get(noteId);

  if (!note) {
    return api.responses.NotFound(request, `Note ${noteId} not found`);
  }

  return api.responses.OK(request, note);
});
```

### Greedy Path Parameters

Capture multiple path segments using `{paramName+}`:

```typescript
api.get("/api/files/{filepath+}", async (request) => {
  // For /api/files/documents/2024/report.pdf
  // filepath = "documents/2024/report.pdf"
  const filepath = api.pathParameter(request, "filepath");
  return api.responses.OK(request, { filepath });
});
```

### Query Parameters

```typescript
api.get("/api/notes/search", async (request) => {
  // Required parameter - throws ValidationError if missing
  const query = api.queryStringParameter(request, "q");

  // Optional parameter - returns undefined if missing
  const tag = api.queryStringParameterOptional(request, "tag");

  const results = await notesService.search(query, tag);
  return api.responses.OK(request, results);
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

api.post("/api/notes", async (request) => {
  // request.body is validated against the schema
  const { title, content, tags } = request.body;
  const note = await notesService.create({ title, content, tags });
  return api.responses.OK(request, note);
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
import { RequestPreProcessor, AuthenticationError } from "@loupeat/fmiddleware";

const AuthPreProcessor: RequestPreProcessor = {
  name: "AuthPreProcessor",
  pathPatterns: ["/api/notes/**"],
  requestSource: "*", // "express", "aws-lambda", or "*" for both
  process: async (api, request, handler) => {
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
api.get("/api/notes", async (request) => {
  const user = api.context<User>(request, "user");
  const notes = await notesService.listByUser(user.id);
  return api.responses.OK(request, notes);
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
import { ResponsePostProcessor } from "@loupeat/fmiddleware";

const LoggingPostProcessor: ResponsePostProcessor = {
  name: "LoggingPostProcessor",
  pathPatterns: ["/**"],
  requestSource: "*",
  process: async (api, response) => {
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
  ValidationError,    // 400 Bad Request
  AuthenticationError, // 401 Unauthorized
  ForbiddenError,      // 403 Forbidden
  NotFoundError,       // 404 Not Found
  ConflictError        // 409 Conflict
} from "@loupeat/fmiddleware";

api.get("/api/notes/{noteId}", async (request) => {
  const noteId = api.pathParameter(request, "noteId");
  const user = api.context<User>(request, "user");

  const note = await notesService.get(noteId);

  if (!note) {
    throw new NotFoundError(`Note ${noteId} not found`);
  }

  if (note.userId !== user.id) {
    throw new ForbiddenError("You don't have access to this note");
  }

  return api.responses.OK(request, note);
});
```

## Response Helpers

```typescript
// 200 OK with body
api.responses.OK(request, { id: "1", title: "Hello" });

// 200 OK with custom headers
api.responses.OK(request, data, { "Cache-Control": "max-age=60" });

// 204 No Content
api.responses.NoContent(request);

// 400 Bad Request
api.responses.BadRequest(request, "Invalid input");

// 404 Not Found
api.responses.NotFound(request, "Resource not found");

// Custom status code
api.responses._(request, 201, { id: "1", title: "Created" });
```

## Complete Example: Notes API

Here's a complete example of a Notes API with authentication:

```typescript
import {
  FExpressMiddleware,
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
  process: async (_api, request, _handler) => {
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
  api.get("/api/notes", async (request) => {
    const user = api.context<User>(request, "user");
    const notes = await notesService.listByUser(user.id);
    return api.responses.OK(request, notes);
  });

  // Create a new note
  api.post("/api/notes", async (request) => {
    const user = api.context<User>(request, "user");
    const { title, content, tags } = request.body;

    const note = await notesService.create({
      userId: user.id,
      title,
      content,
      tags: tags || []
    });

    return api.responses.OK(request, note);
  }, CreateNoteSchema);

  // Get a specific note
  api.get("/api/notes/{noteId}", async (request) => {
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

    return api.responses.OK(request, note);
  });

  // Update a note
  api.put("/api/notes/{noteId}", async (request) => {
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
    return api.responses.OK(request, updated);
  }, UpdateNoteSchema);

  // Delete a note
  api.delete("/api/notes/{noteId}", async (request) => {
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
  api.get("/api/notes/search", async (request) => {
    const user = api.context<User>(request, "user");
    const query = api.queryStringParameterOptional(request, "q") || "";
    const tag = api.queryStringParameterOptional(request, "tag");

    const notes = await notesService.search(user.id, { query, tag });
    return api.responses.OK(request, notes);
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
import { APIGatewayProxyHandler } from "aws-lambda";
import { FAWSLambdaMiddleware } from "@loupeat/fmiddleware";
import { registerNotesApi } from "./notes-api";

let api: FAWSLambdaMiddleware;

export const main: APIGatewayProxyHandler = async (event) => {
  // Initialize once per cold start
  if (!api) {
    api = new FAWSLambdaMiddleware();
    registerNotesApi(api);
  }

  return api.process(event);
};
```

### Splitting by Route Prefix

For larger APIs, you can split handlers by route prefix to optimize cold starts:

**serverless.yml:**

```yaml
functions:
  notes:
    handler: src/handlers/notes.handler
    events:
      - http:
          method: any
          path: "api/notes/{proxy+}"
          cors: true

  users:
    handler: src/handlers/users.handler
    events:
      - http:
          method: any
          path: "api/users/{proxy+}"
          cors: true
```

**src/handlers/notes.ts:**

```typescript
import { APIGatewayProxyHandler } from "aws-lambda";
import { FAWSLambdaMiddleware } from "@loupeat/fmiddleware";

let api: FAWSLambdaMiddleware;

export const handler: APIGatewayProxyHandler = async (event) => {
  if (!api) {
    api = new FAWSLambdaMiddleware();
    api.setPathPrefix("/api/notes"); // Only register matching routes
    registerNotesApi(api);
  }

  return api.process(event);
};
```

## Express.js Integration

**src/app.ts:**

```typescript
import express from "express";
import { FExpressMiddleware } from "@loupeat/fmiddleware";
import { registerNotesApi } from "./notes-api";

const app = express();
const api = new FExpressMiddleware();

// Register your routes
registerNotesApi(api);

// Parse JSON bodies
app.use(express.json());

// Route all requests through FMiddleware
app.use(async (req, res) => {
  const response = await api.process(req);

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
api.responses.OK(request, data, api.headers({
  "Cache-Control": "max-age=60",
  "X-Custom-Header": "value"
}));
```

## API Reference

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
| `context<T>(request, key)` | Get value from request context |
| `setPathPrefix(prefix)` | Only register handlers matching prefix |

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
