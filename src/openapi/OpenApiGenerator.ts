import { FMiddleware, FHandler } from "../middleware";
import { FHttpMethod } from "../types";
import { OpenAPISpec, OpenAPIMetadata, GeneratorConfig } from "./types";

/**
 * Generates OpenAPI 3.0 specifications from FMiddleware handlers.
 *
 * Usage:
 * ```typescript
 * const generator = new OpenApiGenerator(middleware, config);
 * const spec = generator.generate();
 * ```
 */
export class OpenApiGenerator {
    private middleware: FMiddleware<any, any>;
    private config: GeneratorConfig;

    constructor(middleware: FMiddleware<any, any>, config: GeneratorConfig) {
        this.middleware = middleware;
        this.config = config;
    }

    /**
     * Generate the complete OpenAPI specification.
     */
    generate(): OpenAPISpec {
        const handlers = this.middleware.getHandlers();
        const paths: Record<string, any> = {};
        const schemas: Record<string, any> = {};

        for (const handler of handlers) {
            // Skip OPTIONS handlers (CORS preflight)
            if (handler.httpMethod === FHttpMethod.OPTIONS) continue;

            const pathKey = this.convertPathPattern(handler.pathPattern);
            if (!paths[pathKey]) {
                paths[pathKey] = {};
            }

            const method = handler.httpMethod.toLowerCase();
            paths[pathKey][method] = this.buildOperation(handler, schemas);
        }

        return {
            openapi: "3.0.3",
            info: this.config.info,
            servers: this.config.servers || [],
            paths,
            components: {
                schemas,
                securitySchemes: this.config.securitySchemes || this.buildDefaultSecuritySchemes()
            },
            tags: this.config.tags || this.inferTags(handlers)
        };
    }

    /**
     * Convert FMiddleware path pattern to OpenAPI path format.
     * Handles {param+} wildcard patterns by converting to {param}.
     */
    private convertPathPattern(pattern: string): string {
        return pattern.replace(/\{(\w+)\+\}/g, "{$1}");
    }

    /**
     * Build the operation object for a handler.
     */
    private buildOperation(handler: FHandler<any, any>, schemas: Record<string, any>): any {
        const metadata = handler.openapi;

        const operation: any = {
            summary: metadata?.summary || this.generateSummary(handler),
            operationId: metadata?.operationId || this.generateOperationId(handler),
            tags: metadata?.tags || this.inferTagsFromPath(handler.pathPattern),
            parameters: this.buildParameters(handler, metadata),
            responses: this.buildResponses(handler, metadata),
            security: this.inferSecurity(handler.pathPattern)
        };

        // Add description if provided
        if (metadata?.description) {
            operation.description = metadata.description;
        }

        // Add deprecated flag if set
        if (metadata?.deprecated) {
            operation.deprecated = true;
        }

        // Add request body for POST/PUT/PATCH
        if (handler.schema && this.methodHasRequestBody(handler.httpMethod)) {
            const schemaName = this.registerSchema(handler.schema, schemas);
            operation.requestBody = {
                required: true,
                content: {
                    "application/json": {
                        schema: { "$ref": `#/components/schemas/${schemaName}` }
                    }
                }
            };
            if (metadata?.requestBodyDescription) {
                operation.requestBody.description = metadata.requestBodyDescription;
            }
        }

        return operation;
    }

    /**
     * Check if the HTTP method typically has a request body.
     */
    private methodHasRequestBody(method: FHttpMethod): boolean {
        return [FHttpMethod.POST, FHttpMethod.PUT, FHttpMethod.PATCH].includes(method);
    }

    /**
     * Infer security requirements from path.
     * Uses custom inference function if provided, otherwise returns empty array.
     */
    private inferSecurity(path: string): any[] {
        if (this.config.securityInference) {
            return this.config.securityInference(path);
        }
        // Default: no security inference
        return [];
    }

    /**
     * Infer tags from path.
     * Uses custom inference function if provided, otherwise extracts from path segments.
     */
    private inferTagsFromPath(path: string): string[] {
        if (this.config.tagInference) {
            return this.config.tagInference(path);
        }

        // Default tag inference: extract meaningful path segment
        const parts = path.split("/").filter(p => p && !p.startsWith("{") && p !== "v2" && p !== "v1");

        // Skip common auth-level prefixes
        const skipParts = ["public", "private", "fully-auth", "integration", "system", "webdav", "companies"];
        const domain = parts.find(p => !skipParts.includes(p.toLowerCase()));

        if (domain) {
            // Convert kebab-case to Title Case
            const formatted = domain
                .split("-")
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join("-");
            return [formatted];
        }

        return ["General"];
    }

    /**
     * Build parameters array (path + query parameters).
     */
    private buildParameters(handler: FHandler<any, any>, metadata?: OpenAPIMetadata): any[] {
        const params: any[] = [];

        // Extract path parameters from pattern
        const pathParamMatches = handler.pathPattern.match(/\{(\w+)\+?\}/g) || [];
        for (const match of pathParamMatches) {
            const paramName = match.replace(/[{}+]/g, "");
            const paramMeta = metadata?.pathParams?.[paramName];

            const param: any = {
                name: paramName,
                in: "path",
                required: true,
                schema: { type: "string" },
                description: paramMeta?.description || `The ${this.formatParamName(paramName)}`
            };

            if (paramMeta?.example) {
                param.example = paramMeta.example;
            }

            params.push(param);
        }

        // Add query parameters from metadata
        if (metadata?.queryParams) {
            for (const qp of metadata.queryParams) {
                const param: any = {
                    name: qp.name,
                    in: "query",
                    required: qp.required || false,
                    schema: qp.schema || { type: "string" },
                    description: qp.description
                };

                if (qp.example !== undefined) {
                    param.example = qp.example;
                }

                params.push(param);
            }
        }

        return params;
    }

