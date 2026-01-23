import {
    FMiddleware,
    FRequest,
    NotFoundError,
    ForbiddenError,
    validator
} from "@loupeat/fmiddleware";
import { Claim } from "../processors/auth-preprocessor";

// Types
interface Note {
    id: string;
    userId: string;
    title: string;
    content: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}

interface CreateNoteRequest {
    title: string;
    content: string;
    tags?: string[];
}

interface UpdateNoteRequest {
    title?: string;
    content?: string;
    tags?: string[];
}

// Schemas
const CreateNoteSchema = {
    type: "object",
    properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } }
    },
    required: ["title", "content"]
};

const UpdateNoteSchema = {
    type: "object",
    properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } }
    }
};

// In-memory store (use DynamoDB/RDS in production)
const notesStore = new Map<string, Note>();

/**
 * Private API endpoints - authentication required.
 * The auth pre-processor ensures all requests have a valid claim in context.
 */
export function registerPrivateApi(api: FMiddleware<any, any>): void {

    // Get current user profile
    api.get("/api/private/me", async (request: FRequest<any, any>) => {
        const claim = api.context<Claim>(request, "claim");
        return api.responses.OK<any, Claim>(request, claim);
    });

    // List user's notes
    api.get("/api/private/notes", async (request: FRequest<any, any>) => {
        const claim = api.context<Claim>(request, "claim");

        const userNotes = Array.from(notesStore.values())
            .filter(note => note.userId === claim.username)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

        return api.responses.OK<any, Note[]>(request, userNotes);
    });

    // Create note
    api.post("/api/private/notes", async (request: FRequest<any, CreateNoteRequest>) => {
        const claim = api.context<Claim>(request, "claim");
        const { title, content, tags } = request.body;

        const now = new Date().toISOString();
        const note: Note = {
            id: crypto.randomUUID(),
            userId: claim.username,
            title,
            content,
            tags: tags || [],
            createdAt: now,
            updatedAt: now
        };

        notesStore.set(note.id, note);
        return api.responses.OK<CreateNoteRequest, Note>(request, note);
    }, CreateNoteSchema);

    // Get note by ID
    api.get("/api/private/notes/{noteId}", async (request: FRequest<any, any>) => {
        const claim = api.context<Claim>(request, "claim");
        const noteId = api.pathParameter(request, "noteId");
        validator.validateUuid(noteId);

        const note = notesStore.get(noteId);
        if (!note) {
            throw new NotFoundError(`Note ${noteId} not found`);
        }
        if (note.userId !== claim.username) {
            throw new ForbiddenError("Access denied");
        }

        return api.responses.OK<any, Note>(request, note);
    });

    // Update note
    api.put("/api/private/notes/{noteId}", async (request: FRequest<any, UpdateNoteRequest>) => {
        const claim = api.context<Claim>(request, "claim");
        const noteId = api.pathParameter(request, "noteId");
        validator.validateUuid(noteId);

        const note = notesStore.get(noteId);
        if (!note) {
            throw new NotFoundError(`Note ${noteId} not found`);
        }
        if (note.userId !== claim.username) {
            throw new ForbiddenError("Access denied");
        }

        const updated: Note = {
            ...note,
            title: request.body.title ?? note.title,
            content: request.body.content ?? note.content,
            tags: request.body.tags ?? note.tags,
            updatedAt: new Date().toISOString()
        };

        notesStore.set(noteId, updated);
        return api.responses.OK<UpdateNoteRequest, Note>(request, updated);
    }, UpdateNoteSchema);

    // Delete note
    api.delete("/api/private/notes/{noteId}", async (request: FRequest<any, any>) => {
        const claim = api.context<Claim>(request, "claim");
        const noteId = api.pathParameter(request, "noteId");
        validator.validateUuid(noteId);

        const note = notesStore.get(noteId);
        if (!note) {
            throw new NotFoundError(`Note ${noteId} not found`);
        }
        if (note.userId !== claim.username) {
            throw new ForbiddenError("Access denied");
        }

        notesStore.delete(noteId);
        return api.responses.NoContent(request);
    });
}
