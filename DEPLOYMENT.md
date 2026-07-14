# SustainOS AI Deployment

Recommended hackathon deployment now uses one public Render link:

- `sustainos-api` on Render builds the React/Vite client and serves it from Express.
- The same `sustainos-api` service also exposes all `/api/*` routes and Socket.IO.
- `sustainos-ml` remains a separate Render Python service, called only by the backend.
- MongoDB Atlas remains the database.
- Optional Ollama can still run on your own laptop/PC through a temporary tunnel.

## Architecture

```text
User opens one Render URL
  -> Render Node service: React app + Express API + Socket.IO
      -> Render Python ML service
      -> MongoDB Atlas
      -> optional Ollama tunnel or cloud AI provider
```

The public app URL is the `sustainos-api` Render URL. Users and judges do not need the ML URL.

## Why This Layout Works

- Only one public link is needed for the full app.
- The browser calls `/api/*` on the same origin, so production `VITE_API_URL` is not required.
- Socket.IO connects to the same origin as the frontend.
- The Python ML service stays behind the backend from the user's point of view.
- Render Free services can still cold start after idle time, so the first request can be slow.

## Before You Start

Make sure you have:

1. A GitHub repo with the latest code pushed.
2. A MongoDB Atlas connection string.
3. A Render account.
4. Optional OpenAI or Gemini API key if you want cloud AI responses.
5. Optional Ollama tunnel URL if you want local LLM mode.

## Render Blueprint

This repo includes `render.yaml`. It creates:

- `sustainos-api`: Node service that builds `Client/`, serves `Client/dist`, and runs the API.
- `sustainos-ml`: Python ML service used by the backend.

The important one-link commands are:

```yaml
buildCommand: npm --prefix server ci && npm --prefix Client ci --include=dev && npm --prefix Client run build
startCommand: npm --prefix server start
```

## Environment Variables

Set these on `sustainos-api` when Render asks for Blueprint secrets:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=auto_generated_by_render_or_your_secret
AI_PROVIDER=ollama
OLLAMA_URL=https://your-random-subdomain.trycloudflare.com/api/chat
OPENAI_API_KEY=
GEMINI_API_KEY=
```

Notes:

- `CLIENT_ORIGIN` is not required for the single Render URL because same-origin requests are allowed automatically.
- Add comma-separated values to `CLIENT_ORIGIN` only if you also deploy a separate frontend elsewhere.
- `ML_SERVICE_URL` is automatically wired by `render.yaml` from the `sustainos-ml` service.
- If you do not use Ollama, set `AI_PROVIDER=auto` and provide `OPENAI_API_KEY` or `GEMINI_API_KEY` if desired.

The Python service uses Render's platform `PORT` automatically. No user-facing ML configuration is needed.

## Deploy Steps

1. Push the repo to GitHub.
2. Open Render Dashboard.
3. Click `New` -> `Blueprint`.
4. Select the GitHub repo.
5. Render detects `render.yaml`.
6. Create the Blueprint.
7. Fill `MONGO_URI` and any optional AI secrets.
8. Deploy both services.
9. Open the public URL for `sustainos-api`.

That `sustainos-api` URL is now the only link you share.

## Public URLs After Deploy

Use these checks:

```text
https://your-sustainos-api.onrender.com
https://your-sustainos-api.onrender.com/api/health
https://your-sustainos-ml.onrender.com/health
```

Share only the first URL with users or judges. The health URLs are for debugging.

## Optional Vercel Frontend

You can still deploy `Client/` separately on Vercel, but it is no longer required for the one-link setup.

If you use Vercel, set:

```env
VITE_API_URL=https://your-sustainos-api.onrender.com
VITE_SOCKET_URL=https://your-sustainos-api.onrender.com
```

Then add the Vercel domain to `CLIENT_ORIGIN` on Render.

## Free Ollama Mode

If you want local LLM behavior without paying:

1. Run Ollama on your Windows laptop/PC.
2. Expose it with a temporary Cloudflare tunnel.
3. Set `OLLAMA_URL` on Render to that tunnel URL plus `/api/chat`.

```powershell
ollama pull llama3.2:1b
ollama serve
cloudflared tunnel --url http://localhost:11434
```

Then set:

```env
AI_PROVIDER=ollama
OLLAMA_URL=https://random-name.trycloudflare.com/api/chat
OLLAMA_MODEL=llama3.2:1b
```

Cloudflare Quick Tunnel URLs change when restarted, so update `OLLAMA_URL` and redeploy before demos.

## Post-Deploy Smoke Test

After deploy, verify:

1. The app URL opens the React UI.
2. `/api/health` returns backend health.
3. ML `/health` returns `status: "ok"`.
4. Login/register works.
5. Dashboard loads.
6. AI widget opens.
7. Reports and Settings load.

You can also run:

```powershell
.\hackathon-smoke-test.ps1 `
  -FrontendUrl "https://your-sustainos-api.onrender.com" `
  -BackendUrl "https://your-sustainos-api.onrender.com" `
  -MlUrl "https://your-sustainos-ml.onrender.com"
```

## If Something Breaks

Check these first:

1. `MONGO_URI` is valid and Atlas allows Render connections.
2. Backend `/api/health` responds.
3. ML `/health` responds.
4. `ML_SERVICE_URL` is present on `sustainos-api` from Blueprint wiring.
5. `OLLAMA_URL` points to a live tunnel if using Ollama.
6. The first Render Free request may be slow because free services spin down after idle time.

## Official References

- Render Blueprint Spec: https://render.com/docs/blueprint-spec
- Render Native Runtimes: https://render.com/docs/native-runtimes
- Render Free limitations: https://render.com/docs/free
- Render Persistent Disks: https://render.com/docs/disks
- Vercel project config: https://vercel.com/docs/project-configuration/vercel-json
- Cloudflare Tunnel: https://developers.cloudflare.com/tunnel/
- Cloudflare Quick Tunnels: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/
