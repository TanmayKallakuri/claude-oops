# Local setup

## Prerequisites

- Node.js 20+
- npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/local-development) installed
- Docker Desktop running (Supabase CLI uses Docker)

## First-time setup

1. Clone and install:

   ```bash
   git clone https://github.com/TanmayKallakuri/claude-oops.git
   cd claude-oops
   npm install
   ```

2. Start local Supabase:

   ```bash
   supabase start
   ```

   This prints `API URL`, `Publishable key`, and `Secret key`.

3. Copy `.env.example` to `.env` and paste the values.

4. Apply migrations:

   ```bash
   supabase db reset
   ```

5. Create a GitHub OAuth app at https://github.com/settings/developers:
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:54001/auth/v1/callback`
     (matches the API port in `supabase/config.toml`)

   Put the client ID / secret in `.env`.

6. Run the app:

   ```bash
   npm run dev
   ```

   Visit http://localhost:3000.

## Running tests

```bash
npm test                 # unit tests (fast, no Supabase)
npm run test:integration # resets DB, hits real API routes
```

## Ports

Local Supabase listens on the `5400x` range (API 54001, DB 54002, Studio
54003, Inbucket/Mailpit 54004). The Windows dynamic port reservation
blocks the default `5432x` range, so `supabase/config.toml` uses remapped
ports consistently.
