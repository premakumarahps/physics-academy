# AL Physics Academy — LMS Platform

## Project Overview

**AL Physics Academy** is a full-stack, serverless Learning Management System (LMS) for an Advanced Level (A/L) Physics tuition class in Sri Lanka. It enables the teacher (admin) to manage students, build question banks, create exam papers, assign work, upload study materials, track results, and deliver personalized feedback — all through a rich web interface accessible from any device.

The public-facing site (landing page) is CMS-driven and fully editable through Supabase without touching code. The student portal is protected by JWT authentication with role-based access.

---

## Tech Stack

| Layer              | Technology                                                     |
| ------------------ | -------------------------------------------------------------- |
| **Frontend**       | Vanilla HTML, CSS, JavaScript (no frameworks)                  |
| **Backend API**    | Node.js + Express.js (Serverless via Vercel Functions)         |
| **Database**       | Supabase (PostgreSQL)                                          |
| **File Storage**   | Supabase Storage (two buckets: `image-bank`, `material-bank`)  |
| **Auth**           | JWT (jsonwebtoken) + bcrypt password hashing                   |
| **Deployment**     | Vercel (CDN for `/public`, Serverless for `/api`)              |
| **Math Rendering** | KaTeX (loaded via CDN in browser)                              |
| **File Uploads**   | Multer (memory storage, streamed directly to Supabase Storage) |

**Key npm dependencies:** `@supabase/supabase-js`, `express`, `jsonwebtoken`, `bcrypt`, `multer`, `cors`, `dotenv`

---

## Repository Structure

```
AL_Physics_Academy/
├── api/
│   └── index.js            ← Single Express app — all backend API routes. Exported as a module for Vercel.
├── public/                 ← All frontend files. Served as static assets by Vercel CDN.
│   ├── index.html          ← Landing/marketing page shell (content rendered by home.js)
│   ├── home.js             ← Landing page JS: fetches site content from API, renders sections dynamically
│   ├── home.css            ← Landing page styles
│   ├── login.html          ← Login & self-registration page
│   ├── admin.html          ← Admin dashboard (full SPA shell)
│   ├── admin.js            ← Admin dashboard JS (~95KB): all admin panel logic
│   ├── admin.css           ← Admin dashboard styles
│   ├── student.html        ← Student dashboard shell
│   ├── student.js          ← Student dashboard JS: view assignments, take papers, view results/feedback/materials
│   ├── student.css         ← Student dashboard styles
│   ├── paper.html          ← Exam-taking interface (timed MCQ paper)
│   ├── app.js              ← Exam-taking logic: renders questions, manages timer, submits results
│   ├── data.js             ← CLIENT-SIDE DATA LAYER: the `DB` object. All API calls go through here.
│   ├── shared.js           ← Shared rendering utilities: `buildQuestionHTML()`, KaTeX, image positioning
│   ├── auth.js             ← Auth helpers: session management via sessionStorage
│   ├── index.css           ← Global / shared CSS variables and base styles
│   ├── shared.css          ← Shared component styles (badges, buttons, modals, etc.)
│   ├── logo.svg            ← Academy logo
│   ├── exam_template.json  ← JSON structure template for exam paper metadata
│   ├── first_page_template.html   ← Print-friendly exam paper first page template
│   └── second_page_template.html  ← Print-friendly exam answer sheet template
├── cloud-config-sync/
│   ├── pull_content.js     ← Script: fetches landing page config from Supabase → saves to local JSON
│   ├── push_content.js     ← Script: pushes local JSON back to Supabase (deploy content changes)
│   └── content/            ← Local JSON files for landing page CMS content (gitignored or editable locally)
├── scripts/
│   ├── create_admins.sql   ← SQL to manually seed the admins table
│   └── migrate_admins.js   ← Migration script to move admin accounts to the dedicated admins table
├── exam-renderer.html      ← Standalone HTML tool for rendering and printing exam papers from JSON
├── supabase_schema.sql     ← Full Supabase PostgreSQL schema (run once to initialize DB)
├── vercel.json             ← Vercel routing config: /api/* → api/index.js, everything else → static files
├── package.json            ← Node.js project config. Entry: api/index.js. Dev: `vercel dev`
├── .env                    ← Local secrets (NOT committed): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET
└── .gitignore              ← Ignores node_modules, .env, etc.
```

---

## Architecture

### Serverless Separation of Concerns

```
Browser (Client)
    ↓  Static files (HTML/CSS/JS)
Vercel CDN (/public/)
    ↓  /api/* requests
Vercel Serverless Function (api/index.js — Express app)
    ↓  Supabase JS SDK (Service Role key — bypasses RLS)
Supabase PostgreSQL (Database + Storage)
```

### Key Architectural Rules

