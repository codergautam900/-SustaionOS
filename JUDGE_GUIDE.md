# Judge Guide

This guide is for judges who should be able to open the deployed app and understand the product quickly without setting up the project locally.

## Before Opening

Use public deployed URLs only. Do not share admin links such as:

- `https://dashboard.render.com/...`

Those are maintainer pages, not the actual product.

## Demo Access Links

Use these deployed links:

- `Live App`: `https://sustaionos-open-source-sustainability-ygcz.onrender.com`
- `Live API Base`: `https://sustaionos-open-source-sustainability-ip3w.onrender.com`
- `Live API Health`: `https://sustaionos-open-source-sustainability-ip3w.onrender.com/api/health`
- `Live ML Health`: `https://sustaionos-open-source-sustainability-do10.onrender.com/health`
- `Demo Video`: `PASTE_PUBLIC_YOUTUBE_LOOM_OR_DRIVE_LINK_HERE`

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

- Backend health check: `https://sustaionos-open-source-sustainability-ip3w.onrender.com/api/health`
- Backend ready check: `https://sustaionos-open-source-sustainability-ip3w.onrender.com/api/health/ready`
- ML health check: `https://sustaionos-open-source-sustainability-do10.onrender.com/health`

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
