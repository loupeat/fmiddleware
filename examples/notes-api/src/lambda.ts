/**
 * AWS Lambda handlers.
 *
 * The API is split into separate Lambda functions by authentication context:
 * - publicHandler: /api/public/** - no auth required, fast cold starts
 * - privateHandler: /api/private/** - requires JWT, includes auth processors
 *
 * This splitting optimizes cold start times and allows different memory/timeout
 * configurations per context.
 *
 * Deploy with: npm run deploy
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { FAWSLambdaMiddleware, logger } from "@loupeat/fmiddleware";
import { registerApi } from "./api";

// Separate middleware instances per Lambda function
// Initialized once per cold start and reused for subsequent invocations

let publicApi: FAWSLambdaMiddleware;
let privateApi: FAWSLambdaMiddleware;

/**
 * Handler for public endpoints (/api/public/**).
 * No authentication required.
 */
export const publicHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    if (!publicApi) {
        publicApi = new FAWSLambdaMiddleware();
        publicApi.setPathPrefix("/api/public"); // Only register matching routes
        registerApi(publicApi);
        logger.info(`Public API initialized with ${publicApi.getHandlers().length} handlers`);
    }

    return publicApi.process(event);
};

/**
 * Handler for private endpoints (/api/private/**).
 * Requires valid JWT token (validated by API Gateway Cognito authorizer).
 */
export const privateHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    if (!privateApi) {
        privateApi = new FAWSLambdaMiddleware();
        privateApi.setPathPrefix("/api/private"); // Only register matching routes
        registerApi(privateApi);
        logger.info(`Private API initialized with ${privateApi.getHandlers().length} handlers`);
    }

    return privateApi.process(event);
};