1. **camelCase ↔ snake_case Bridge**: The database uses `snake_case` (e.g. `exam_type`). The JavaScript frontend uses `camelCase` (e.g. `examType`). **Never manually translate keys on the client.** The `mapKeys()` function in `api/index.js` handles all conversions automatically on every API response (`toCamel`) and request (`toSnake`).

2. **Client-Side Data Layer (`DB` object in `data.js`)**: All frontend code interacts with the backend exclusively through the `DB` singleton object. It maintains an in-memory `_state` cache and syncs all mutations to the server via background `fetch()` calls. Never call `/api/` directly from page scripts — always go through `DB`.

3. **Auth Flow**: On login, the backend issues a signed JWT (1-hour expiry). The frontend stores the full session object (token + user info) in `sessionStorage` under the key `active_session`. The `DB._getAuthHeaders()` method reads and attaches this token to all authenticated requests. Session handling logic lives in `auth.js`.

4. **Role System**: Two roles exist — `admin` and `student`. Admins have a separate `admins` table (isolated from students). Students can have a `type` of `premium` or `guest`. Guests can self-register. The backend enforces role checks via the `adminOnly` middleware.

5. **Image Uploads**: Question images are compressed client-side by `DB._compressImage()` (canvas resize to max 1600px, JPEG quality 0.8) before being uploaded via `multipart/form-data` to avoid Vercel's 4.5MB serverless payload limit. Images are stored in the `image-bank` Supabase Storage bucket and referenced by public URL.

---

## Database Schema (Supabase PostgreSQL)

All tables have RLS enabled. The backend uses the **Service Role key** to bypass RLS for all operations.

| Table                  | Purpose                                                                                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admins`               | Admin accounts (isolated from students). Fields: `id`, `username`, `password` (bcrypt), `raw_password`, `created_at`                                                                                                                                                                    |
| `students`             | Student accounts. Fields: `id`, `name`, `username`, `password` (bcrypt), `raw_password`, `type` (`premium`/`guest`), `whatsapp`, `created_at`                                                                                                                                           |
| `questions`            | Question bank. Fields: `id` (e.g. `q_01`), `type` (MCQ/Structured/Essay), `source`, `exam_type`, `location` (JSONB: `{year, questionNumber}`), `unit`, `sub_unit`, `question` (HTML string), `options` (JSONB), `correct_answer`, `images` (JSONB array of image objects), `created_at` |
| `papers`               | Exam papers / activities. Fields: `id`, `name`, `code`, `timer_minutes`, `question_ids` (JSONB array), `activity_type` (`paper`), `description`, `due_date`, `max_attempts`, `total_marks`, `is_timer_enabled`, `created_at`                                                            |
| `assignments`          | Links papers to students (or `'guest'` for all-guest broadcasts). Fields: `id`, `paper_id`, `student_id`, `assigned_at`                                                                                                                                                                 |
| `results`              | Stores student exam submissions. Fields: `id`, `paper_id`, `student_id`, `answers` (JSONB), `score`, `total`, `percentage`, `submitted_at`                                                                                                                                              |
| `materials`            | Study material files (PDFs, etc.). Fields: `id`, `name`, `description`, `category`, `file_name`, `original_name`, `mime_type`, `size_bytes`, `url` (public Supabase Storage URL), `created_at`                                                                                          |
| `material_assignments` | Links materials to students (or `'guest'`). Fields: `id`, `material_id`, `student_id`, `assigned_at`                                                                                                                                                                                    |
| `site_config`          | Single-row table for LMS-wide settings (paper subject, marking scheme, instructions, welcome hint).                                                                                                                                                                                     |
| `dropdowns`            | Stores dropdown option lists by category (e.g. `questionType`, `source`, `examType`, `unit`, `subUnit`).                                                                                                                                                                                |
| `feedback`             | Admin-written feedback per student per activity. Fields: `id`, `activity_id`, `student_id`, `comment`, `score`, `total_marks`, `created_at`, `updated_at`                                                                                                                               |
| `landing_config`       | Single-row CMS config for landing page (site name, tagline, phone, social links, nav links, footer text, LMS button).                                                                                                                                                                   |
| `landing_sections`     | CMS-driven landing page sections in order (`order_index`). Each section has a `type` and content fields (heading, subheading, content, image, CTAs, stats, items, contact info, etc.).                                                                                                  |

**Supabase Storage Buckets:**

- `image-bank` — stores question diagram images (public URLs)
- `material-bank` — stores student material files (public URLs)

---

## API Endpoints (`api/index.js`)

All endpoints are prefixed with `/api`. The Express app is exported as a CommonJS module (`module.exports = app`) for Vercel.

### Authentication

| Method | Path                     | Auth        | Description                                                                |
| ------ | ------------------------ | ----------- | -------------------------------------------------------------------------- |
| `POST` | `/api/auth/login`        | None        | Check admins table first, then students. Returns JWT + user info.          |
| `POST` | `/api/auth/logout`       | None        | Client-side JWT logout (no-op on server, returns success).                 |
| `POST` | `/api/auth/register`     | None        | Guest self-registration. Creates student with `type: 'guest'`, auto-login. |
| `POST` | `/api/auth/update-admin` | JWT (admin) | Change admin username/password (requires current password verification).   |

### Question Bank

| Method   | Path                 | Auth        | Description                                                                                                                                                                 |
| -------- | -------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/questions`     | JWT (any)   | Get all questions ordered by `created_at` desc. Returns camelCase.                                                                                                          |
| `POST`   | `/api/questions`     | JWT (admin) | Create/update a question. Accepts `multipart/form-data` with `questionData` (JSON string) and optional `images` files. Uploads images to `image-bank`, returns public URLs. |
| `DELETE` | `/api/questions/:id` | JWT (admin) | Delete a question by ID.                                                                                                                                                    |

