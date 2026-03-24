# Deploying the Frontend to Render

Create a **Static Site** on Render from this repo.

Settings:
- Build command: `npm ci && npm run build`
- Publish directory: `dist`

Notes:
- This uses Expo web export (`expo export -p web`).
- Your app talks to the backend via the **API Base URL** field in the app UI.
