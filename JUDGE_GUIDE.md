# Judge Guide

This guide is for judges who should be able to open the deployed app and understand the product quickly without setting up the project locally.

## Before Opening

Use public deployed URLs only. Do not share admin links such as:

- `https://dashboard.render.com/...`

Those are maintainer pages, not the actual product.

## Demo Access Links

Replace these placeholders before sharing:

- `Live App`: `PASTE_PUBLIC_FRONTEND_URL_HERE`
- `Live API Health`: `PASTE_PUBLIC_BACKEND_URL_HERE/api/health/ready`
- `Live ML Health`: `PASTE_PUBLIC_ML_URL_HERE/health`
- `Demo Video`: `PASTE_YOUR_DEMO_VIDEO_LINK_HERE`

## Fastest Judge Flow

1. Open `Live App`
2. Wait `30 to 60 seconds` if the app is waking up from Render free tier sleep
3. Login with the demo account you provide, or click `Register` to create a new workspace
4. Visit pages in this order: `Dashboard -> Mission Control -> Alerts -> Sensors -> Workspace -> Analytics -> AI Copilot`

## What Judges Should Notice

### Dashboard

Shows the latest telemetry, score context, recent operational activity, and quick entry into Mission Control.

### Mission Control

Shows the strongest product value quickly:

- top hotspot building
- likely issue
- urgency
- savings opportunity
- execution roadmap

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

Shows score, usage trend, executive insights, and model status.

### AI Copilot

Lets judges ask questions like:

- What should I prioritize right now?
- Which building is the riskiest?
- Why is the score low?
- What is the likely cause of current waste?

## Demo Account

Replace this before sharing:

- `Email`: `PASTE_DEMO_EMAIL_HERE`
- `Password`: `PASTE_DEMO_PASSWORD_HERE`

## Optional Health Checks

If you want judges to verify service health directly:

- Backend ready check: `PASTE_PUBLIC_BACKEND_URL_HERE/api/health/ready`
- ML health check: `PASTE_PUBLIC_ML_URL_HERE/health`

Expected result:

- backend returns `200`
- ML service returns `200`

## Cold Start Note

If the live app is sleeping on Render:

1. Open the live app link
2. Wait up to one minute
3. Refresh once
4. Login again if needed

## Local Proof

The repo also includes:

- `hackathon-smoke-test.ps1`
- `full-e2e-demo.ps1`

These are useful for technical validation, but judges should not need them if the public app is live.
