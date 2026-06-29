# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this project is

**Notebook v2** (`next-nootbookeV2`) — foundation cloned from `E:\next-accountV2` with the **accounting
domain removed**. It shares the **same TNP MariaDB and the same shared-Sanctum-token login** as
next-accountV2, so a user logged into the TNP ecosystem is logged in here too.

**Current state: foundation only.** Tech stack, env, DB client, the auth layer (shared-token verify +
RBAC + `authedAction`), theme, fonts, providers, and the shadcn/ui primitives exist. There is **no
business domain yet** — build the notebook features on top.

## Stack (match versions in `package.json`)

Next.js **16.2.9** (App Router, custom `server.ts`) · React **19.2.4** · TypeScript · Tailwind **v4** ·
shadcn/ui (style `base-nova`, `@base-ui/react`, `globals.css` theme) · Drizzle ORM + `mysql2` ·
TanStack Query · `next-themes` (dark via `.dark`) · `motion` · `sonner` · Zod 4 · react-hook-form.
Per `AGENTS.md`, read `node_modules/next/dist/docs/` before using a Next API — this Next is newer
than training data.

## Commands (pnpm — `pnpm-lock.yaml`)

| Command              | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `pnpm dev`           | Dev server (http://localhost:3000)                   |
| `pnpm build`         | Production build                                     |
| `pnpm start`         | Production serve via custom `server.ts` (tsx)        |
| `pnpm lint`          | ESLint (`eslint-config-next`)                        |
| `pnpm format`        | Prettier (with `prettier-plugin-tailwindcss`)        |
| `pnpm test`          | Vitest, run once (node env, `*.test.ts` next to src) |
| `pnpm db:introspect` | Read schema FROM the live DB — **never push/migrate** |
| `pnpm db:studio`     | Drizzle Studio                                       |

## Rules carried over from next-accountV2 (still apply)

- **The DB is shared with Laravel/NestJS — never `drizzle-kit push`/`migrate` or alter the schema.**
  `drizzle.config.ts` is introspect-only. Any new table/column is authored as a Laravel migration in
  `E:\TNP-FormHelpers\tnp-backend\database\migrations`, then `pnpm db:introspect` here to sync.
  `src/server/db/schema/` currently holds only the two auth tables (`users`,
  `personal_access_tokens`) — add introspected notebook tables as you build.
- **Auth: shared Sanctum `authToken` cookie verified locally** (sha256 hash compare against
  `personal_access_tokens`). `src/proxy.ts` only checks cookie presence; the real check is
  `getCurrentUser()`/`requireUser()` in Server Components and **`authedAction()`** wrapping every
  mutation Server Action (`src/server/auth`). Dev bypass: `AUTH_DEV_BYPASS=1` (dev-only, fail-closed,
  on in `.env.local`).
- **Server Actions are the default for mutations; REST is the exception.** Reads query Drizzle directly
  in Server Components; after a mutation call `revalidatePath()`/`revalidateTag()`.
- **Runtime is Node, never Edge** (`mysql2`/`@react-pdf` in `serverExternalPackages`). Money/DB strings
  stay strings. server-only modules start with `import 'server-only';`. Path alias `@/*` → `src/*`.
- UI is shadcn — scaffold with the shadcn CLI / `frontend-shadcn` skill, don't hand-write primitives.
  Comments and UI copy are in Thai.

## What was intentionally NOT copied from next-accountV2

Accounting routes/components/server-actions, `@react-pdf` document templates, the accounting Drizzle
tables, money/doc-number helpers, `docesacc/`, and `.env.production`. `@react-pdf/renderer` is still a
dependency + `serverExternalPackages` entry (ready to use) but ships no templates yet.
