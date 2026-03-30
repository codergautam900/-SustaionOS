# Judge Guide

This guide is written for judges who should be able to open the deployed app and understand the product quickly without setting up the project locally.

## Important First Note

The links below must be the public deployed application URLs, not Render dashboard links.

Do not send judges links like:

- `https://dashboard.render.com/...`

Those are admin and service-management pages, not the actual product.

## Demo Access Links

Replace these placeholders with your public deployed URLs before sharing:

- `Live App`: `PASTE_PUBLIC_FRONTEND_URL_HERE`
- `Live API Health`: `PASTE_PUBLIC_BACKEND_URL_HERE/api/health/ready`
- `Live ML Health`: `PASTE_PUBLIC_ML_URL_HERE/health`
- `Demo Video`: `PASTE_YOUR_DEMO_VIDEO_LINK_HERE`

Currently shared links:

- `Frontend Render Dashboard`: `https://dashboard.render.com/static/srv-d71tiqm3jp1c739ijndg`
- `Backend Render Dashboard`: `https://dashboard.render.com/web/srv-d71td6v5gffc73839o7g`
- `ML Render Dashboard`: `https://dashboard.render.com/web/srv-d71u7nlm5p6s73a1od60`

## Current Provided Render Links

These are the links currently available for this project:

- `Frontend Render Dashboard`: `https://dashboard.render.com/static/srv-d71tiqm3jp1c739ijndg`
- `Backend Render Dashboard`: `https://dashboard.render.com/web/srv-d71td6v5gffc73839o7g`
- `ML Render Dashboard`: `https://dashboard.render.com/web/srv-d71u7nlm5p6s73a1od60`

Important:

- These are Render dashboard and service-management links.
- They are useful for maintainers, not as direct judge-facing product links.
- Before submission, replace the `Live App`, `Live API Health`, and `Live ML Health` placeholders above with the public deployed URLs.

## Fastest Judge Flow

1. Open `Live App`
2. Wait `30 to 60 seconds` if the app is waking up from Render free tier sleep
3. Login with the demo account you provide, or click `Register` to create a new workspace
4. Follow this page order:
   1. Dashboard
   2. Recommendations / Mission Control
   3. Alerts
   4. Sensors
   5. Workspace
   6. Analytics
   7. AI Copilot

## What Judges Should See

### Dashboard

Shows the latest telemetry, score context, recent operational activity, and quick entry into Mission Control.

### Recommendations / Mission Control

Shows:

- top hotspot building
- likely issue
- urgency
- savings opportunity
- execution roadmap

This is the strongest product page for understanding the business value.

### Alerts

Shows anomaly-driven issues, operational pressure, and incident-like action states.

### Sensors

Shows sensor health, low battery, weak signal, and telemetry reliability.

### Workspace

Shows the SaaS layer:

- workspace profile
- team invites
- API keys
- plan controls
- audit logs

### Analytics

Shows:

- score
- usage trend
- executive insights
- model status

### AI Copilot

Lets the judge ask questions like:

- What should I prioritize right now?
- Which building is the riskiest?
- Why is the score low?
- What is the likely cause of current waste?

## Judge Notes

- If the first request feels slow, the service may be waking from sleep on Render.
- If login works but data is sparse, use the seeded demo account you prepared.
- Mission Control and Alerts are the best pages to understand impact quickly.
- Workspace proves this is a SaaS product, not just a dashboard UI.

## Suggested Demo Account

Replace this before sharing:

- `Email`: `PASTE_DEMO_EMAIL_HERE`
- `Password`: `PASTE_DEMO_PASSWORD_HERE`

If you want judges to avoid creating a new account, always provide this demo login.

## If You Also Want Judges To Verify Service Health

Optional links:

- Backend ready check: `PASTE_PUBLIC_BACKEND_URL_HERE/api/health/ready`
- ML health check: `PASTE_PUBLIC_ML_URL_HERE/health`

Expected:

- backend returns `200`
- ML service returns `200`

## Fallback If The Live App Is Sleeping

Tell judges:

1. Open the live app link
2. Wait up to one minute
3. Refresh once
4. Login again if needed

This avoids confusion on cold starts.

## If You Want To Show Local Proof As Well

The repo also includes:

- `hackathon-smoke-test.ps1`
- `full-e2e-demo.ps1`

These are for technical validation, but judges should not need them if the public app is live.
