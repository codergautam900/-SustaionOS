# SustainOS AI Deployment

This project is best deployed as:

- `Client/` on Vercel
- `server/` on Render as a Node web service
- `ml_service/` on Render as a Python web service
- MongoDB on MongoDB Atlas

## Architecture

```text
Vercel (React/Vite frontend)
  -> Render Node API (Express + Socket.IO)
      -> Render Python ML service
      -> MongoDB Atlas
```

## Why this split

- Vercel is a strong fit for the React/Vite frontend.
- Render handles long-running Node and Python services more naturally than Vercel.
- MongoDB Atlas is required because the backend uses Mongoose and Render does not provide managed MongoDB in this repo setup.

## 1. MongoDB Atlas

Create a MongoDB Atlas cluster and copy the connection string.

You will need:

- `MONGO_URI`

## 2. Render backend + ML

This repo includes a `render.yaml` Blueprint that creates:

- `sustainos-api`
- `sustainos-ml`

### Render steps

1. Push this repo to GitHub.
2. Open Render Dashboard.
3. Click `New` -> `Blueprint`.
4. Connect the GitHub repo.
5. Render will detect [`render.yaml`](C:/Users/Dell/OneDrive/Desktop/SustainOS Ai/render.yaml).
6. During setup, provide secret values for:
   - `MONGO_URI`
   - `CLIENT_ORIGIN`
   - `OPENAI_API_KEY` if you want OpenAI
   - `GEMINI_API_KEY` if you want Gemini
7. Deploy the Blueprint.

### Important backend env values

- `CLIENT_ORIGIN` should be your final Vercel frontend URL
- `ML_SERVICE_URL` is wired automatically from the ML service inside Render
- `AI_PROVIDER=auto` means:
  - use Ollama if reachable
  - otherwise use cloud AI if configured
  - otherwise local fallback

### Render service URLs

After deploy, note your backend public URL, for example:

```text
https://sustainos-api.onrender.com
```

## 3. Vercel frontend

Deploy the `Client/` directory as the Vercel project root.

This repo includes [`Client/vercel.json`](C:/Users/Dell/OneDrive/Desktop/SustainOS Ai/Client/vercel.json) for SPA routing, so React Router refreshes work correctly.

### Vercel steps

1. Open Vercel Dashboard.
2. Click `Add New` -> `Project`.
3. Import the same GitHub repo.
4. Set `Root Directory` to `Client`.
5. Confirm framework as `Vite`.
6. Add environment variables:
   - `VITE_API_URL=https://your-render-backend-url`
   - `VITE_SOCKET_URL=https://your-render-backend-url`
7. Deploy.

### Example

```env
VITE_API_URL=https://sustainos-api.onrender.com
VITE_SOCKET_URL=https://sustainos-api.onrender.com
```

## 4. Final wiring

After Vercel gives you the frontend URL:

1. Copy the Vercel production domain
2. Open Render
3. Update `CLIENT_ORIGIN` on the `sustainos-api` service
4. Redeploy backend if needed

Example:

```env
CLIENT_ORIGIN=https://sustainos-ai.vercel.app
```

## Will advanced AI work after deploy?

Yes, with these conditions:

- MongoDB Atlas must be connected
- Render backend must be live
- Render Python ML service must be live
- Browser must run over HTTPS for voice features

### Behavior by provider

- If `OPENAI_API_KEY` is set, cloud-enhanced AI can work
- If `GEMINI_API_KEY` is set, Gemini-enhanced AI can work
- If neither is set, the app still works using the built-in local/fallback logic
- Ollama will not be available on normal Vercel + Render free setup unless you host it yourself on a separate machine or GPU-capable server

## Voice and live demo notes

- Microphone and speech synthesis rely on browser APIs, so demo over HTTPS only
- Vercel and Render both serve HTTPS by default
- Socket.IO should point to the same Render backend URL as `VITE_SOCKET_URL`

## Recommended hackathon setup

For the most reliable live demo:

- Frontend on Vercel
- Backend on Render
- Python ML on Render
- MongoDB Atlas
- `AI_PROVIDER=auto`
- Add `OPENAI_API_KEY` or `GEMINI_API_KEY` if you want stronger cloud AI responses

## What is not fully automatic yet

- You still need to create the Vercel and Render projects in their dashboards
- You still need to add MongoDB Atlas credentials
- You still need to paste the final Vercel URL into Render as `CLIENT_ORIGIN`

## Optional next step

If you want, the next best improvement is adding Docker-based deploys so backend and ML can also run together on one VM or one container platform.
