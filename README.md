# 🖨️ Xerox Shop Management System

A modern, fast, and reliable billing and daily accounting web application designed specifically for Xerox, print, and stationery shops. Built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS.

---

## ✨ Features

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
- **🛡️ Database & Backup Vault**:
  - **Zero-Loss Data Persistence**: All bills, expenses, and settings are saved automatically in the backend database. Data never resets on page refresh!
  - **Automated Snapshots**: Periodic rolling snapshots created automatically before critical mutations.
  - **Download Backup**: One-click download of the complete database as a portable JSON file.
  - **Restore Backup**: Upload and restore previous backup files with pre-restore safety snapshots.
  - **Export to Excel (CSV)**: Download day-wise accounts statements for accounting and tax purposes.
- **⚙️ Custom Price List & Shop Settings**:
  - Easily configure shop name and customize rates for printing, scanning, and stationery items.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router & Route Handlers)
- **Frontend**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React Icons](https://lucide.dev/)
- **State & Data Fetching**: [SWR](https://swr.vercel.app/)
- **Backend & API**: Next.js Server Route Handlers (`/api/day`, `/api/entries`, `/api/expenses`, `/api/settings`, `/api/history`, `/api/backup`, `/api/backup/snapshots`, `/api/health`)
- **Database Engine**: Persistent JSON database engine with atomic temp-file-and-rename writes and rollback snapshot vault.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20.11 or higher
- `npm` (bundled with Node.js)

### Installation

1. Clone or open the project directory:
   ```bash
   cd xerox-shop-management-system
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ Production Build

To create an optimized production build:

```bash
npm run build
npm start
```

---

## 📦 Database & Storage

The database files are stored by default in `.data/`:
- `.data/shop-db.json` — Active shop database
- `.data/backups/` — Automated rolling snapshot backups

To configure a custom database path (e.g. for Docker or VPS persistent volumes):
```bash
# In .env or environment variables:
DATA_DIR=/var/data/xerox-shop
```

---

## 🚢 Deployment Guide

### Option 1: Vercel (Recommended for quick deployment)
1. Push your repository to GitHub.
2. Go to [vercel.com](https://vercel.com/) and click **Add New Project**.
3. Select your GitHub repository.
4. Next.js is automatically detected — click **Deploy**.

### Option 2: Render / Railway / Fly.io / VPS (with persistent disk)
1. Connect your GitHub repository.
2. Build Command: `npm install && npm run build`
3. Start Command: `npm start`
4. Attach a persistent volume mounted at `/app/.data` and set `DATA_DIR=/app/.data` so that data persists across redeployments.

### Option 3: Docker
```dockerfile
FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 📤 Push to GitHub

To push this codebase to your GitHub repository:

```bash
# 1. Initialize git (if not already done)
git init

# 2. Stage all files
git add .

# 3. Create your first commit
git commit -m "feat: complete Xerox Shop Management System with backend API, database, and backup vault"

# 4. Set main branch
git branch -M main

# 5. Link your GitHub repository (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git

# 6. Push code to GitHub
git push -u origin main
```

---

## 📄 License

MIT License. Free to use and customize for your shop!
