# System Architecture — Financial Planner App

## Overview
The app has three main parts: a web client, a mobile client, and a shared backend built on Firebase.

## Stack

| Layer | Choice |
|---|---|
| Web frontend | React |
| Mobile frontend | TBD (Flutter or React Native) |
| Backend | Firebase (Auth, Firestore, Cloud Functions, Hosting) |
| AI processing | Firebase Cloud Functions calling an external AI API |
| Bank data | CSV/PDF statement upload (or Plaid Sandbox — see bank data decision doc) |

## Component Breakdown

**Web/Mobile Clients**
- Handle UI, user input, and display of transactions/budgets/insights
- Talk to Firebase Auth for login/signup
- Read/write data through Firestore (directly, using security rules to restrict access)
- Call Cloud Functions for anything requiring server-side logic (e.g. AI categorization)

**Firebase Auth**
- Handles user sign-up/login
- Issues tokens used to authenticate Firestore reads/writes and Cloud Function calls

**Firestore (Database)**
- Stores user profiles, transactions, categories, budgets
- Security rules restrict each user to only their own data

**Cloud Functions**
- Parses uploaded CSV/PDF statements into structured transaction data
- Calls the AI API to categorize transactions and generate insights
- Any logic too sensitive or complex to run on the client

**Firebase Hosting**
- Serves the built React web app

## Data Flow (Statement Import Example)
1. User uploads a CSV/PDF in the web or mobile client
2. File is sent to a Cloud Function
3. Cloud Function parses the file into transaction records
4. Cloud Function calls the AI API to categorize each transaction
5. Categorized transactions are written to Firestore
6. Client listens for Firestore updates and displays the new transactions

## Why This Stack
- Firebase removes the need to build and host a custom backend server, which fits a one-semester timeline
- Firestore's real-time listeners make the UI update automatically as data changes (useful for the "sync" experience)
- Cloud Functions keep the AI API key and logic server-side instead of exposing it in the client

## Open Questions
- Final mobile framework choice (Flutter vs. React Native)
- Which AI provider/model for categorization
- Whether Cloud Functions' free-tier limits are enough for our use, or if we'll hit quota during heavy testing