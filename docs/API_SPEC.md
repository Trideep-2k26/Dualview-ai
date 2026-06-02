Read docs/PRD.md carefully.

Now generate a complete API_SPEC.md for the project.

Include:

1. REST API overview
2. Authentication approach (even if local dev skips auth)
3. Endpoint definitions
4. Request schemas
5. Response schemas
6. Error response formats
7. SSE streaming event structure
8. Session lifecycle
9. Rate limiting behavior
10. Validation rules
11. OpenAPI-compatible schema examples
12. Example curl requests
13. Frontend integration examples
14. API versioning strategy
15. Production recommendations

Endpoints:

* POST /api/ingest
* POST /api/chat/stream
* GET /api/sessions/{session_id}
* DELETE /api/sessions/{session_id}
* GET /api/health

Include:

* exact JSON request/response examples
* streaming examples
* error handling examples
* HTTP status codes
* content types
* headers

Make this implementation-focused for backend/frontend engineers.
