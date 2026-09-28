# NeoScribe

NeoScribe is a full-stack clinical-documentation prototype. It brings together provider authentication, patient and template management, audio ingestion, real-time transcription integration, generated-note review, and audit logging.

This repository is a portfolio code sample. It excludes deployment credentials, local uploads, generated documentation, unrelated projects, and source-control history. It is not a clinical system and should not be used with patient data or to make clinical decisions.

## Structure

- `apps/web` — Next.js and TypeScript interface for providers, notes, templates, and audio workflows.
- `services/api` — FastAPI service for clinical-note, transcription, template, and audit workflows.
- `services/auth` — Express and TypeScript service for provider authentication and OTP flows.

## Run locally

Each service has an `.env.example` file. Copy it to `.env` or `.env.local`, then provide your own PostgreSQL and approved transcription / language-service credentials.

```bash
# API (Python 3.12 and Poetry)
cd services/api
poetry install
poetry run uvicorn app.main:app --reload --host 127.0.0.1 --port 5000

# Authentication service (Node 20+)
cd ../auth
npm install
PORT=3001 npm run dev

# Web interface (Node 20+)
cd ../../apps/web
corepack enable
pnpm install --frozen-lockfile
npm run dev
```

The web interface expects the API at `http://localhost:5000` and the authentication service at `http://localhost:3001`; the supplied example environment files reflect those defaults.
