/**
 * OpenAPI metadata that can be associated with an endpoint handler.
 * This metadata is used by the OpenApiGenerator to enrich the generated specification.
 */
export interface OpenAPIMetadata {
    /** Brief description of what the endpoint does */
    summary?: string;
    /** Detailed description of the endpoint behavior */
    description?: string;
    /** Tags to categorize this endpoint (e.g., ["Users", "Authentication"]) */
    tags?: string[];
    /** Unique operation identifier for code generation tools */
    operationId?: string;
    /** Mark endpoint as deprecated */
    deprecated?: boolean;
    /** Query parameter definitions */
    queryParams?: QueryParamDef[];
    /** Path parameter descriptions (keyed by parameter name) */
    pathParams?: Record<string, PathParamDef>;
    /** JSON Schema for the response body */
    responseSchema?: any;
    /** Custom response definitions by status code */
    responses?: Record<string, ResponseDef>;
    /** Description for the request body */
    requestBodyDescription?: string;
}

/**
 * Definition for a query parameter.
 */
export interface QueryParamDef {
    /** Parameter name as it appears in the query string */
    name: string;
    /** Description of what this parameter does */
    description?: string;
    /** Whether this parameter is required (default: false) */
    required?: boolean;
    /** JSON Schema for the parameter value */
    schema?: any;
    /** Example value for documentation */
    example?: any;
}

/**
 * Definition for a path parameter.
 */
export interface PathParamDef {
    /** Description of what this parameter represents */
    description?: string;
    /** Example value for documentation */
    example?: string;
}

/**
 * Definition for a response.
 */
export interface ResponseDef {
    /** Description of when this response is returned */
    description: string;
    /** JSON Schema for the response body */
    schema?: any;
}

/**
 * Complete OpenAPI 3.0 specification structure.
 */
export interface OpenAPISpec {
    openapi: string;
    info: {
        title: string;
        version: string;
        description?: string;
    };
    servers: Array<{
        url: string;
        description?: string;
    }>;
    paths: Record<string, any>;
    components: {
        schemas: Record<string, any>;
        securitySchemes?: Record<string, any>;
    };
    tags?: Array<{
        name: string;
        description?: string;
    }>;
}

/**
 * Configuration for the OpenAPI generator.
 */
export interface GeneratorConfig {
    /** API metadata */
    info: {
        title: string;
        version: string;
        description?: string;
    };
    /** Server URLs for the API */
    servers?: Array<{
        url: string;
        description?: string;
    }>;
    /** Tag definitions with descriptions */
    tags?: Array<{
        name: string;
        description?: string;
    }>;
    /** Security scheme definitions */
    securitySchemes?: Record<string, any>;
    /**
     * Custom function to infer security requirements from path.
     * Return an array of security requirement objects, e.g., [{ bearerAuth: [] }]
     */
    securityInference?: (path: string) => any[];
    /**
     * Custom function to infer tags from path.
     * Return an array of tag names, e.g., ["Users"]
     */
    tagInference?: (path: string) => string[];
}
