/**
 * Minimal Express.js API using fmiddleware.
 *
 * Run: npm install && npm start
 * Test: curl http://localhost:3000/api/hello
 */

import express, { Request, Response } from "express";
import { FExpressMiddleware } from "@loupeat/fmiddleware";

const app = express();
const api = new FExpressMiddleware();

// Define a simple route
api.get("/hello", async (request) => {
    return api.responses.OK(request, {
        message: "Hello, World!",
        timestamp: new Date().toISOString()
    });
});

// Route all /api requests through the middleware
app.use("/api", async (req: Request, res: Response) => {
    const response = await api.process(req);

    // Apply headers returned by the middleware (e.g., CORS headers)
    if (response.headers) {
        for (const [name, value] of Object.entries(response.headers)) {
            if (value !== undefined) {
                res.setHeader(name, String(value));
            }
        }
    }

    // Handle 204 No Content responses without a body
    if (response.statusCode === 204) {
        res.status(204).end();
        return;
    }

    // Apply response headers (including CORS)
    for (const [key, value] of Object.entries(response.headers || {})) {
        res.setHeader(key, value as string);
    }

    // Handle 204 No Content (no body)
    if (response.statusCode === 204) {
        res.status(204).end();
    } else {
        res.status(response.statusCode).json(response.body);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API running at http://localhost:${PORT}/api/hello`);
});
