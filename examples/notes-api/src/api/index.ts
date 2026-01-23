import { FMiddleware, FHttpMethod } from "@loupeat/fmiddleware";
import { AuthPreProcessorExpress, AuthPreProcessorLambda } from "../processors/auth-preprocessor";
import { registerPublicApi } from "./public";
import { registerPrivateApi } from "./private";

/**
 * Registers all API routes and processors.
 *
 * This function is called by both the Express and Lambda entry points,
 * demonstrating the framework-agnostic nature of FMiddleware.
 */
export function registerApi(api: FMiddleware<any, any>): void {
    // Register auth pre-processors for both platforms
    // FMiddleware automatically selects the right one based on requestSource
    api.addRequestPreProcessor(AuthPreProcessorExpress);
    api.addRequestPreProcessor(AuthPreProcessorLambda);

    // Handle CORS preflight requests
    api.rest("/api/**", FHttpMethod.OPTIONS, async (request) => {
        return api.responses.OK<any, {}>(request, {});
    });

    // Register route groups
    registerPublicApi(api);
    registerPrivateApi(api);
}