### Generic Data CRUD

| Method | Path                | Auth       | Description                                                                                                                                     |
| ------ | ------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/data/:entity` | None / JWT | Get all records for entity. Sensitive entities (`students`, `results`, `feedback`, `materialAssignments`, `assignments`) require JWT.           |
| `POST` | `/api/data/:entity` | JWT        | Upsert records. **Performs sync-delete**: removes DB rows not present in submitted array. For `students`, hashes plain passwords before saving. |

**Allowed entities:** `students`, `papers`, `assignments`, `results`, `config`, `feedback`, `materials`, `materialAssignments`

### Dropdowns

| Method | Path             | Auth        | Description                                               |
| ------ | ---------------- | ----------- | --------------------------------------------------------- |
| `GET`  | `/api/dropdowns` | None        | Get all dropdown categories as `{ category: options[] }`. |
| `POST` | `/api/dropdowns` | JWT (admin) | Upsert a single dropdown category with its options array. |

### Site Content (Landing Page CMS)

| Method | Path                         | Auth | Description                                                               |
| ------ | ---------------------------- | ---- | ------------------------------------------------------------------------- |
| `GET`  | `/api/site-content/config`   | None | Get landing page config (site name, tagline, socials, nav, footer, etc.). |
| `GET`  | `/api/site-content/sections` | None | Get all landing page sections ordered by `order_index`.                   |

### Materials

| Method   | Path                    | Auth        | Description                                                                                                                                     |
| -------- | ----------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/materials/upload` | JWT (admin) | Upload a file to `material-bank` bucket. Accepts `multipart/form-data` with `file` and `meta` (JSON string). Creates DB record with public URL. |
| `DELETE` | `/api/materials/:id`    | JWT (admin) | Delete material file from storage + DB record + all related `material_assignments`.                                                             |

---

## Frontend Pages & Their JS Files

### Landing Page (`index.html` + `home.js` + `home.css`)

- Dynamically renders all content from `GET /api/site-content/config` and `GET /api/site-content/sections`
- Section types rendered by `home.js`: `hero`, `about`, `features`, `gallery`, `testimonials`, `contact`, `stats`, etc.
- Has a Lightbox for gallery images
- Navbar and footer are also CMS-driven

### Login Page (`login.html`)

- Handles both **Login** and **Guest Registration** flows
- On success, writes session to `sessionStorage` and redirects to `/admin.html` (admin) or `/student.html` (student)

### Admin Dashboard (`admin.html` + `admin.js` + `admin.css`)

Admin dashboard is a multi-tab SPA. Tabs include:

- **Question Bank**: Add, edit, delete, filter questions. Full rich-text question editor with image upload, drag-to-reposition images, KaTeX math preview, option layout control.
- **Papers**: Create/edit exam papers, build paper by picking questions from the bank, set timer, attempts, due date, marks.
- **Students**: Add, edit, delete students. Set type (premium/guest). View individual student results and feedback.
- **Assignments**: Assign/unassign papers to students or all guests.
- **Results**: View all student submissions per paper, see score breakdowns.
- **Feedback**: Write per-student per-activity feedback with score annotation.
- **Materials**: Upload study materials (PDF, etc.), assign to students or guests.
- **Settings**: Update admin credentials, manage LMS config (site config, dropdown options).

### Student Dashboard (`student.html` + `student.js` + `student.css`)

- Displays assigned papers with status (pending/completed)
- Shows submitted results with scores
- Shows feedback written by admin
- Shows assigned study materials (download links)
- "Take Paper" button navigates to `paper.html?id=<paperId>`

### Exam Interface (`paper.html` + `app.js`)

- Renders all questions for the paper using `buildQuestionHTML()` from `shared.js` with `isStudentView: true`
- Runs a countdown timer (if enabled)
- Collects radio button answers
- On submit: calls `DB.saveResult()`, then redirects to student dashboard

