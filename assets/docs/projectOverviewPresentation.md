# Financial Planner App — UI Constraints & AI Integration Plan

**CSCI 475 Software Engineering | Client Project**

---

## Project Overview

We're building a budgeting app for mobile and web that helps users understand and manage their spending. Users will upload financial transaction data, and the app will automatically organize transactions into categories such as Groceries, Dining, Transportation, and Subscriptions.

The system will have a frontend for the mobile/web interface, a backend for processing data and handling application logic, and a database for storing users, transactions, categories, and budgets. AI will be used to categorize transactions and generate easy-to-understand spending insights.

---

## How We'll Handle Bank Data

Real bank-linking services require approval and security requirements that are unrealistic for a semester project. Instead, we have two options:

| Approach             | What It Means                             | Implementation                                                                                                             |
| -------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Statement Upload** | Users upload a CSV or PDF from their bank | The backend reads the file, extracts transactions, organizes them into a standard format, and stores them in the database. |
| **Plaid Sandbox**    | Uses fake but realistic bank accounts     | Our backend retrieves test transactions from Plaid and stores them using the same transaction format.                      |

We will decide between these before development begins because it affects how transaction data enters our backend.

We will **not connect to real bank accounts or store banking credentials**.

---

# UI Constraints

## 1. Security & Trust

Users will create an account and log in before accessing financial information. Passwords will be hashed before being stored, and the backend will verify that users can only access their own transactions and budgets.

Sensitive account information will be masked:

**Checking Account •••• 4521**

The mobile application can also include an optional PIN or biometric lock using the phone's built-in authentication system.

For sensitive actions, such as removing an account or changing important settings, users may be required to authenticate again.

---

## 2. Transactions

The backend will provide transaction information to the frontend through an API.

Each transaction will contain information such as:

`date, merchant, amount, category, confidence`

### Mobile

Transactions will appear as scrollable cards:

**Starbucks**
Sep. 18
Dining
-$6.84

Users can tap the category and immediately select a different one if the AI made a mistake.

### Web

Transactions will appear in a table:

| Date    | Merchant  | Category  |  Amount |
| ------- | --------- | --------- | ------: |
| Sep. 18 | Starbucks | Dining    |  -$6.84 |
| Sep. 17 | Walmart   | Groceries | -$82.15 |

Users will be able to sort and filter transactions by date, category, merchant, and amount.

The mobile and web interfaces will use the same backend data, but each will be designed specifically for its screen size.

---

## 3. Budgets

Users will be able to create monthly spending limits for categories.

For example:

**Dining: $210 / $300 — 70% used**

The backend will calculate how much the user spent in each category and compare it with the budget limit.

A progress bar will visually display this information. We will also use labels and icons so users do not have to rely only on color.

If a budget is exceeded:

**⚠ Dining — $325 / $300 — Budget exceeded**

---

## 4. Errors and Empty Screens

We will design error and empty states from the beginning.

A new user with no transactions will see:

**No transactions yet. Upload your first statement to start tracking your spending.**

If an import fails, the application will explain the problem when possible, such as:

* Unsupported file type
* Missing transaction information
* No transactions found
* File could not be processed

The dashboard will also display a **Last Updated** timestamp so users know how current their financial information is.

---

## 5. Mobile and Web Consistency

Both versions will use the same main navigation:

**Home | Budget | Transactions | Insights | Settings**

Mobile may use a bottom navigation bar, while web may use a sidebar. The layout can change between platforms, but section names and functionality will remain consistent.

---

# AI Feature Implementation

The main AI feature will automatically categorize imported transactions.

## Step 1 — Import

A transaction enters the system:

**Merchant:** Starbucks
**Amount:** $7.42
**Date:** September 20

The backend converts it into our standard transaction format.

## Step 2 — Categorization

The backend sends the necessary transaction information to the AI model.

The AI will choose from categories we define, such as:

**Groceries, Dining, Transportation, Entertainment, Shopping, Utilities, Subscriptions, Healthcare, Other**

For example:

**Starbucks → Dining**

The AI will also return a confidence level.

## Step 3 — Save the Result

The backend validates the AI response and saves the transaction and predicted category to the database.

If the AI cannot confidently determine a category or the request fails:

**Category → Uncategorized**

This means an AI failure will never prevent the transaction from being imported.

## Step 4 — User Corrections

Users can correct an incorrect category with one or two taps.

For example:

**AI:** Walmart → Shopping
**User:** Walmart → Groceries

The backend updates the transaction in the database. We can also remember these corrections so that repeated merchants can be categorized more accurately in the future.

---

# AI Spending Insights

The application will also generate simple explanations about spending.

The backend will calculate the actual numbers first.

For example:

**Dining this month:** $420
**Dining last month:** $356
**Change:** +18%

The AI will then turn those numbers into an understandable message:

*"You spent 18% more on dining this month than last month."*

This is more reliable than asking the AI to calculate financial totals itself.

---

# Natural-Language Questions

As a bonus feature, users could ask questions such as:

*"How much did I spend on coffee this month?"*

The process would be:

**User Question → Backend → Database Query → Calculate Answer → AI Response**

The backend will retrieve and calculate the real transaction data. The AI will mainly turn the result into a natural response.

For example:

**"You've spent $64.27 on coffee so far this month."**

This allows us to demonstrate AI without giving the AI direct control over financial data or calculations.

---

# Database Structure

The database will contain several main tables:

**Users** — account and login information

**Transactions** — merchant, amount, date, category, and AI confidence

**Categories** — available spending categories

**Budgets** — monthly category limits

**Imports** — uploaded statement information and import status

Each transaction and budget will be connected to a specific user so users can only access their own information.

---

# Overall Implementation Flow

The main workflow will be:

**1. User logs in**

↓

**2. User uploads statement or connects Plaid Sandbox**

↓

**3. Backend extracts transaction data**

↓

**4. Transactions are converted into our standard format**

↓

**5. AI categorizes the transactions**

↓

**6. Backend validates and stores them**

↓

**7. Budget totals and spending statistics are calculated**

↓

**8. Dashboard displays transactions, budgets, and insights**

↓

**9. User can correct incorrect AI categories**

---

# Development Plan

We will build the project in stages:

1. **Foundation:** Set up the frontend, backend, database, authentication, and navigation.
2. **Transaction Import:** Implement statement uploads or Plaid Sandbox.
3. **Transactions:** Build mobile cards, web tables, filters, and category editing.
4. **Budgets:** Allow users to create limits and track spending progress.
5. **AI Categorization:** Automatically categorize imported transactions.
6. **Dashboard & Insights:** Display spending totals, charts, and AI explanations.
7. **AI Questions:** Add natural-language financial questions if time allows.
8. **Testing:** Test failed imports, incorrect categories, authentication, AI failures, and mobile/web layouts.

The final goal is for a user to go from importing financial data to viewing categorized transactions, creating budgets, correcting AI mistakes, and receiving useful spending insights in one complete application.
