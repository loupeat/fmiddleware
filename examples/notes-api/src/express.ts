/**
 * Express.js entry point.
 *
 * Run locally with: npm run dev
 * Build and run with: npm run build && npm start
 */

import express, { Request, Response } from "express";
import { FExpressMiddleware, FResponse, logger } from "@loupeat/fmiddleware";
import { registerApi } from "./api";

const app = express();
const api = new FExpressMiddleware();

// Register all routes
registerApi(api);

logger.info(`Registered ${api.getHandlers().length} handlers`);

// Parse JSON bodies (10MB limit to match API Gateway)
app.use(express.json({ type: "application/json", limit: "10mb" }));

// Let the middleware handle all routing
app.all("*", async (req: Request, res: Response) => {
    const response: FResponse<any, any, any> = await api.process(req);

    // Set response headers
    for (const [key, value] of Object.entries(response.headers || {})) {
        res.setHeader(key, value);
    }

    // Send response
    if (response.statusCode === 204) {
        res.status(204).end();
    } else {
        res.status(response.statusCode).json(response.body);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Notes API running on http://localhost:${PORT}`);
    logger.info(`Endpoints:`);
    logger.info(`  Public:  GET  http://localhost:${PORT}/api/public/health`);
    logger.info(`  Public:  GET  http://localhost:${PORT}/api/public/info`);
    logger.info(`  Private: GET  http://localhost:${PORT}/api/private/me (requires JWT)`);
    logger.info(`  Private: GET  http://localhost:${PORT}/api/private/notes (requires JWT)`);
    logger.info(`Set COGNITO_REGION and COGNITO_USER_POOL_ID for JWT verification.`);
});
