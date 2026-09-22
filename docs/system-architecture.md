# System Architecture — Financial Planner App

## Overview

The Financial Planner has three main parts: a web client, a mobile client, and a shared backend built using Firebase.

The application will also use Plaid Sandbox during development to simulate bank account connections and retrieve test financial data without using real bank accounts.

## Stack

| Layer                  | Choice                                     |
| ---------------------- | ------------------------------------------ |
| Web frontend           | React                                      |
| Mobile frontend        | TBD (Flutter or React Native)              |
| Backend platform       | Firebase                                   |
| Authentication         | Firebase Authentication                    |
| Database               | Firestore                                  |
| Server-side processing | Firebase Cloud Functions                   |
| Web hosting            | Firebase Hosting                           |
| AI processing          | Cloud Functions calling an external AI API |
| Bank data              | Plaid Sandbox                              |

## Component Breakdown

**Web/Mobile Clients**

* Handle the user interface and user input
* Display transactions, budgets, financial goals, and financial insights
* Allow users to connect a test bank account through Plaid Link
* Communicate with Firebase Authentication for login and signup
* Read and write permitted data through Firestore
* Call Cloud Functions when server-side processing is required

**Firebase Authentication**

* Handles user signup and login
* Identifies each user
* Helps ensure users can only access their own financial information

**Firestore**

* Acts as the application's database
* Stores user profiles, transactions, categories, budgets, and financial goals
* Uses Firebase Security Rules to restrict users to their own data

**Firebase Cloud Functions**

* Handles backend operations that should not run directly on the user's device
* Retrieves and processes financial data from Plaid Sandbox
* Can call an external AI API to categorize transactions and generate financial insights
* Keeps sensitive information, such as API keys, away from the client application

**Plaid Sandbox**

* Simulates connecting bank accounts during development
* Provides test account and transaction data
* Allows the team to test bank integration without using real bank accounts or real financial information

**Firebase Hosting**

* Hosts and serves the React web application

## Data Flow — Bank Connection Example

1. The user selects **Connect Bank**
2. Plaid Link opens in the web or mobile application
3. The user connects a Plaid Sandbox test account
4. Plaid provides test account information and transaction data
5. The backend retrieves the financial data from Plaid
6. Cloud Functions process the transaction information
7. Transactions are stored in Firestore
8. The application retrieves the stored data and displays it to the user
9. The AI system may analyze the transactions and generate categories or financial insights

## Example Transaction Flow

A transaction such as:

**Starbucks — $8.42**

could be retrieved from Plaid Sandbox and stored in Firestore. The system could then categorize the transaction as:

**Dining**

The application could use this category when calculating budgets, showing spending summaries, or generating financial insights.

## Why This Stack

* Firebase provides authentication, database storage, backend functions, and hosting without requiring the team to create and maintain a traditional backend server
* Firestore provides a convenient database for storing and synchronizing financial information
* Firebase Authentication provides a way to manage user accounts and access
* Cloud Functions allow sensitive or complicated processing to remain on the backend
* Plaid Sandbox allows the project to demonstrate realistic bank integration without using real financial accounts
* React provides a flexible way to build the web interface
* This architecture is manageable within a one-semester development timeline

## Open Questions

* Final mobile framework choice: Flutter or React Native
* Which AI provider or model will be used
* How AI-generated financial insights will be presented to users
* Whether Firebase usage limits will be sufficient during development and testing
