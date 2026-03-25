# SustainOS AI Deployment

Best hackathon deployment split:

- `Client/` on Vercel
- `server/` on Render as a Node web service
- `ml_service/` on Render as a Python web service
- MongoDB Atlas as the database
- Ollama on your own laptop/PC, exposed temporarily with a free tunnel during the demo

## Architecture

```text
Vercel (React/Vite frontend)
  -> Render Node API (Express + Socket.IO)
      -> Render Python ML service
      -> MongoDB Atlas
      -> Ollama running on your own machine through a tunnel
```

## Why this split works well

- Vercel is a good fit for the React/Vite frontend.
- Render handles long-running Node and Python services more naturally than Vercel.
- MongoDB Atlas is the simplest stable option for the backend database.
- Voice features work over HTTPS once Vercel and Render are live.
- Truly free hosted Ollama is not realistic on Vercel + Render because:
  - Vercel Functions are not meant to run a local model server
  - Render Free web services spin down and do not support persistent disks

This last point is based on the official docs:

- Render Free web services spin down after 15 minutes idle and lose local files on restart:
  https://render.com/docs/free
- Render persistent disks are available only for paid services:
  https://render.com/docs/disks
- Vercel Functions have runtime limits and are not a fit for running Ollama itself:
  https://vercel.com/docs/functions/limitations

## Before you start

Make sure you have:

1. A GitHub repo with the latest code pushed
2. A MongoDB Atlas connection string
3. A Vercel account
4. A Render account
5. Optional OpenAI or Gemini API key if you want stronger cloud AI responses

## Environment Variables

### Vercel frontend

Set these in the Vercel project for `Client/`:

```env
VITE_API_URL=https://your-render-backend-url.onrender.com
VITE_SOCKET_URL=https://your-render-backend-url.onrender.com
```

### Render backend

Set these on the `sustainos-api` service:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret
CLIENT_ORIGIN=https://your-vercel-app.vercel.app
AI_PROVIDER=ollama
OLLAMA_URL=https://your-random-subdomain.trycloudflare.com/api/chat
OPENAI_API_KEY=
GEMINI_API_KEY=
```

Notes:

- `CLIENT_ORIGIN` can contain multiple comma-separated origins during testing.
- Example:
  `CLIENT_ORIGIN=http://localhost:5173,https://your-vercel-app.vercel.app`
- `ML_SERVICE_URL` is automatically wired by `render.yaml`
- If your hackathon rules forbid external AI APIs, keep `OPENAI_API_KEY` and `GEMINI_API_KEY` empty
- Self-hosted Ollama is still okay because the model runs on your own machine
- Leave `OPENAI_API_KEY` and `GEMINI_API_KEY` empty in that case
- `OLLAMA_URL` should point to your self-hosted Ollama endpoint

### Render ML service

The Python service already reads:

```env
HOST=0.0.0.0
PORT=8000
```

On Render, the platform sets `PORT` automatically.

## Render Deployment

This repo already includes [render.yaml](C:/Users/Dell/OneDrive/Desktop/SustainOS Ai/render.yaml).

### Render steps

1. Push the repo to GitHub.
2. Open Render Dashboard.
3. Click `New` -> `Blueprint`.
4. Select the GitHub repo.
5. Render will detect [render.yaml](C:/Users/Dell/OneDrive/Desktop/SustainOS Ai/render.yaml).
6. Create the Blueprint.
7. Fill the required secrets:
   - `MONGO_URI`
   - `CLIENT_ORIGIN`
   - optional `OPENAI_API_KEY`
   - optional `GEMINI_API_KEY`
8. Deploy.

### Render services created

- `sustainos-api`
- `sustainos-ml`

### Important behavior

- `sustainos-api` health check: `/api/health`
- `sustainos-ml` health check: `/health`
- If MongoDB is unavailable, the API starts in degraded mode
- If the Python ML service is unavailable, several backend flows fall back to built-in JS logic

## Vercel Deployment

This repo already includes [Client/vercel.json](C:/Users/Dell/OneDrive/Desktop/SustainOS Ai/Client/vercel.json) for SPA routing.

### Vercel steps

1. Open Vercel Dashboard.
2. Click `Add New` -> `Project`.
3. Import the same GitHub repo.
4. Set `Root Directory` to `Client`.
5. Confirm framework as `Vite`.
6. Add environment variables:
   - `VITE_API_URL=https://your-render-backend-url.onrender.com`
   - `VITE_SOCKET_URL=https://your-render-backend-url.onrender.com`
7. Deploy.

## Final Wiring Order

Use this order to avoid CORS mistakes:

1. Deploy MongoDB Atlas first
2. Deploy Render Blueprint second
3. Copy the backend public URL from Render
4. Deploy Vercel frontend using that backend URL
5. Copy the final Vercel production URL
6. Update `CLIENT_ORIGIN` on Render backend
7. Redeploy the backend once

## Demo-Day Recommendation

For the safest hackathon demo:

- Keep `AI_PROVIDER=ollama`
- Leave `OPENAI_API_KEY` and `GEMINI_API_KEY` empty if cloud AI is not allowed
- Run Ollama on your own laptop/PC
- Expose Ollama to the internet with a temporary free tunnel
- Test voice features in Chrome over HTTPS
- Use the same backend URL for both `VITE_API_URL` and `VITE_SOCKET_URL`

