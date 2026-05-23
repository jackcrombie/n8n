xero-expansion-plan.md
# n8n Xero Module Expansion Plan & Specification

## 1. Overview
The current native n8n Xero node is hardcoded to interact exclusively with the core Xero Accounting API (`api.xro`). The goal of this expansion is to refactor the node's routing logic to support dynamic base URLs, enabling the integration of the **Projects, Files, Assets, and Finance APIs** (Phase 1), with a roadmap for the **Reporting API** (Phase 2).

This will significantly enhance the module's utility for advanced automation, specifically for business intelligence (BI), project management, and automated document storage.

---

## 2. Core Architecture Refactoring

### 2.1 The Base URL Routing Override
Before adding new resources (like Projects or Finance), the underlying HTTP request logic must be modified. 

**File to modify:** `packages/nodes-base/nodes/Xero/GenericFunctions.ts` (or equivalent Xero API helper file).

**Specification:**
* Implement a dynamic switch based on the selected `resource`.
* Maintain `https://api.xero.com/api.xro/2.0/` as the default fallback to ensure backwards compatibility with existing user workflows.

**Proposed Logic Structure:**
```typescript
let baseUrl = '[https://api.xero.com/api.xro/2.0/](https://api.xero.com/api.xro/2.0/)'; // Default Core Accounting

if (resource === 'project' || resource === 'task' || resource === 'timeEntry') {
    baseUrl = '[https://api.xero.com/projects.xro/2.0/](https://api.xero.com/projects.xro/2.0/)';
} else if (resource === 'file' || resource === 'folder') {
    baseUrl = '[https://api.xero.com/files.xro/1.0/](https://api.xero.com/files.xro/1.0/)';
} else if (resource === 'asset') {
    baseUrl = '[https://api.xero.com/assets.xro/1.0/](https://api.xero.com/assets.xro/1.0/)';
} else if (resource === 'finance') {
    baseUrl = '[https://api.xero.com/finance.xro/1.0/](https://api.xero.com/finance.xro/1.0/)';
}
```

### 2.2 Authentication Scopes
Ensure the node description advises users to update their Xero App scopes in the Developer Portal. The existing OAuth2 credential structure in n8n does not need changing, but the scopes requested must cover:
* `projects.read`
* `files` / `files.read`
* `assets` / `assets.read`
* `accounting.reports.read` (for Finance/Reports)

---

## 3. Phase 1: New API Integrations

### 3.1 Projects API (`projects.xro/2.0/`)
**Primary Use Case:** Linking invoice references to project names and extracting timesheet data.

**Resources & Operations:**
* **Project:** `Get All`, `Get`
* **Task:** `Get All`, `Get`
* **Time Entry:** `Get All`, `Get`
* *Key UI Requirement:* Allow querying time entries by `invoiceId` so users can dynamically resolve Project IDs from standard accounting webhooks.

### 3.2 Finance API (`finance.xro/1.0/`)
**Primary Use Case:** Extracting clean, pre-calculated financial statements directly into BI tools (Metabase, PowerBI, Airtable) without manual CSV exports.

**Resources & Operations:**
* **Financial Statement:** `Profit And Loss`, `Balance Sheet`, `Cashflow`
* *Key UI Requirement:* Provide optional query parameters via the `Additional Fields` node UI.
    * `startDate`, `endDate`, `balanceDate`
    * `trackingCategory` arrays

### 3.3 Files API (`files.xro/1.0/`)
**Primary Use Case:** Automatically uploading receipts and attaching PDFs to newly generated invoices or bills.

**Resources & Operations:**
* **File:** `Upload`, `Download`, `Get All`, `Link to Record` (e.g., linking a file ID to an Invoice ID).
* **Folder:** `Get All`, `Create`

### 3.4 Assets API (`assets.xro/1.0/`)
**Primary Use Case:** Creating draft fixed assets triggered by specific bill approvals.

**Resources & Operations:**
* **Asset:** `Create`, `Get All`, `Get`
* **Asset Type:** `Get All`

---

## 4. Phase 2: Reporting API

**Primary Use Case:** While the Finance API provides standardized P&L and Balance Sheet objects, the core Xero Reporting API (`api.xro/2.0/Reports`) allows for granular, customized accounting reports (Aged Payables, Aged Receivables, Trial Balance, GST/VAT tracking).

**Implementation Plan:**
* **Base URL:** This actually uses the standard `api.xro/2.0/` base URL, so it avoids the need for a routing switch, but requires complex JSON parsing due to Xero's rigid report row/cell grid structure.
* **Resources & Operations:**
    * **Report:** `Aged Payables By Contact`, `Aged Receivables By Contact`, `Trial Balance`
* **UI/UX Focus:** Xero returns reports in nested arrays (`Rows` containing `Rows` containing `Cells`). The n8n node will need a custom parsing function in `GenericFunctions.ts` to flatten this grid into a standard JSON array so downstream nodes can iterate over the items easily.

---

## 5. Development & Testing Workflow

1.  **Cursor Code Generation:**
    * Provide Cursor with `GenericFunctions.ts` and `Xero.node.ts`.
    * Prompt: *"Add Phase 1 resources (Project, Finance, File, Asset). Build the dynamic baseUrl switch in the API helper function. Generate `INodeProperties` for the new operations matching n8n standards."*
2.  **local built from code test deployment:**
    * use the local build from code for testing.
3.  **Xero Developer Portal Update:**
    * tell the dev how to setup the xero developer project to interface with the test server running locally on their mac.
    * include full xero project setup instructions and Add the new scopes (`projects.read`, `files`, `assets`, etc.) to the app configuration.
    * this will be a new project, not built on an existing project.
4.  **Sandbox Testing:**
    * Authenticate the staged n8n instance against the **Xero Demo Company**.
    * Test the `invoiceId` -> `projectId` lookup flow.
    * Test pulling a P&L report for BI formatting.
5.  **Pull Request after successful tests and dev acceptance:** 
    * Lint code according to n8n's standards (`pnpm run lint`).
    * Submit PR to `n8n-io/n8n` targeting the `master` branch.