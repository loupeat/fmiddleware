import {
    FMiddleware,
    FRequest,
    FHandler,
    RequestPreProcessor,
    AuthenticationError
} from "@loupeat/fmiddleware";
import { APIGatewayProxyEvent } from "aws-lambda";
import {
    verifyCognitoToken,
    extractClaimFromApiGateway,
    getCognitoConfig,
    Claim
} from "../auth/cognito";

/**
 * Auth pre-processor for Express.js requests.
 *
 * Extracts the Bearer token from the Authorization header and verifies it
 * against Cognito's JWKS endpoint.
 */
export const AuthPreProcessorExpress: RequestPreProcessor = {
    name: "CognitoAuthPreProcessor-Express",
    pathPatterns: ["/api/private/**"],
    requestSource: "express",
    process: async (
        _api: FMiddleware<any, any>,
        request: FRequest<any, any>,
        _handler: FHandler<any, any>
    ): Promise<void> => {
        const authorizationHeader = request.headers["authorization"];

        if (!authorizationHeader) {
            throw new AuthenticationError("Missing Authorization header");
        }

        if (!authorizationHeader.startsWith("Bearer ")) {
            throw new AuthenticationError("Invalid Authorization header format");
        }

        const token = authorizationHeader.replace(/^Bearer /, "");

        try {
            const config = getCognitoConfig();
            const claim = await verifyCognitoToken(token, config);
            request.context["claim"] = claim;
        } catch (error) {
            const message = error instanceof Error ? error.message : "Token verification failed";
            throw new AuthenticationError(`Invalid token: ${message}`);
        }
    }
};

/**
 * Auth pre-processor for AWS Lambda requests.
 *
 * When using a Cognito authorizer at API Gateway level, the token is already
 * verified and claims are available in the request context. This processor
 * simply extracts them into the FMiddleware request context.
 */
export const AuthPreProcessorLambda: RequestPreProcessor = {
    name: "CognitoAuthPreProcessor-Lambda",
    pathPatterns: ["/api/private/**"],
    requestSource: "aws-lambda",
    process: async (
        _api: FMiddleware<any, any>,
        request: FRequest<APIGatewayProxyEvent, any>,
        _handler: FHandler<any, any>
    ): Promise<void> => {
        const claim = extractClaimFromApiGateway(request.originalRequest);

        if (!claim) {
            throw new AuthenticationError("No authentication claims found in request");
        }

        request.context["claim"] = claim;
    }
};

// Re-export Claim type
export type { Claim };