    /**
     * Format parameter name for description (camelCase -> readable).
     */
    private formatParamName(name: string): string {
        return name
            .replace(/([A-Z])/g, " $1")
            .toLowerCase()
            .trim();
    }

    /**
     * Build responses object.
     */
    private buildResponses(handler: FHandler<any, any>, metadata?: OpenAPIMetadata): Record<string, any> {
        const responses: Record<string, any> = {};

        // Success response (200)
        const successResponse: any = {
            description: metadata?.responses?.["200"]?.description || "Successful response"
        };

        const responseSchema = metadata?.responseSchema || metadata?.responses?.["200"]?.schema;
        if (responseSchema) {
            successResponse.content = {
                "application/json": {
                    schema: responseSchema
                }
            };
        } else {
            successResponse.content = {
                "application/json": {
                    schema: { type: "object" }
                }
            };
        }
        responses["200"] = successResponse;

        // Add custom responses from metadata
        if (metadata?.responses) {
            for (const [code, def] of Object.entries(metadata.responses)) {
                if (code !== "200") {
                    const resp: any = { description: def.description };
                    if (def.schema) {
                        resp.content = {
                            "application/json": {
                                schema: def.schema
                            }
                        };
                    }
                    responses[code] = resp;
                }
            }
        }

        // Add standard error responses
        responses["400"] = { description: "Bad request - validation error" };
        responses["404"] = { description: "Resource not found" };
        responses["500"] = { description: "Internal server error" };

        // Add auth errors for non-public paths
        if (!handler.pathPattern.includes("/public/")) {
            responses["401"] = { description: "Not authenticated" };
            responses["403"] = { description: "Access denied" };
        }

        return responses;
    }

    /**
     * Build default security schemes.
     */
    private buildDefaultSecuritySchemes(): Record<string, any> {
        return {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "JWT token authentication"
            },
            apiKey: {
                type: "apiKey",
                in: "header",
                name: "X-Api-Key",
                description: "API key authentication"
            }
        };
    }

    /**
     * Generate a summary from handler method and path.
     */
    private generateSummary(handler: FHandler<any, any>): string {
        const method = handler.httpMethod;
        const pathParts = handler.pathPattern.split("/").filter(p => p && !p.startsWith("{"));
        const resource = pathParts.pop() || "resource";

        // Convert kebab-case to readable
        const resourceFormatted = resource.replace(/-/g, " ");

        switch (method) {
            case FHttpMethod.GET:
                return `Get ${resourceFormatted}`;
            case FHttpMethod.POST:
                return `Create ${resourceFormatted}`;
            case FHttpMethod.PUT:
                return `Update ${resourceFormatted}`;
            case FHttpMethod.DELETE:
                return `Delete ${resourceFormatted}`;
            case FHttpMethod.PATCH:
                return `Patch ${resourceFormatted}`;
            default:
                return `${method} ${resourceFormatted}`;
        }
    }

    /**
     * Generate a unique operation ID from handler.
     */
    private generateOperationId(handler: FHandler<any, any>): string {
        const method = handler.httpMethod.toLowerCase();
        const pathParts = handler.pathPattern
            .split("/")
            .filter(p => p && !p.startsWith("{") && p !== "v2" && p !== "v1")
            .map(p => this.capitalize(p.replace(/-/g, "")));

        return method + pathParts.join("");
    }

    /**
     * Register a schema in the components/schemas section.
     * Returns the schema name for referencing.
     */
    private registerSchema(schema: any, schemas: Record<string, any>): string {
        // Try to get name from schema
        let schemaName = schema.$id || schema.title;

        if (!schemaName) {
            // Generate a name based on count
            schemaName = `RequestSchema${Object.keys(schemas).length + 1}`;
        }

        // Clean the name (remove special characters, paths)
        schemaName = schemaName
            .replace(/^.*[/\\]/, "") // Remove path prefix
            .replace(/[^a-zA-Z0-9]/g, ""); // Remove special chars

        if (!schemas[schemaName]) {
            schemas[schemaName] = this.convertJsonSchemaToOpenAPI(schema);
        }

        return schemaName;
    }

    /**
     * Convert JSON Schema to OpenAPI-compatible schema.
     * Removes JSON Schema specific fields not supported by OpenAPI 3.0.
     */
    private convertJsonSchemaToOpenAPI(schema: any): any {
        const { $schema, $id, ...openApiSchema } = schema;
        return openApiSchema;
    }

    /**
     * Capitalize first letter.
     */
    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Infer all tags from handlers.
     */
    private inferTags(handlers: FHandler<any, any>[]): Array<{ name: string; description?: string }> {
        const tagSet = new Set<string>();

        for (const handler of handlers) {
            if (handler.httpMethod === FHttpMethod.OPTIONS) continue;
            const tags = this.inferTagsFromPath(handler.pathPattern);
            tags.forEach(t => tagSet.add(t));
        }

        return Array.from(tagSet).sort().map(name => ({ name }));
    }
}
