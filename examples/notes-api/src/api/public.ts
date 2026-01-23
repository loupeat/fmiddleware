import { FMiddleware, FRequest } from "@loupeat/fmiddleware";

/**
 * Public API endpoints - no authentication required.
 * These routes are accessible to anyone.
 */
export function registerPublicApi(api: FMiddleware<any, any>): void {

    // Health check
    api.get("/api/public/health", async (request: FRequest<any, any>) => {
        return api.responses.OK<any, { status: string; timestamp: string }>(request, {
            status: "healthy",
            timestamp: new Date().toISOString()
        });
    });

    // API info
    api.get("/api/public/info", async (request: FRequest<any, any>) => {
        return api.responses.OK<any, { name: string; version: string }>(request, {
            name: "Notes API",
            version: "1.0.0"
        });
    });

    // Featured/public notes
    api.get("/api/public/notes/featured", async (request: FRequest<any, any>) => {
        const featuredNotes = [
            { id: "1", title: "Welcome to Notes", excerpt: "Get started..." },
            { id: "2", title: "Tips & Tricks", excerpt: "Learn how to..." }
        ];
        return api.responses.OK<any, typeof featuredNotes>(request, featuredNotes);
    });
}
