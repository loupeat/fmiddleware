/**
 * Express.js entry point.
 *
 * Run locally with: npm run dev
 * Build and run with: npm run build && npm start
 */

import express, { Request, Response } from "express";
import { FExpressMiddleware, FResponse } from "@loupeat/fmiddleware";
import { registerApi } from "./api";

const app = express();
const api = new FExpressMiddleware();

// Register all routes
registerApi(api);

console.log(`Registered ${api.getHandlers().length} handlers`);

// Parse JSON bodies
app.use(express.json());

// Route all /api requests through FMiddleware
app.use("/api", async (req: Request, res: Response) => {
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
    console.log(`Notes API running on http://localhost:${PORT}`);
    console.log(`\nEndpoints:`);
    console.log(`  Public:  GET  http://localhost:${PORT}/api/public/health`);
    console.log(`  Public:  GET  http://localhost:${PORT}/api/public/info`);
    console.log(`  Private: GET  http://localhost:${PORT}/api/private/me (requires JWT)`);
    console.log(`  Private: GET  http://localhost:${PORT}/api/private/notes (requires JWT)`);
    console.log(`\nSet COGNITO_REGION and COGNITO_USER_POOL_ID for JWT verification.`);
});
