# Text-to-Handwriting

Production-oriented full-stack scaffold for a Text-to-Handwriting application.

## Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS v3, Zustand
- Backend: Node.js, Express, TypeScript
- Shared: Type-safe contracts package for cross-layer models

## Project Layout

- `frontend` contains the React application with feature modules and strict TS settings.
- `backend` contains an Express API with typed controllers/services.
- `shared` contains reusable contracts intended for both frontend and backend.

## Quick Start

1. Install dependencies from the monorepo root:
   - `npm install`
2. Start frontend:
   - `npm run dev:frontend`
3. Start backend:
   - `npm run dev:backend`
