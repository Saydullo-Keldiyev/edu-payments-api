# EduPay: education center payment tracking

A small system for tracking student payments and finding monthly debtors.

- **backend/**: REST API. Node.js, TypeScript (strict), Express 5, PostgreSQL, Prisma 6 (migrations), Zod 4, Vitest + Supertest
- **frontend/**: admin UI. Next.js 15 App Router, TypeScript, Tailwind CSS 4

The backend is the single source of truth for money and debt. The UI only displays what the API returns.

---

## Quick start with Docker (recommended)

Only **Docker** (with Compose v2) is needed: no Node.js and no local PostgreSQL.

```bash
git clone https://github.com/Saydullo-Keldiyev/edu-payments-api.git
cd edu-payments-api
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
#   then replace "change_me" with any password (letters and digits only)
docker compose up --build
```

- Admin UI: http://localhost:3000
- API: http://localhost:4000 (for example http://localhost:4000/health)

Compose starts the services in order and waits for each one's health check:

| Service | What it does |
|---|---|
| `db` | PostgreSQL 17. Data lives in the `pgdata` volume, and the database is not published to the host |
| `migrate` | Runs `prisma migrate deploy` once, then exits |
| `backend` | The compiled API (`node dist/server.js`), production dependencies only, non-root user. Starts after the migrations succeed |
| `frontend` | Next.js standalone server. The browser calls the API at `http://localhost:${API_PORT}` |

Run the 96 integration tests inside Docker (they use a separate `<POSTGRES_DB>_test` database on the same server):

```bash
docker compose --profile test run --rm test
```

Other useful commands:

```bash
docker compose down
```
Stops everything; the data is kept.

```bash
docker compose down -v
```
Stops everything and **deletes** the database volume.

If ports 3000 or 4000 are busy, change `WEB_PORT` / `API_PORT` in `.env` and run `docker compose up --build` again. The UI must be rebuilt because the API URL is baked into its bundle.

---

## Local development without Docker for the apps

Prerequisites: **Node.js ≥ 20.11** (developed on 24.14), **npm**, and **Docker** (for PostgreSQL only). If you don't use Docker, any PostgreSQL ≥ 14 works; point the URLs in `backend/.env` at it. `backend/docker-compose.yml` starts just the database on `127.0.0.1:5433`, so it can run next to the full stack.

### 1. Backend (http://localhost:4000)

```bash
cd backend
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
#   then replace "change_me" with a password of your choice (it appears 3 times)
npm install                   # also runs `prisma generate`
npm run db:up                 # starts PostgreSQL 17 on 127.0.0.1:5433 (credentials from .env)
npm run prisma:deploy         # applies all migrations to DATABASE_URL
npm test                      # migrates + runs the integration tests against TEST_DATABASE_URL
npm run dev                   # API with auto-reload
```

### 2. Frontend (http://localhost:3000)

In a second terminal:

```bash
cd frontend
cp .env.example .env.local    # PowerShell: Copy-Item .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. The API must be running, and `CORS_ORIGIN` in `backend/.env` must contain the UI origin (the default is `http://localhost:3000`).

### All scripts

| Where | Command | What it does |
|---|---|---|
| backend | `npm run dev` | Start the API with `tsx watch` |
| backend | `npm run build` / `npm start` | Compile to `dist/` / run the compiled server |
| backend | `npm run typecheck` | `tsc --noEmit` over source and tests |
| backend | `npm run lint` | ESLint (type-aware `typescript-eslint`) |
| backend | `npm test` | Vitest integration tests (needs the database running) |
| backend | `npm run db:up` / `db:down` | Start / stop the PostgreSQL container |
| backend | `npm run prisma:migrate` | Create a new migration while developing (`prisma migrate dev`) |
| backend | `npm run prisma:deploy` | Apply existing migrations (`prisma migrate deploy`) |
| backend | `npm run prisma:studio` | Browse the data |
| frontend | `npm run dev` / `build` / `start` | Next.js dev server / production build / serve the build |
| frontend | `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint (`next/core-web-vitals`, `next/typescript`) |

---

## Configuration

No credentials are committed. Each app has a `.env.example` with placeholders. Real values go in the git-ignored `.env` (backend) and `.env.local` (frontend).

| Variable | App | Purpose |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | backend | Used by `docker-compose.yml` to create the local database |
| `DATABASE_URL` | backend | PostgreSQL connection string used by the API and Prisma |
| `TEST_DATABASE_URL` | backend | **Separate** database for tests. It is migrated and wiped on every run. The test runner refuses to start if it equals `DATABASE_URL`. |
| `PORT` | backend | API port (default 4000) |
| `CORS_ORIGIN` | backend | Comma-separated browser origins allowed to call the API |
| `NODE_ENV` | backend | `development` / `test` / `production` |
| `NEXT_PUBLIC_API_URL` | frontend | Base URL of the API. It is inlined into the browser bundle at build time, so it must never hold a secret. |

The backend validates its environment with Zod at startup and exits with a clear message if anything is missing or malformed (`src/config/env.ts`).

---

## API

All responses are JSON. Money is sent as a **decimal string with two places** (`"500000.00"`) so no client ever has to parse a float. Requests accept money as a string (`"500000.5"`) or a JSON number. Dates are calendar dates, `YYYY-MM-DD`.

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/health` | 200 `{status, database}` | 503 if the database is unreachable |
| POST | `/students` | 201 Student | 400 validation, 409 phone already used |
| GET | `/students` | 200 Student[] (newest first) | |
| GET | `/students/:id` | 200 Student | 400 bad UUID, 404 |
| PUT | `/students/:id` | 200 Student (full replacement, all fields required) | 400, 404, 409 phone already used |
| DELETE | `/students/:id` | 204 | 400, 404, **409 if the student has payment history** |
| POST | `/payments` | 201 Payment | 400 validation, 404 student not found |
| GET | `/students/:id/payments` | 200 Payment[] (newest `paymentDate` first) | 400, 404 |
| GET | `/debtors?month=YYYY-MM` | 200 `{month, count, totalDebt, debtors[]}` | 400 missing or invalid month |
| GET | `/students/:id/balance?month=YYYY-MM` | 200 running balance (month defaults to the current month) | 400, 404 |
| GET | `/balances/debtors?month=YYYY-MM` | 200 `{month, count, totalDebt, debtors[]}` by running balance | 400 |

```jsonc
// Student
{ "id": "uuid", "name": "Aziza Karimova", "phone": "+998901110001", "groupName": "IELTS 7",
  "monthlyFee": "650000.00", "startMonth": "2026-10", "createdAt": "2026-10-22T08:48:59.000Z", "updatedAt": "..." }
// GET /students/:id/balance?month=2026-10  (fee 500 000, 1 200 000.50 paid in total)
{ "studentId": "uuid", "month": "2026-10", "startMonth": "2026-10", "monthlyFee": "500000.00", "monthsBilled": 1,
  "totalDue": "500000.00", "totalPaid": "1200000.50", "debtAmount": "0.00", "creditAmount": "700000.50",
  "unpaidMonths": 0, "paidThroughMonth": "2026-11" }
// Payment
{ "id": "uuid", "studentId": "uuid", "amount": "200000.00", "paymentDate": "2026-10-05", "createdAt": "..." }
// GET /debtors?month=2026-10
{ "month": "2026-10", "count": 1, "totalDebt": "200000.00",
  "debtors": [{ "studentId": "uuid", "name": "Bekzod Rahimov", "phone": "+998901110002", "groupName": "English B1",
                "monthlyFee": "500000.00", "totalPaid": "300000.00", "debtAmount": "200000.00" }] }
// Every error
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed",
             "details": [{ "path": "amount", "message": "Must be greater than 0" }] } }
```

Validation rules:
- **IDs** must be UUIDs, otherwise 400 (not a database error and not a 404).
- **amount** must be > 0, with at most 10 integer digits and 2 decimals. Negative, zero, `"1e5"`, `"10.001"`, `null`, and booleans are all rejected.
- **monthlyFee** follows the same format but may be `0`.
- **phone** may be typed with spaces, dashes, or parentheses. It is normalized to `+?digits` (7 to 15 digits) before the uniqueness check, so `+998 90 111 22 33` and `+998901112233` conflict.
- **paymentDate** must be a real calendar date (`2026-02-30` is rejected, `2028-02-29` is accepted).
- **month** and **startMonth** must be `YYYY-MM` with month 01 to 12.
- **startMonth** (first billed month) is an addition to the assignment's student fields. It is optional: on create it defaults to the current month, and on PUT, omitting it keeps the stored value.
- Unknown body fields are rejected. Malformed JSON returns 400.

### How debtors are calculated

For the requested month, `GET /debtors` runs a single SQL query (`backend/src/modules/debtors/debtors.service.ts`) that:

1. Takes **every** student and `LEFT JOIN`s their payments with `payment_date >= first day of month AND payment_date < first day of next month` (a half-open range; December rolls over to January). Because the date filter is in the JOIN condition, students with no payments are kept, with `totalPaid = 0`.
2. Sums multiple payments with `SUM(amount)` on `NUMERIC` values, so the arithmetic is exact. JavaScript numbers are never involved: `0.70 + 0.10` really equals `0.80`, which the tests check.
3. Keeps only rows where `monthlyFee - totalPaid > 0`, which is `debtAmount = max(0, monthlyFee - totalPaid) > 0`. Fully paid and overpaid students are excluded. An overpayment does **not** carry over to other months.
4. Orders the rows by debt, largest first, and computes `totalDebt` with a window function.

### Running balance (overpayments carry forward)

The assignment's rule above treats each month on its own: a student with a 200 000 fee who pays 1 000 000 in January is still a debtor in February. Admins also need to see who is actually behind once overpayments are credited, so a second calculation sits **next to** `/debtors`, which is left exactly as specified (`backend/src/modules/balances/`):

- Every month from the student's `startMonth` up to and including the requested month is billed `monthlyFee`.
- All of the student's payments, whatever their date, pay the **oldest month first**. With a 200 000 fee, 1 000 000 covers five months. If September is unpaid, a 400 000 payment in October clears September and October. A late payment made in November still clears October.
- So `totalDue = monthlyFee × monthsBilled`, `debtAmount = max(0, totalDue − totalPaid)` (every unpaid month up to the requested month), `creditAmount = max(0, totalPaid − totalDue)` (prepaid amount), `paidThroughMonth` = the last fully covered month, and `unpaidMonths = ceil(debt / fee)`.
- Months before `startMonth` are never billed. Sums run in PostgreSQL `NUMERIC`, the derived values use `Prisma.Decimal`, and `paidThroughMonth` uses BigInt, so even an enormous prepayment cannot overflow.

The UI shows both: the Debtors page has **This month only** and **Running balance** tabs, and each student page has a balance card ("Prepaid 700 000.50 · paid through November 2026").

---

## Design decisions

- **Money**: `DECIMAL(12,2)` in PostgreSQL and `Prisma.Decimal` in code. It is serialized with `toFixed(2)`, and `CHECK` constraints (`amount > 0`, `monthly_fee >= 0`) back up the API validation.
- **`paymentDate` is a `DATE`, not a timestamp.** A payment belongs to a calendar day, so month boundaries never depend on server or client timezones.
- **Deleting a student with payments** is refused at two levels. The service checks first and returns a 409 with `paymentCount`. The foreign key is also `ON DELETE RESTRICT`, which catches a payment that sneaks in between the check and the delete.
- **"Student exists" for a new payment** is enforced by the foreign key (P2003 → 404) instead of check-then-insert, so there is no race.
- **Modular layout**: each module has `routes → controller (parse/validate) → service (Prisma)`. Controllers parse input with Zod, any `ZodError` becomes a uniform 400 in the central error handler, and services throw typed `AppError`s.

### Project structure

```
docker-compose.yml            Full stack: db, migrate, backend, frontend (+ `test` profile)
.env.example                  Credentials and host ports for the full stack
backend/
  Dockerfile                  build (compile; also used by migrate/test), prod-deps, runtime (slim, non-root)
  docker-compose.yml          PostgreSQL only, for local development on 127.0.0.1:5433
  prisma/schema.prisma        Student and Payment models (UUID ids, DECIMAL money, DATE paymentDate)
  prisma/migrations/          init + hand-written CHECK constraints on money columns
  src/server.ts               HTTP listener and graceful shutdown
  src/app.ts                  Express app factory (helmet, CORS, JSON body limit, routers, error handling)
  src/config/env.ts           Zod-validated environment, fail-fast
  src/lib/prisma.ts           Shared PrismaClient
  src/lib/money.ts            Money input schema (string|number → exact decimal string) and formatting
  src/lib/prisma-errors.ts    Narrowing helper for Prisma error codes
  src/common/errors.ts        AppError, NotFoundError, ConflictError, BadRequestError
  src/common/validation.ts    Shared schemas: UUID param, calendar date, date conversions
  src/common/middleware/error-handler.ts   404 and central error → JSON mapping
  src/modules/health/         GET /health (pings the DB)
  src/modules/students/       CRUD: schemas, service, controller, routes
  src/modules/payments/       POST /payments, GET /students/:id/payments
  src/modules/debtors/        GET /debtors: month validation, half-open range, SQL aggregation
  src/modules/balances/       Running balance: GET /students/:id/balance, GET /balances/debtors
  tests/global-setup.ts       Runs `prisma migrate deploy` on the test DB before the suite
  tests/helpers.ts            App instance, DB reset, factories
  tests/*.test.ts             Supertest integration tests (health, students, payments, debtors)
  vitest.config.ts            Points the tests at TEST_DATABASE_URL and runs files serially
frontend/
  Dockerfile                  deps, build (API URL as build arg), standalone runtime
  src/lib/types.ts            TypeScript mirror of the API DTOs
  src/lib/api.ts              Shared typed API client and ApiError (status, code, field errors)
  src/lib/use-async.ts        Loading/error/data hook with race protection and reload
  src/lib/format.ts           Display formatting for money/dates without float math
  src/lib/input.ts            Keystroke filters: letters can't be typed into phone or money fields
  src/components/ui.tsx       Buttons, cards, alerts, fields, loading/empty states
  src/components/nav.tsx      Responsive top navigation
  src/components/payment-form.tsx   Payment form (student, amount, date) with client and server validation
  src/components/student-form.tsx   Create/edit student form (including start month)
  src/components/balance-card.tsx   Student running balance: debt or prepaid amount, paid-through month
  src/app/page.tsx            Dashboard: total students, debtor count and outstanding total for this month
  src/app/debtors/page.tsx    Debtors with month selector and "This month only" / "Running balance" tabs (?month=&view=)
  src/app/payments/new/page.tsx     Record a payment (?studentId= preselects)
  src/app/students/page.tsx   Students CRUD with search
  src/app/students/[id]/page.tsx    Student details, payment history, inline payment form
```

---

## Tests

`npm test` in `backend/` runs **96 integration tests** through the real Express app and a real PostgreSQL database. They cover:

- **Students**: create, normalization, field validation, unknown fields, duplicate phone (create and update), list, get, full PUT, delete, delete refused with payment history, and malformed vs unknown IDs.
- **Payments**: create, amount and date validation (zero, negative, exponent, 3 decimals, impossible dates, datetimes), unknown student, history ordering, empty history.
- **Debtors**: unpaid, partially paid, fully paid, overpaid, zero fee, multiple payments summed, exact decimals (`100.10 + 0.10 + 0.10 = 100.30`), month boundaries (last day of the previous month, first and last day of the month, first day of the next month), leap-year February, December → January rollover, month independence, ordering and total, and invalid or repeated `month` values.
- **Running balance**: 200 000 fee with 1 000 000 paid covers exactly five months, oldest month first, accumulated and partial months, late payments, no billing before `startMonth`, zero fee, exact decimals, a huge prepayment, ordering and totals, `/debtors` unchanged for the same data, validation. Also `startMonth` defaults, keep-on-update, and invalid values.
- **Infrastructure**: health check, JSON 404 for unknown routes, malformed JSON.

The frontend has no automated tests. It was checked manually against the running API, and `npm run build` type-checks and lints it.

---

## Known limitations and suggested improvements

1. **Billing periods and fee history.** `/debtors` follows the assignment and bills every student in any month, so a student who joined in October also appears for September. The running balance respects `startMonth`, but it has no end month (a student who leaves keeps accruing), and it applies today's `monthlyFee` to every past month. A real system should store `leftAt` and fee changes, or generate one invoice per month.
2. **Authentication and audit trail.** The admin API is open. Add authentication (session or JWT) with roles, and record who created each payment. Payments are currently immutable with no correction flow. Add a "void/refund" operation instead of edits or deletes.
3. **Idempotency.** A double-clicked submit or a network retry can record a payment twice. Accept an `Idempotency-Key` header on `POST /payments`.
4. **Pagination and server-side search.** `GET /students` and `GET /debtors` return everything. Add cursor pagination and filters (group, search) before the data grows.
5. **CI and dependency upgrades.** Add a GitHub Actions workflow (Postgres service, `lint`, `typecheck`, `test`, frontend `build`) and add frontend component/E2E tests (Playwright). `npm audit` still reports dev-only findings: Prisma 6's CLI (`deepmerge-ts`, fixed only in Prisma 7, a major upgrade with driver adapters) and `eslint-config-next`'s `braces` (no fixed version exists). Neither ships in the runtime.

### Environment notes

- `backend/package.json` overrides `rollup` with `@rollup/wasm-node`. On the development machine, Windows Application Control blocked Rollup's unsigned native `.node` binary, which Vitest loads through Vite. The WASM build behaves the same on every OS.
- `frontend/package.json` overrides Next's bundled `postcss` to 8.5.31 to pick up a security fix that Next 15 does not ship yet.