## What Works After Deploy

When frontend, backend, MongoDB, and ML are connected correctly, these should keep working:

- Auth
- Dashboard
- Alerts
- Reports
- Settings
- Profile
- Socket.IO updates
- Python ML forecast and profile parsing
- AI assistant through your self-hosted Ollama endpoint

## Free Ollama Mode

If you want real LLM-style assistant behavior without paying:

1. Deploy frontend on Vercel
2. Deploy backend + ML on Render Free
3. Run Ollama on your own Windows laptop/PC
4. Expose Ollama with a free tunnel
5. Point `OLLAMA_URL` on Render to that tunnel URL

This is an inference from the official docs and your architecture:

- It is suitable for a hackathon demo
- It is not a production-grade permanent deployment

### Ollama steps on your own machine

Install Ollama and run:

```powershell
ollama pull llama3.2:1b
ollama serve
```

Your local Ollama API will be:

```text
http://localhost:11434/api/chat
```

### Free tunnel option

Cloudflare Quick Tunnels can expose localhost to a public URL for testing:

```powershell
cloudflared tunnel --url http://localhost:11434
```

Cloudflare docs:

- Quick Tunnels:
  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/
- Tunnel overview:
  https://developers.cloudflare.com/tunnel/

This command gives you a public URL like:

```text
https://random-name.trycloudflare.com
```

Then set Render backend env:

```env
AI_PROVIDER=ollama
OLLAMA_URL=https://random-name.trycloudflare.com/api/chat
OLLAMA_MODEL=llama3.2:1b
```

### Important tunnel limitation

Cloudflare Quick Tunnels are meant for testing, not production, and the URL changes when you restart them.

For a hackathon demo, this usually means:

1. Start Ollama on your laptop
2. Start the tunnel
3. Copy the new tunnel URL
4. Update `OLLAMA_URL` on Render
5. Redeploy backend once

### Demo-day checklist for Ollama

Before presenting:

1. Keep your laptop plugged in
2. Disable sleep mode
3. Start `ollama serve`
4. Start `cloudflared tunnel --url http://localhost:11434`
5. Confirm the tunnel URL opens
6. Make sure Render backend has the latest `OLLAMA_URL`
7. Ask the assistant one test question before the judges arrive

## No Cloud AI APIs

If hackathon rules forbid OpenAI and Gemini:

- Keep `OPENAI_API_KEY` empty
- Keep `GEMINI_API_KEY` empty
- Use self-hosted Ollama plus your own Python ML service

In this mode:

- The assistant still feels like an LLM because Ollama handles chat
- Forecasting and anomaly features still work through your Python ML service
- Profile voice parsing still works through your Python ML service
- The project remains mostly free, with the only tradeoff being that your laptop must stay online during the demo

## What Needs Extra Attention

- Ollama is not part of a normal Vercel + Render free deployment by default
- Browser microphone access needs HTTPS
- First Render cold start can be slow on free plans
- MongoDB Atlas IP/access config must allow Render to connect

## Post-Deploy Smoke Test

After deploy, verify these URLs:

### Backend

```text
https://your-render-backend-url.onrender.com/api/health
```

Expected:

- `success: true`
- `server: "up"`

### ML service

```text
https://your-render-ml-url.onrender.com/health
```

Expected:

- `status: "ok"`
- `service: "python-ml"`

### Frontend

Open the Vercel app and verify:

1. Login works
2. Dashboard loads
3. AI widget opens
4. Settings page opens
5. Reports page loads

## Included Helper

You can also use [hackathon-smoke-test.ps1](C:/Users/Dell/OneDrive/Desktop/SustainOS Ai/hackathon-smoke-test.ps1) after deploy:

```powershell
.\hackathon-smoke-test.ps1 `
  -FrontendUrl "https://your-frontend.vercel.app" `
  -BackendUrl "https://your-api.onrender.com" `
  -MlUrl "https://your-ml.onrender.com"
```

## If something breaks

Check these first:

1. `CLIENT_ORIGIN` matches the final Vercel domain
2. `VITE_API_URL` points to the Render backend, not the frontend
3. `VITE_SOCKET_URL` matches the backend URL
4. `MONGO_URI` is valid
5. Backend `/api/health` returns success
6. ML `/health` returns ok
7. `OLLAMA_URL` points to a live tunnel URL

## Official References

These docs were used to align the deployment flow:

- Render Blueprint Spec: https://render.com/docs/blueprint-spec
- Render Native Runtimes: https://render.com/docs/native-runtimes
- Render Free limitations: https://render.com/docs/free
- Render Persistent Disks: https://render.com/docs/disks
- Vercel `vercel.json`: https://vercel.com/docs/project-configuration/vercel-json
- Vercel Monorepos / Root Directory: https://vercel.com/docs/monorepos
- Vercel Functions limitations: https://vercel.com/docs/functions/limitations
- Cloudflare Tunnel: https://developers.cloudflare.com/tunnel/
- Cloudflare Quick Tunnels: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/
