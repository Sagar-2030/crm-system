# Vercel Deployment

This repository keeps the existing React/Vite frontend and Express/Mongoose API as two Vercel services in one project. The `backend` Express service receives `/api/*`; the `frontend` Vite service receives all other paths and serves the SPA fallback. MongoDB Atlas is the persistent database. The Express app can still run locally with `npm start`.

## 1. Prepare the repository on GitHub

1. Create a private GitHub repository and push this project, including `api/`, `backend/`, `frontend/`, `vercel.json`, and this guide.
2. Confirm `.env` files and `node_modules` are not committed. `.gitignore` excludes `.env`, dependencies, and build output. Commit only the `.env.example` templates.
3. Do not publish demo users or the seeded demo password in a real CRM. If demo data was seeded into a production database, change or remove those accounts before opening the app to users.

## 2. Configure MongoDB Atlas

1. Create an Atlas cluster and a dedicated database user with access only to the CRM database.
2. Configure Atlas Network Access for your deployment. Vercel functions do not have a fixed outbound IP on standard plans; use the network policy appropriate for your Atlas plan and security requirements (often `0.0.0.0/0` with strong database credentials and TLS), or use a deployment/network plan with fixed egress IPs.
3. Copy the Atlas connection string, replace its placeholders, and include the intended database name. URL-encode special characters in the username and password.
4. Keep backups enabled for production data. Never put the URI in frontend variables or source control.

### Create the first administrator

The current CRM has sign-in and administrator-managed user creation, but no public self-registration route. To bootstrap a new, empty production database, run the existing seed script once from a trusted machine with `MONGODB_URI`, `SEED_ADMIN_PASSWORD`, and `SEED_DEMO_PASSWORD` set securely. Set the two seed passwords to separate unique values of at least 16 characters. **The seed script deletes existing users, leads, contacts, tasks, and activities before loading sample data. Never run it against a database containing data you need.** Sign in with the administrator username `admin` and the password you supplied, change it in Settings, and remove the sample accounts and records before inviting real users. Do not leave the demo accounts active.

## 3. Import into Vercel

1. In Vercel, choose **Add New → Project**, connect GitHub, and import the repository.
2. Keep the project root at the repository root. Set the Vercel project framework to **Services** (if enabled for your account); Vercel requires this project framework together with the `services` key to build services mode.
3. `vercel.json` defines independent Express and Vite builds, exposes `/api/*` to the backend, routes other paths to the frontend, and provides the frontend SPA fallback. Backend packages install from `backend/package-lock.json`; frontend packages install from `frontend/package-lock.json`. The backend Express entrypoint is `backend/server.js` and its function duration is capped at 30 seconds.
4. There are no service bindings: browser API calls use the public same-origin `/api` path, and the backend connects to MongoDB Atlas directly. A binding is only needed for server-side calls from one Vercel service to another.

## 4. Set environment variables

Add these variables in Vercel **Project → Settings → Environment Variables** for Production (and Preview if desired):

| Variable | Required | Value |
| --- | --- | --- |
| `MONGODB_URI` | Yes | Atlas connection string with database name |
| `JWT_SECRET` | Yes | Random secret of at least 32 characters; generate a separate value per environment |
| `JWT_EXPIRES_IN` | No | Token lifetime; defaults to `8h` |
| `CLIENT_ORIGIN` | No, same-origin deployment | Comma-separated exact HTTPS origins allowed to call the API from browsers; use your production and preview origins as needed |
| `NODE_ENV` | Set by Vercel | Vercel sets `production` for production deployments |
| `MONGODB_MAX_POOL_SIZE` | No | Optional connection pool cap; defaults to `10` |
| `VITE_API_URL` | No, same project | Leave unset/empty to call the same-project `/api`; for a separately hosted API use its public HTTPS URL ending in `/api` |

Only `VITE_*` values are embedded into browser assets. Never use a `VITE_` prefix for a credential or secret. The frontend `.env.example` documents the optional API URL. Backend values are in `backend/.env.example`.

After changing environment variables, redeploy so both the function and frontend build receive the updated values. If using a separate API host, configure its `CLIENT_ORIGIN` allowlist and set the Vercel frontend's `VITE_API_URL` to that host.

## 5. Deploy

1. Deploy the project from the Vercel dashboard or push to the connected branch.
2. Wait for both service builds to complete. Review build and function logs for missing environment variables or dependency errors.
3. Open the deployment URL over HTTPS. Add the production hostname to `CLIENT_ORIGIN` only when cross-origin access is needed; a same-project `/api` call does not need CORS.
4. Use a controlled admin account to create users and verify account roles. Do not use the sample admin credentials on a public deployment.

## 6. Production verification

The deployment is not considered verified until its actual URL and database have been checked. On the deployed URL:

1. Open `/api/health` and confirm it returns `{"status":"ok"}` (this endpoint also waits for a successful database connection).
2. Sign in with the provisioned administrator account; confirm invalid credentials are rejected and protected requests without a token return `401`.
3. Sign in as an administrator and exercise the dashboard, customers (create/edit/delete), leads, pipeline stage changes, tasks, reports, and user/role protections.
4. Refresh `/leads`, `/contacts`, `/pipeline`, `/reports`, and a lead/contact detail URL directly. Confirm the SPA loads and API requests still go to `/api`.
5. Check the deployed app at desktop and phone widths, and inspect Vercel function logs after API requests.

No production URL is verified merely by a successful local build.

## 7. Local checks before deployment

From the repository root, run:

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm --prefix frontend run build
```

For local API use, copy `backend/.env.example` to `backend/.env`, set `MONGODB_URI` and `JWT_SECRET`, then run `npm --prefix backend start`. The Vite dev server proxies `/api` to `http://localhost:5000` by default. Set `VITE_DEV_API_PROXY` to override that local target. Do not use local environment values in Vercel unless intentionally configured.

## Troubleshooting

- **Function returns 500:** Check Vercel function logs and confirm `MONGODB_URI` and `JWT_SECRET` are present in the deployment environment. The API intentionally returns a generic error body for server failures.
- **MongoDB selection timeout:** Verify Atlas database user/password, database name, URL encoding, cluster availability, and Network Access rules. Vercel serverless outbound IPs may not be fixed.
- **CORS error:** Same-project hosting should use the default `/api` URL. For a separate API, add the exact frontend origin (scheme and hostname, no path) to `CLIENT_ORIGIN`, and set `VITE_API_URL` to the API's HTTPS `/api` base URL.
- **API 404:** Confirm the project framework is **Services**, the top-level `/api/(.*)` rewrite targets `backend`, and the Express routes continue to use the `/api` prefix.
- **Refresh returns 404:** Confirm the project root is the repository root and `vercel.json` is present; redeploy after correcting project settings.
- **Stale or invalid login:** Check `JWT_SECRET` is stable between invocations and that the user is active. Changing the secret invalidates all existing tokens.
- **Build fails:** Review Vercel build logs and run the local checks above with Node.js 18 or newer. Ensure Vercel uses the repository root and the lockfiles are committed.
