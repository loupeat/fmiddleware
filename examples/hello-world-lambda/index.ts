/**
 * Minimal AWS Lambda API using fmiddleware.
 *
 * Deploy: serverless deploy
 * Test: curl https://your-api-id.execute-api.region.amazonaws.com/dev/hello
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { FAWSLambdaMiddleware } from "@loupeat/fmiddleware";

const api = new FAWSLambdaMiddleware();

// Define a simple route
api.get("/hello", async (request) => {
    return api.responses.OK(request, {
        message: "Hello, World!",
        timestamp: new Date().toISOString()
    });
});

// Lambda handler
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    return api.process(event);
};
