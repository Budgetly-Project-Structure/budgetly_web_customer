# Data Model — Financial Planner App

## Entities

### User
| Field | Type | Notes |
|---|---|---|
| uid | string | Firebase Auth user ID (document ID) |
| email | string | |
| displayName | string | |
| createdAt | timestamp | |

### Transaction
| Field | Type | Notes |
|---|---|---|
| id | string | Auto-generated document ID |
| userId | string | Owner reference |
| date | timestamp | Transaction date |
| merchant | string | Raw merchant name from statement |
| amount | number | Negative = spending, positive = income |
| category | string | e.g. "Dining", "Groceries" |
| categoryConfidence | number | 0–1, from AI categorization |
| isUserCorrected | boolean | True if user manually changed the category |
| sourceStatementId | string | Reference to the imported statement |

### Statement
| Field | Type | Notes |
|---|---|---|
| id | string | Auto-generated document ID |
| userId | string | Owner reference |
| uploadedAt | timestamp | |
| fileType | string | "csv" or "pdf" |
| status | string | "processing", "completed", "failed" |
| transactionCount | number | How many transactions were extracted |

### Category
| Field | Type | Notes |
|---|---|---|
| id | string | e.g. "dining", "groceries" |
| label | string | Display name |
| icon | string | Icon identifier for UI |
| color | string | Hex color for charts/progress bars |

### Budget
| Field | Type | Notes |
|---|---|---|
| id | string | Auto-generated document ID |
| userId | string | Owner reference |
| categoryId | string | Reference to Category |
| month | string | e.g. "2026-09" |
| limit | number | Budget limit for that category/month |
| spent | number | Running total, updated as transactions come in |

## Relationships
- One **User** → many **Transactions**, **Statements**, **Budgets**
- One **Statement** → many **Transactions** (the ones extracted from it)
- One **Category** → many **Transactions** and **Budgets**

## Notes
- All Firestore documents include a `userId` field so security rules can restrict access to `request.auth.uid == resource.data.userId`
- Categories can start as a fixed, predefined list rather than user-created, to keep the AI categorization step simpler