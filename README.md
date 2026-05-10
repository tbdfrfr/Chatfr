# Chatfr

A modern, modular chat application with real-time messaging, group conversations, and direct messaging capabilities.

## Quick Start

### Prerequisites

- Node.js (18+)
- PostgreSQL (via Docker Compose)

### Installation

```bash
git clone <repo-url>
cd Chatfr
npm install
npm run db:start
npm run dev
```

Frontend runs on http://localhost:5173, backend on http://localhost:3001.

## Tech Stack

- Frontend: React 19 + Vite + WebSocket
- Backend: Fastify 5 + Node.js + PostgreSQL
- Authentication: JWT + bcrypt
- Real-time: WebSocket

## Project Structure

```
client/src/
  lib/              - Shared utilities (api, socket, storage)
  components/       - Reusable UI components
  features/         - Feature modules (auth, chat, threads, groups, profile, settings)

server/src/
  routes/           - HTTP route handlers
  *Domain.js        - Business logic (domain-driven design)
  realtime/         - WebSocket handling
```

## Development Commands

```bash
npm run dev        # Run frontend and backend concurrently
npm run build      # Build for production
npm run db:start   # Start PostgreSQL
npm run db:stop    # Stop PostgreSQL
```

## Contributing

1. Review the project structure above to understand the codebase
2. Follow patterns in existing code
3. Run `npm run build` before submitting changes
4. Test with `npm run dev`
