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
api.get("/api/hello", async (request) => {
    return api.responses.OK(request, {
        message: "Hello, World!",
        timestamp: new Date().toISOString()
    });
});

// Let the middleware handle all routing
app.all("*", async (req: Request, res: Response) => {
    const response = await api.process(req);
    res.status(response.statusCode).json(response.body);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API running at http://localhost:${PORT}/api/hello`);
});
