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
- **OpenAPI generation**: Generate OpenAPI 3.0 specs automatically from handlers

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
app.all("*", async (req, res) => {
  const response = await api.process(req);
  for (const [key, value] of Object.entries(response.headers || {})) {
    res.setHeader(key, value as string);
  }
  res.status(response.statusCode).json(response.body);
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

// Date validation (ISO 8601, YYYY-MM-DD)
const schema = {
  type: "object",
  properties: {
    dueDate: { type: "string", date: true }
  }
};

// Time validation (ISO 8601, HH:MM:SS with optional fractional seconds)
const schema = {
  type: "object",
  properties: {
    startsAt: { type: "string", time: true }
  }
};

// Datetime validation (ISO 8601)
// `true` accepts any valid datetime (Z or +/-HH:MM offset);
// `"zulu"` requires a trailing Z (UTC).
const schema = {
  type: "object",
  properties: {
    createdAt: { type: "string", datetime: true },
    timestamp: { type: "string", datetime: "zulu" }
  }
};

// Plain text validation (rejects HTML markup)
const schema = {
  type: "object",
  properties: {
    name: { type: "string", plainText: true },
    message: { type: ["string", "null"], plainText: true }
  }
};
```

When generating an OpenAPI spec, the date and time keywords map to the standard
`format` strings `date`, `time`, and `date-time`. `plainText` has no standard
`format` and is left out of the generated spec.

#### `plainText`

A value fails when it contains what an HTML parser would read as the start of a
tag, a closing tag, a comment or a declaration: a `<` immediately followed by an
ASCII letter, `/` or `!`. Other angle brackets are legitimate plain text and pass.

| Value | Result |
| --- | --- |
| `Budget < 5000`, `<50`, `>1000` | passes |
| `a > b && b < 3` | passes |
| `Smith & Sons` | passes |
| `<a href="https://example.com">click</a>` | fails |
| `</p>`, `<!-- comment -->`, `<IMG src=x>` | fails |
| `Jane Doe <jane@example.com>` | fails (accepted trade-off) |

Empty strings pass, and so does `null` when the field's `type` allows it. A
rejected value produces `must be plain text without HTML markup` in the
`ValidationError`, and therefore in the 400 response body.

> **This is input validation, not output encoding.** It does not replace
> escaping and is not an XSS guarantee: `&` and `<50` are allowed, and values
> that reach a handler by another path (a path parameter, for instance) never
> pass the body schema. Always escape a value when rendering it into HTML.

## Request Body Content Types

The body is extracted based on the request `Content-Type` header, identically on
AWS Lambda and Express, so the same schema-based validation works everywhere.

### JSON (default)

`application/json` bodies are parsed into an object (falling back to the raw
string if parsing fails). This is the default and needs no extra configuration.

### Form-urlencoded

`application/x-www-form-urlencoded` bodies (e.g. Twilio webhooks) are parsed into
a flat `Record<string, string>` before validation, so a normal `type: "object"`
schema applies. Percent-encoding and `+` → space are handled; repeated keys
collapse to last-wins.

```typescript
interface TwilioWebhook {
  From: string;
  To: string;
  CallSid: string;
}

const TwilioSchema = {
  type: "object",
  properties: {
    From: { type: "string" },
    To: { type: "string" },
    CallSid: { type: "string" }
  },
  required: ["From", "To", "CallSid"]
};

api.post("/api/webhooks/twilio", async (request: FRequest<any, TwilioWebhook>) => {
  const { From, CallSid } = request.body;
  // ...
  return api.responses.OK(request, {});
}, TwilioSchema, {
  // Optional: documents the route as form-encoded in the generated OpenAPI spec
  requestContentType: "application/x-www-form-urlencoded"
});
```

On Express, register a body parser for the content type so the raw body reaches
the middleware:

```typescript
app.use(express.urlencoded({ extended: false }));
// or, to let the middleware parse it:
app.use(express.raw({ type: "application/x-www-form-urlencoded" }));
```

### Binary / passthrough

For routes that accept raw bytes (e.g. a WebDAV `PUT` upload), mark the route
with a `{ type: "binary" }` schema. `request.body` is then exposed as a `Buffer`
(base64 Lambda bodies are decoded) without attempting `JSON.parse`, JSON-Schema
validation is skipped, and zero-byte uploads are accepted. The route still counts
as "having a schema", so no startup warning is emitted.

```typescript
api.put("/api/files/{id}", async (request: FRequest<any, Buffer>) => {
  const bytes = request.body; // Buffer
  await storage.put(api.pathParameter(request, "id"), bytes);
  return api.responses.NoContent(request);
}, { type: "binary" });
```

On Express, register a raw body parser for the relevant content types:

```typescript
app.use(express.raw({ type: ["application/octet-stream", "application/pdf"], limit: "25mb" }));
```

The generated OpenAPI spec maps a binary route to
`application/octet-stream` with `{ type: "string", format: "binary" }` (override
the media type via `requestContentType` in the OpenAPI metadata).

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
app.all("*", async (req: Request, res: Response) => {
  const response: FResponse<any, any, any> = await api.process(req);

  // Set headers
  for (const [key, value] of Object.entries(response.headers || {})) {
    res.setHeader(key, value as string);
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

The exported `logger` is a drop-in for `console.*`: `logger.<level>(message, extra)`
keeps **both** the message and the extra argument, whether the extra is an `Error`
(name, message and stack are printed) or an object. `logger.info(obj)` logs the
object itself, not the level name. Every argument — including errors and nested
object leaves — is passed through the redactors below first.

### Per-request logging

The middleware emits one concise line **before** the handler runs and one on
completion, so a failed invocation can be tied to the request that triggered it
from the logs alone — without turning on the verbose `debug` output:

```
[INFO]  --> aws-lambda GET   : /api/notes/42
[INFO]  <-- aws-lambda GET   : /api/notes/42 200 12ms
```

A **start line with no matching end line** marks a request that died mid-flight
(a Lambda timeout or out-of-memory, or a throw in `mapRequestType` /
`mapResponseType`). Everything else — path parameters, per-processor tracing — is
kept at `debug`. The lines carry only method, path and request source; no body,
headers, query string or path parameters.

Control the level with the `requestLogging` option:

```typescript
const api = new FAWSLambdaMiddleware({
  requestLogging: "info" // "info" (default) | "debug" | "off"
});
```

- `"info"` — emit at info level (default).
- `"debug"` — emit only when `LOG_LEVEL=debug`; use this if you already log per
  request elsewhere but still want the lines while debugging.
- `"off"` — never emit them.

The path in these lines goes through the redactors below, so a token or IBAN
sitting in a URL is scrubbed here too.

### Log level of a throw

When a handler or pre-processor throws, the middleware logs it at the level the
outcome deserves rather than always at `error`:

```
[WARN]  Error in handler [GET]: /api/notes/{id}: NotFoundError: no such note
[ERROR] Error in handler [POST]: /api/notes: TypeError: cannot read 'id' of undefined
```

Anything the [error classes](#error-classes) turn into a **4xx** is an expected,
handled outcome — a correct 404 or 403 is the API working, not failing — so it
goes out at `warn`. Every other throw becomes a **500** and stays at `error`.
Subclasses follow their base class, so a per-entity `ForbiddenError` subclass is
still a 403 and still a `warn`.

This keeps `[ERROR]` usable as a fault signal: alarms and log searches on it see
genuine failures instead of a request log. The predicate is exported as
`isClientError(error)` if you need the same split in your own code.

One exception: the outer backstop in `process()` always logs at `error`. An error
escaping `dispatch()` never reaches the post-processor that would downgrade it,
so it is a 500 whatever class it carries.

> **Changed in 1.6.0.** Before this, every throw was logged at `error`. If you
> alarm on `[ERROR]` volume, expect the baseline to drop; if you relied on
> `[ERROR]` to see 4xx responses, watch `[WARN]` as well.

### Redacting sensitive values from logs

Everything written through the exported `logger` is passed through a list of
regex **redactors** before it reaches the console. This keeps values such as
tokens, e-mail addresses and IBANs out of CloudWatch even when they appear in a
message, a path or an `Error`.

A conservative default set is active out of the box — high-confidence secrets
that have no legitimate reason to reach the logs:

| Redactor      | Replacement         |
| ------------- | ------------------- |
| Bearer tokens | `Bearer [REDACTED]` |
| Bare JWTs     | `[JWT]`             |
| IBAN          | `[IBAN]`            |

Redaction applies to string messages, to the string leaves of any logged
object, and to the message and stack of a logged `Error` (the original `Error`
is never mutated — a scrubbed copy is emitted).

E-mail addresses are **not** redacted by default (they are frequently useful for
debugging and low-sensitivity). An `emailRedactor` is exported so you can opt in
when your logs must not carry them.

Configure the redactors when constructing the middleware. Providing `redact`
**replaces** the built-in set — spread `defaultLogRedactors` to extend it
instead:

```typescript
import {
  FAWSLambdaMiddleware,
  defaultLogRedactors,
  emailRedactor
} from "@loupeat/fmiddleware";

const api = new FAWSLambdaMiddleware({
  redact: [
    ...defaultLogRedactors,
    emailRedactor, // opt in to e-mail redaction
    { pattern: /\bcust_[A-Za-z0-9]+\b/g, replacement: "[CUSTOMER_ID]" }
  ]
});
```

You can also configure the shared logger directly — useful when you log through
`logger` without constructing middleware:

```typescript
import {
  logger,
  setLogRedactors,
  addLogRedactors,
  defaultLogRedactors,
  redact
} from "@loupeat/fmiddleware";

// Replace the active set
setLogRedactors([{ pattern: /\bAcct-\d+\b/g, replacement: "[ACCOUNT]" }]);

// Append to it
addLogRedactors({ pattern: /\bpk_live_[A-Za-z0-9]+\b/g, replacement: "[KEY]" });

// Turn redaction off entirely
setLogRedactors([]);

// Scrub a value yourself before logging it elsewhere
console.log(redact(`from ${account.iban}`));
```

> Use a global (`/g`) pattern so every occurrence is replaced, not just the
> first. Only values that go through `logger` are redacted; move any
> `console.log` calls that matter over to `logger.*` to have them covered.

### Default Headers

Both `FExpressMiddleware` and `FAWSLambdaMiddleware` set a CORS header by default:

```typescript
{
  "Access-Control-Allow-Origin": "*"
}
```

You can add custom headers to responses:

```typescript
api.responses.OK<any, Note>(request, note, api.headers({
  "Cache-Control": "max-age=60",
  "X-Custom-Header": "value"
}));
```

## OpenAPI Generation

FMiddleware includes built-in support for generating OpenAPI 3.0 specifications from your registered handlers.

### Adding OpenAPI Metadata to Handlers

You can enrich handlers with OpenAPI metadata for better documentation:

```typescript
import { FExpressMiddleware, OpenAPIMetadata } from "@loupeat/fmiddleware";

const api = new FExpressMiddleware();

// GET with OpenAPI metadata
api.get("/api/notes", async (request) => {
  const notes = await notesService.list();
  return api.responses.OK(request, notes);
}, {
  summary: "List all notes",
  description: "Retrieves all notes for the authenticated user",
  tags: ["Notes"],
  queryParams: [
    { name: "tag", description: "Filter by tag", required: false },
    { name: "limit", description: "Max results", schema: { type: "integer" } }
  ],
  responseSchema: {
    type: "array",
    items: { $ref: "#/components/schemas/Note" }
  }
});

// POST with schema and OpenAPI metadata
api.post("/api/notes", async (request) => {
  const note = await notesService.create(request.body);
  return api.responses.OK(request, note);
}, CreateNoteSchema, {
  summary: "Create a note",
  tags: ["Notes"],
  requestBodyDescription: "Note to create"
});
```

### OpenAPI Metadata Options

```typescript
interface OpenAPIMetadata {
  summary?: string;           // Brief description
  description?: string;       // Detailed description
  tags?: string[];            // Categorization tags
  operationId?: string;       // Unique operation ID
  deprecated?: boolean;       // Mark as deprecated
  queryParams?: QueryParamDef[];  // Query parameter definitions
  pathParams?: Record<string, PathParamDef>;  // Path parameter descriptions
  responseSchema?: any;       // JSON Schema for response
  responses?: Record<string, ResponseDef>;    // Custom response definitions
  requestBodyDescription?: string;  // Description for request body
}
```

### Generating OpenAPI Specifications

Use the `OpenApiGenerator` class to generate specs from your middleware:

```typescript
import {
  FExpressMiddleware,
  OpenApiGenerator,
  GeneratorConfig
} from "@loupeat/fmiddleware";
import * as fs from "fs";

// Initialize and register handlers
const api = new FExpressMiddleware();
registerAllRoutes(api);

// Configure the generator
const config: GeneratorConfig = {
  info: {
    title: "My API",
    version: "1.0.0",
    description: "API description"
  },
  servers: [
    { url: "https://api.example.com", description: "Production" }
  ],
  tags: [
    { name: "Notes", description: "Note management" }
  ],
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT"
    }
  },
  // Custom security inference based on path
  securityInference: (path) => {
    if (path.includes("/public/")) return [];
    return [{ bearerAuth: [] }];
  },
  // Custom tag inference based on path
  tagInference: (path) => {
    const match = path.match(/\/api\/(\w+)/);
    return match ? [match[1]] : ["General"];
  }
};

