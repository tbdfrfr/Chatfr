# Chatfr

Minimalist, privacy-first chat platform with sequential user numbers, bcrypt passwords, JWT sessions, global chat, DMs, groups, and WebSocket delivery.


## start everything locally:

export JWT_SECRET=dev-secret DATABASE_URL=postgres://chatfr:chatfr@localhost:5432/chatfr CLIENT_ORIGIN=http://localhost:5173
npm run db:start
npm run dev


## Stack

- Frontend: React + Vite
- Backend: Node.js + Fastify
- Database: PostgreSQL
- Realtime: native `ws`


## Science Content Consistency Log (2026-04-11)

- Standardized title naming for all generated science posts to plain topic titles.
- Removed cycle suffixes from titles (no more `— Cycle NN`).
- Standardized date formatting for all generated science posts to one pattern:
	- `Mon DD, 2026` (zero-padded day)
	- Example: `Apr 07, 2026`
- Added strict dataset validation in `client/src/sciencePosts.js` to prevent future drift.
	- Validates `id`, `date`, and `title` formats.
	- Validates excerpt prefix format (`Focus: ...`).
	- Validates structure sizes for `searchTerms`, `deepDive`, and `body`.
	- Build now fails early if formatting consistency is broken.


