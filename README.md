# Financial Planner — Frontend

Web app for the CSCI 475 Team 3 Financial Planner: a budgeting app that imports bank statements, auto-categorizes transactions with AI, tracks budget progress, and answers natural-language questions about spending (e.g., "How much did I spend on coffee this month?").

This repo holds the web frontend, project documentation, and sprint reports. Server-side code lives in the backend repo.

## Related Repositories

| Repo | Contents |
|---|---|
| **Frontend** (this repo) | React web app, project docs, sprint reports |
| [Backend](https://github.com/zsheppard78/csci475---Team-3---Financial-App-backend) | Firebase Cloud Functions (Node.js), Firestore rules, API contract |

The backend's API contract file defines every function's inputs, outputs, and data shapes. The frontend builds against it.

## Tech Stack

- **React** (JavaScript) with **Vite**
- **React Router**: page navigation
- **Firebase**: Auth, Firestore, and Hosting

## Structure

```
src/
  components/     React components (layout, auth, dashboard, consent screen)
  assets/         Images and icons used by the app
  App.jsx         Root component
  main.jsx        Entry point
public/           Static files served as-is
assets/docs/      Project documentation
mobile/           Mobile app (framework not yet finalized)
index.html        App shell
vite.config.js    Build configuration
Sprint-*.md       Sprint Jira and Git reports
```

## Documentation

Design and planning docs are in [`assets/docs`](assets/docs):

- `system-architecture.md`: overall system design
- `data-model.md`: Firestore data structure
- `ui-constraints.md`: UI/UX rules for web and mobile
- `ai-integration-plan.md`: AI categorization and insights plan
- `projectOverviewPresentation.md`: project scope and overview

## Local Setup

Requires [Node.js](https://nodejs.org) (LTS).

```bash
npm install
npm run dev
```

Then open the `Local:` link printed in the terminal (usually http://localhost:5173).

Build for production:

```bash
npm run build
```

## Workflow

All changes go through a branch and pull request with at least one reviewer approval. No direct pushes to `main`.

## Team

- Zach Sheppard
- Tyler Petersen

CSCI 475 / CIS 675: Software Engineering, UW-Parkside, Fall 2026
