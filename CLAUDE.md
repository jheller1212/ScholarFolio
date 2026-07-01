# Project Instructions

## Stack
React + TypeScript, Vite, Tailwind CSS.

## Code conventions
- Functional components only, named exports preferred.
- Organize `src/` by role: `components/`, `lib/`, `types/`, `utils/`, `services/`, `contexts/`.
- Tailwind for all styling — no CSS modules or inline style objects.
- TypeScript strict mode. Avoid `any`; use proper types or `unknown`.
- Imports: React/libraries first, then local modules, then types.

## Build & deploy
- Build gate: `npm run build` must pass before pushing.
- Workflow: build check → branch → commit → push → PR → merge. No confirmation needed.
- One change per deploy. Never bundle unrelated changes.

## Git
- Commit as: `Jonas Heller <168646044+jheller1212@users.noreply.github.com>`
  (GitHub email privacy is enabled — pushes using `jonasheller89@gmail.com` are rejected.)
