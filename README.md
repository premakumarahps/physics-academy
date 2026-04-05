# AL Physics Academy – LMS Platform

Welcome to the **AL Physics Academy Learning Management System**. This project is a modern, serverless web application designed to host responsive assessments, store student metrics, and deliver beautiful interactive web pages for Physics examination preperation.

## 🏗️ Architecture

This repository operates on a strict **Serverless Separation of Concerns** model running via Vercel.

*   `public/`: **The Frontend Engine.** Contains all raw HTML, Vanilla CSS, and JavaScript interactions. Vercel acts as a global Content Delivery Network (CDN) and caches this directory instantly.
*   `api/`: **The Backend API.** A secure, serverless Node.js Express router (`index.js`). It intercepts all client traffic, performs JWT authentication checks, and standardizes data languages.
*   **Supabase PostgreSQL**: The external cloud database. All backend code uses the Service Role key to bypass Row-Level Security, processing requests with high authority.

### Development Note on Architecture
The Supabase database technically natively utilizes `snake_case` (e.g. `exam_type`), but the Javascript frontend utilizes `camelCase` (e.g. `examType`). **Do not manually rewrite keys in the client**. The `api/index.js` file handles all translations automatically via the `mapKeys()` bridge function. 

## 🔌 Setup & Local Development

1. **Clone & Install**
   ```bash
   git clone https://github.com/premakumarahps/physics-academy.git
   cd physics-academy
   npm install
   ```

2. **Connect to Supabase**
   Add your `.env` file to the root of the project with the following keys. 
   *(Do not commit this file! It is naturally ignored by `.gitignore`)*
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=ey...
   ```

3. **Start the Development Server**
   To perfectly emulate the Vercel cloud environment locally:
   ```bash
   vercel dev
   ```
   *This automatically hosts the `/public` files while simultaneously routing backend traffic to `/api`.*

## ☁️ Content Management (`cloud-config-sync/`)

While Source Code lives in GitHub, dynamic text content (like Landing Page Paragraphs) lives inside Supabase tables so that non-developers can easily change website verbiage.

If you ever wish to aggressively redesign the text locally, utilize the `cloud-config-sync` tools:
*   `node cloud-config-sync/pull_content.js`: Fetches the live configuration data and converts them to local JSON documents for easy manipulation.
*   `node cloud-config-sync/push_content.js`: Re-uploads the manipulated local JSON documents back into the Supabase pipeline, deploying the changes instantly.
