# Budgetly — Web (Customer)

The customer-facing web app for Budgetly, a budgeting app that imports bank statements, auto-categorizes transactions with AI, tracks budget progress, and answers natural-language questions about spending.

## Budgetly Repositories

| Repo | Contents |
|---|---|
| **budgetly_web_customer** (this repo) | Customer-facing React web app |
| [budgetly_web_dash](https://github.com/zsheppard78/budgetly_web_dash) | Dashboard web app |
| [budgetly_backend_nodejs](https://github.com/zsheppard78/budgetly_backend_nodejs) | Firebase Cloud Functions (Node.js), Firestore rules |
| [budgetly_contracts](https://github.com/zsheppard78/budgetly_contracts) | Interfaces: data schemas, API definitions, AI interface |
| [budgetly_assets](https://github.com/zsheppard78/budgetly_assets) | Docs, images, reports |

This app builds against the interfaces in **budgetly_contracts**. Any change to data shapes or API calls starts there.

## Tech Stack

- **React** (JavaScript) with **Vite**
- **Tailwind CSS**
- **Firebase**: Auth, Firestore, Hosting

## Structure

```
src/
  components/     React components (layout, auth, dashboard, consent screen)
  App.jsx         Root component
  main.jsx        Entry point
  index.css       Global styles
public/           Static files served as-is
index.html        App shell
vite.config.js    Build configuration
```

Sprint 1 reports are kept at the repo root. Reports from Sprint 2 onward live in **budgetly_assets**.

## Local Setup

Requires [Node.js](https://nodejs.org) (LTS).

```bash
npm install
npm run dev
```

Open the `Local:` link printed in the terminal (usually http://localhost:5173).

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