// Generate the spec
const generator = new OpenApiGenerator(api, config);
const spec = generator.generate();

// Write to file
fs.writeFileSync("openapi.json", JSON.stringify(spec, null, 2));
```

### Generator Config Options

```typescript
interface GeneratorConfig {
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  tags?: Array<{ name: string; description?: string }>;
  securitySchemes?: Record<string, any>;
  securityInference?: (path: string) => any[];  // Custom security logic
  tagInference?: (path: string) => string[];    // Custom tag logic
}
```

### Automatic Inference

The generator automatically infers:

- **Path parameters** from `{param}` patterns in routes
- **Operation IDs** from HTTP method + path
- **Summaries** from HTTP method + resource name
- **Request body schemas** from handler schema parameter
- **Standard error responses** (400, 401, 403, 404, 500)

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
| `get(path, handler, openapi?)` | Register GET handler with optional OpenAPI metadata |
| `post(path, handler, schema?, openapi?)` | Register POST handler with validation and OpenAPI metadata |
| `put(path, handler, schema?, openapi?)` | Register PUT handler with validation and OpenAPI metadata |
| `delete(path, handler, schema?, openapi?)` | Register DELETE handler with optional OpenAPI metadata |
| `addRequestPreProcessor(processor)` | Add a pre-processor |
| `addResponsePostProcessor(processor)` | Add a post-processor |
| `pathParameter(request, name)` | Get path parameter value |
| `queryStringParameter(request, name)` | Get required query parameter |
| `queryStringParameterOptional(request, name)` | Get optional query parameter |
| `context<T>(request, key)` | Get typed value from request context |
| `setPathPrefix(prefix)` | Only register handlers matching prefix |
| `getHandlers()` | Get all registered handlers (for OpenAPI generation) |
| `responses.OK<Req, Res>(request, body)` | Return 200 with typed response |
| `responses.NoContent(request)` | Return 204 |
| `responses.NotFound(request, message)` | Return 404 |
| `responses.BadRequest(request, message)` | Return 400 |
| `responses._(request, status, body)` | Return custom status code |

### Error Classes

Throwing any of these from a handler or pre-processor produces the status below
and is logged at `warn`; anything else is a 500 at `error`. See
[Log level of a throw](#log-level-of-a-throw).

| Class | HTTP Status |
|-------|-------------|
| `ValidationError` | 400 |
| `AuthenticationError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |

| Function | Description |
|----------|-------------|
| `isClientError(error)` | True for the classes above and their subclasses — the split the middleware uses to pick `warn` over `error` |

### OpenAPI Types

| Type | Description |
|------|-------------|
| `OpenAPIMetadata` | Metadata to attach to handlers for documentation |
| `QueryParamDef` | Query parameter definition |
| `PathParamDef` | Path parameter description |
| `ResponseDef` | Response definition |
| `OpenAPISpec` | Full OpenAPI 3.0 specification |
| `GeneratorConfig` | Configuration for OpenApiGenerator |
| `OpenApiGenerator` | Class to generate OpenAPI specs from middleware |

## License

MIT
