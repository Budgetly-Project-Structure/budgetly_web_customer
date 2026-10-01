# UI Constraints — Financial Planner App

## Security & Trust
- Show a clear consent screen explaining what data is being accessed and why, before any account/statement gets linked
- Never store full account numbers or credentials on the device — mask them everywhere (e.g. •••• 4521)
- Require re-authentication before viewing full transaction history or changing linked accounts
- Add a biometric/PIN lock option for the mobile app

## Data-Heavy Screens
- Transaction list: scrollable card list on mobile vs. sortable/filterable table on web — design each separately, don't just shrink one to fit the other
- Users can correct a transaction's category in 1–2 taps, not a full edit form
- Budget progress shown visually (progress bar or ring), using color **plus** an icon/label — don't rely on color alone (colorblind accessibility)
- Consistent currency/number formatting across mobile and web

## Sync & Error States
- Design "bank sync failed" / "statement import failed" states up front — these come up constantly during testing
- Define the empty state for a brand-new user with no data yet
- Show a "last synced" timestamp so users know if their data is current

## Cross-Platform Consistency
- Same core navigation structure on mobile and web: Home, Budget, Transactions, Insights, Settings
- Keep onboarding (account setup, first statement import) short — long onboarding is the biggest drop-off point in finance apps

## Bank Data Approach
- Using CSV/PDF statement upload (or Plaid Sandbox — see /docs decision doc) instead of live production bank linking
- No real bank accounts with real user money — out of scope for this class project