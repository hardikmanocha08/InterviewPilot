This is a [Next.js](https://nextjs.org) full-stack experience: the client lives under `src/app`, and the server API is now implemented inside `src/app/api` so the same project can deploy to platforms such as Vercel without a separate backend build.

## Getting started

```bash
npm install
npm run dev
```

- Visit [http://localhost:3000](http://localhost:3000) to see the app.
- The API sits under `/api` (`src/app/api/...`) and mirrors the previous `backend` routes.
- If you really need to talk to a remote API instead, set `NEXT_PUBLIC_API_URL` (include `/api` in that URL) and the client will redirect there.

### Required environment variables

Create a `.env.local` file (this repo already ignores `.env*`) and add:

| Name | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign user tokens |
| `NVIDIA_NIM_API_KEY` | API key for NVIDIA NIM |
| `NVIDIA_NIM_BASE_URL` *(optional)* | NIM base URL (defaults to `https://integrate.api.nvidia.com/v1`) |
| `NVIDIA_NIM_MODEL` *(optional)* | NIM model id (defaults to `meta/llama-3.1-70b-instruct`) |
| `NVIDIA_NIM_STT_MODEL` *(optional)* | NIM speech-to-text model id (defaults to `openai/whisper-large-v3`) |
| `NVIDIA_NIM_STT_LANGUAGE` *(optional)* | Language hint for transcription (example: `en`) |
| `NVIDIA_API_KEY` *(legacy fallback)* | Backward-compatible fallback if `NVIDIA_NIM_API_KEY` is not set |
| `GOOGLE_CLIENT_ID` | Google OAuth client id used by server-side token validation |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client id used by browser sign-in button |
| `NEXT_PUBLIC_API_URL` *(optional)* | Override the default `/api` base (useful for testing against a different backend) |

## Project layout

- `src/app`: Next.js routes (UI + API routes).
- `src/lib/api.ts`: Axios client that defaults to `/api` and injects the auth token.
- `src/lib/server`: Shared server helpers (Mongo connection, models, JWT helpers, AI utilities).

## Deploying on Vercel

1. Import the repository into Vercel and confirm the Framework Preset is **Next.js** (Vercel auto-detects it).
2. Add the environment variables from above through the Vercel dashboard.
3. In Google Cloud Console OAuth settings, add your Vercel domain to:
   - Authorized JavaScript origins (example: `https://your-app.vercel.app`)
   - Authorized redirect URIs (example: `https://your-app.vercel.app`)
4. Vercel runs `npm run build` and `npm run start` automatically; no extra configuration required.

If you prefer maintaining an independent backend, point `NEXT_PUBLIC_API_URL` at that service (remember to include the `/api` suffix) and the client will target it instead of the built-in handlers.
