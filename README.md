# 🖨️ Xerox Shop Management System (Multi-User Edition)

A modern, fast, and reliable billing and daily accounting web application designed specifically for Xerox, print, and stationery shops. Built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS.

---

## ✨ Features

- **👥 Multi-User Terminal & Authenticator**:
  - **Single Login Page** with quick operator selection cards & touch keypad.
  - **User 1 (Counter 1)**: Main Xerox, color printing, document scanning, and general POS.
  - **User 2 (Counter 2)**: Stationery, lamination, spiral binding, and finishing items.
  - **User 3 (Manager / Owner)**: Store manager, auditing, daily expense accounting, and pricing setup.
  - **4-Digit Fast PIN Authenticator** (Default: User 1: `1111` | User 2: `2222` | User 3: `3333`).
  - **Independent Databases**: Each operator has their own completely isolated database, pricing list, bills, and daily accounts!
  - **Automatic Routing**: Authenticator instantly redirects each user to their destined dashboard (`/dashboard/user1`, `/dashboard/user2`, `/dashboard/user3`).
  - **Counter Switcher**: One-click counter switching in the header.

- **🛡️ Rock-Solid Vercel Persistence (Zero Data Loss)**:
  - **Why Vercel Previously Cleared Data**: On Vercel, serverless containers are ephemeral. Any file written to local `/tmp` is wiped when containers sleep after 5-15 minutes or when new containers spin up.
  - **Dual Persistence Engine**:
    1. **Browser Persistent Vault (Default)**: Automatically saves and restores all bills, expenses, and settings per user in `localStorage`. Even across cold-starts, page refreshes, and multi-day sessions, your data is never cleared!
    2. **Cloud KV / Upstash Redis (Optional Multi-Device Sync)**: Set `KV_REST_API_URL` and `KV_REST_API_TOKEN` to sync transactions across multiple devices (phones, laptops, counter PCs) permanently on the cloud for free.
    3. **Automated Rolling Snapshots**: Snapshots are backed up per user and can be downloaded or restored at any time.

- **⚡ Fast POS Billing**:
  - One-tap quick add for Xerox, color printing, lamination, spiral binding, and stationery items.
  - Custom line items on the fly (passport photos, special printouts, etc.).
  - Real-time bill calculations with quantity and custom rate adjustments.

- **💰 Multi-Mode Payment & Change Calculator**:
  - Cash, UPI (GPay/PhonePe/Paytm), and Split Payment (Cash + UPI).
  - Built-in quick tender denomination buttons (₹10, ₹20, ₹50, ₹100, ₹200, ₹500) and change-to-return calculator.

- **💸 Daily Expense Tracker**:
  - Record paper bundles, toner, machine repairs, snacks, rent, and electricity expenses with Cash or UPI tagging.

- **📊 Real-Time Daily Summary Cards**:
  - Total Sales & Bill count
  - Cash Received vs. UPI Received
  - Total Expenses (Cash vs. UPI breakdown)
  - Cash in Drawer balance (`Opening Cash + Cash In − Cash Expenses`)

- **⚙️ Custom Price List & Shop Settings**:
  - Each operator can configure their shop counter name and customize rates for printing, scanning, and stationery items.

---

## 🔑 Operator Accounts & Default PINs

| User | Counter Name | Default PIN | Destined Dashboard |
| :--- | :--- | :--- | :--- |
| **User 1** | Counter 1 (Main Xerox & Print) | `1111` | `/dashboard/user1` |
| **User 2** | Counter 2 (Stationery & Binding) | `2222` | `/dashboard/user2` |
| **User 3** | Counter 3 (Store Manager / Owner) | `3333` | `/dashboard/user3` |

> [!TIP]
> You can change the default PINs by setting `PIN_USER1`, `PIN_USER2`, and `PIN_USER3` in your `.env` or Vercel Environment Variables.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router & Route Handlers)
- **Frontend**: React 19, Tailwind CSS v4, Lucide React Icons
- **State & Data Fetching**: SWR
- **Authentication**: PIN Authenticator, session cookies, and route middleware
- **Database Engine**: Multi-user isolated JSON engine + Browser Persistent Storage + Upstash Redis / Vercel KV cloud adapter

---

## 🚀 Getting Started

### 1. Installation
```bash
cd xerox-shop-management-system
npm install
```

### 2. Start Local Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000). You will be automatically redirected to the Login page (`/login`).

---

## 🚢 Deploying to Vercel (Persistent Storage Setup)

### Option 1: Browser Persistent Storage (Zero Setup Required!)
Deploy directly to Vercel without configuring any databases.
1. Push code to GitHub and import the project into Vercel.
2. Click **Deploy**.
3. All data will be safely stored in the browser per user and auto-synced across page refreshes and multi-day sessions!

### Option 2: Cloud Database for Multi-Device Sync (Recommended for multiple PCs/phones)
To allow Counter 1, Counter 2, and Manager to sync across different devices or phones:
1. Create a free database at [Upstash](https://upstash.com) (Redis) or Vercel Storage (KV).
2. Copy the **REST URL** and **REST TOKEN**.
3. In your Vercel Project Settings -> **Environment Variables**, add:
   ```env
   KV_REST_API_URL=https://your-upstash-instance.upstash.io
   KV_REST_API_TOKEN=your-token-here
   ```
4. Redeploy. All users' databases are now permanently saved in the cloud!