### Exam Renderer (`exam-renderer.html`)

- Standalone admin tool (no auth, local only)
- Paste a paper's JSON + question data to render a printable A/L-style exam paper
- Uses `first_page_template.html` and `second_page_template.html` for print layout

---

## Shared Modules

### `public/data.js` — The `DB` Object

The central data layer. All frontend pages import this via `<script src="/data.js">`. Key design:

- `DB._state` — in-memory cache of all entities
- `DB.seed()` — called on page load; fetches all data from backend and populates `_state`
- `DB._saveL(key, val)` — updates `_state` and fires a background `POST /api/data/:key` to persist
- All CRUD methods (e.g. `DB.addQuestion()`, `DB.createPaper()`, `DB.saveResult()`) update local state immediately for snappy UI, then sync to backend

### `public/shared.js` — Question Rendering Engine (Q_Render)

- `buildQuestionHTML(q, options)` — universal question renderer used across admin, student, and paper views
- Supports image zones: `top`, `bottom`, `footer` — each with float-left, float-right, block-left/right/center positioning
- Supports editable mode (drag-to-reposition, resize handle, position/correct-answer dropdowns)
- `renderKaTeX(container)` — triggers KaTeX math rendering after DOM insertion
- `sanitizeHTML()` / `escapeHTML()` — XSS prevention for question text and option text

### `public/auth.js`

- Reads/writes `active_session` from `sessionStorage`
- Provides `getSession()`, `logout()` helpers
- Guards pages against unauthenticated access

---

## Local Development

### Prerequisites

- Node.js ≥ 18
- Vercel CLI (`npm i -g vercel`)
- A Supabase project with the schema from `supabase_schema.sql` applied

### Setup

```bash
git clone https://github.com/premakumarahps/physics-academy.git
cd physics-academy
npm install
```

Create `.env` in project root:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
JWT_SECRET=your-strong-random-secret
```

### Run Dev Server

```bash
vercel dev
```

This emulates the Vercel cloud environment: serves `/public` as static files and routes `/api/*` to `api/index.js`.

### Initialize Database

Run `supabase_schema.sql` in your Supabase SQL editor to create all tables, indexes, and enable RLS.

### Create First Admin

Run `scripts/create_admins.sql` in the Supabase SQL editor (edit with your credentials first), or use `scripts/migrate_admins.js` if migrating from a legacy setup.

---

## Content Management (Landing Page)

Dynamic text on the landing page lives in Supabase (`landing_config` and `landing_sections` tables), not in code. To edit locally and push:

```bash
# Pull live content to local JSON files in cloud-config-sync/content/
node cloud-config-sync/pull_content.js

# Edit the JSON files, then push back to Supabase
node cloud-config-sync/push_content.js
```

---

## Deployment

The project deploys to Vercel automatically. `vercel.json` configures routing:

- `/api/*` → `api/index.js` (Serverless Function)
- `/*` → static files in `/public`

Push to the connected GitHub branch to trigger a deployment.

---

## Security Notes

- **JWT secret** must be set as `JWT_SECRET` in Vercel environment variables.
- **Service Role key** (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS — never expose it to the client.
- All mutation endpoints require a valid JWT. Admin-only actions also check `req.user.role === 'admin'`.
- Student passwords are bcrypt-hashed before storage. The `raw_password` field is a legacy plain-text backup (consider removing for production hardening).
- The `sanitizeHTML()` function in `shared.js` allows only safe HTML tags (`sup`, `sub`, `br`, `strong`, `em`, `b`, `i`, `u`, `span`) in question text to prevent XSS.

---

## Key Conventions & Gotchas

1. **ID format for questions**: `q_01`, `q_02`, ... (sequential, auto-generated by `DB._nextQuestionId()`). The backend uses `upsert` so the same ID always overwrites.
2. **Sync-delete pattern**: `POST /api/data/:entity` with an array replaces the table — rows in DB not present in the submitted array are deleted. This is how client-side deletions (e.g. `DB.deleteStudent()`) propagate to the server.
3. **Guest assignments**: Assigning a paper/material with `studentId = 'guest'` makes it visible to ALL students with `type: 'guest'`. Direct assignments (by specific student ID) are also supported.
4. **Image compression**: Done client-side in `data.js` before upload to stay within Vercel's 4.5MB serverless request limit. Max width 1600px, JPEG quality 0.8.
5. **`config` entity special case**: Unlike other entities (which are arrays), `config` maps to the `site_config` table which has a single row. The API returns it as a plain object, not an array.
6. **KaTeX math**: Question text supports LaTeX math using `$...$` (inline) and `$$...$$` or `\[...\]` (display). Call `renderKaTeX(container)` after inserting question HTML into the DOM.
