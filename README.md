<div align="center">

<br />

```
████████╗██╗  ██╗███████╗███████╗██╗███████╗███████╗███████╗████████╗ ██████╗ ██████╗ ███████╗
╚══██╔══╝██║  ██║██╔════╝╚══███╔╝██║██╔════╝██╔════╝██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██╔════╝
   ██║   ███████║█████╗    ███╔╝ ██║█████╗  ███████╗███████╗   ██║   ██║   ██║██████╔╝█████╗  
   ██║   ██╔══██║██╔══╝   ███╔╝  ██║██╔══╝  ╚════██║╚════██║   ██║   ██║   ██║██╔══██╗██╔══╝  
   ██║   ██║  ██║███████╗███████╗██║███████╗███████║███████║   ██║   ╚██████╔╝██║  ██║███████╗
   ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝╚══════╝╚══════╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝
```

### 🎮 Premium Instant Game Top-Up & Digital Goods Platform 🇰🇭

*Next-Generation Automated Gaming Storefront with Dynamic KHQR, Multi-Supplier API Fulfillment & Military-Grade 3FA Admin Security.*

<br />

[![Next.js 15](https://img.shields.io/badge/Next.js-15.1-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19.0-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.22-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Serverless-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)

<br />

[![Developer](https://img.shields.io/badge/Developer-SokPhal-9333EA?style=flat-square&logo=visual-studio-code&logoColor=white)](https://sophal.vercel.app/)
[![Security](https://img.shields.io/badge/Security-3FA_Protected-emerald?style=flat-square&logo=auth0&logoColor=white)](#-3-factor-authentication-3fa-architecture)
[![Payment](https://img.shields.io/badge/Payment-KHQR_Bakong-red?style=flat-square)](#-payments--financial-engine)
[![Telegram Support](https://img.shields.io/badge/Telegram-@TheziessStore-24A1DE?style=flat-square&logo=telegram&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-Proprietary-pink?style=flat-square)](#-license--copyright)

<br />

[✨ Core Features](#-core-features) • [🔐 3FA Security](#-3-factor-authentication-3fa-architecture) • [⚡ Quickstart](#-5-minute-quickstart) • [🛠️ Admin Control](#️-admin-control-center) • [🔌 Supplier APIs](#-automated-top-up-suppliers) • [📂 Architecture](#-project-structure)

</div>

<br />

---

## 🎯 Overview

**TheziessStore** is an enterprise-grade digital top-up platform engineered specifically for high-concurrency game currency purchases across Cambodia. Customers instantly recharge diamonds and credits for **Mobile Legends: Bang Bang, Free Fire, PUBG Mobile, Genshin Impact, Honor of Kings, Roblox, and more** using instant **KHQR (Bakong / ABA PAY / ACLEDA)** with real-time automated delivery dispatched to upstream fulfillment suppliers (**Bay2Game, Khmer TopUp, FrozenYuki**).

```mermaid
graph LR
    subgraph Client ["Customer Experience"]
        A[Customer Browser] -->|Select Game & UID| B[TheziessStore Front]
        B -->|Scan Dynamic KHQR| C[Bakong / ABA Bank App]
    end

    subgraph Core ["Platform Engine"]
        C -->|Instant Webhook| D[Payment Verification Engine]
        D -->|Order PAID State| E[Fulfillment Orchestrator]
        E -->|One-Click / Auto Dispatch| F[Supplier API Adapter]
    end

    subgraph Fulfillment ["Automated Upstream"]
        F -->|Top-Up Dispatch| G[Bay2Game / Khmer TopUp / FrozenYuki]
        G -->|Deliver Diamonds| H[Customer Game Account]
        E -->|Single Summary Receipt| I[Telegram Notification Bot]
    end
```

---

## ✨ Core Features

<table width="100%">
<tr>
<td width="50%" valign="top">

### 🛍️ Customer Storefront
- 🎮 **Dynamic Game Directory:** Rich interactive grid with custom badges (`HOT`, `BEST VALUE`, `WEEKLY PASS`).
- 🆔 **Real-Time UID Verification:** Live server & player nickname validation before checkout.
- 💱 **Live Currency Switcher:** Real-time dual display for **USD ($)** and **KHR (៛)** with precise exchange calculation.
- ⏱️ **Zero-Friction Checkout:** Dynamic KHQR generated in sub-seconds with 180s live countdown and instant receipt.
- 📱 **Edge-to-Edge Responsive UI:** Full-bleed mobile banners with smooth touch navigation and transparent anime mascot logo.
- 🔍 **Live Order Tracking:** 3-second polling timeline with animated fulfillment steps and PDF invoice download.

</td>
<td width="50%" valign="top">

### 🛡️ 3FA Admin Command Center
- 🔐 **3-Factor Authentication (3FA):** Email/Password + Google Authenticator (TOTP) + 264-character Telegram Bot Security Key.
- ⚡ **One-Click & Bulk API Fulfillment:** Direct `⚡ Call API` button on each order row plus batch fulfillment for all paid orders.
- 📊 **Real-Time Revenue Analytics:** Live charts, top-selling games, daily transaction volume & conversion rates.
- 📦 **Full Catalog Management:** Add, edit, reorder games, products, banners, FAQs, and supplier package mappings.
- 🚫 **Fraud Defense & Blacklist:** Instant blacklist rules blocking abusive IPs, player UIDs, phone numbers, and emails.
- 📜 **Immutable Audit Trail:** Cryptographically structured event log recording every sensitive admin operation.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 💳 Payments & Financial Engine
- 🇰🇭 **Universal KHQR Integration:** Seamlessly scannable by all 30+ Cambodian financial institutions.
- 🔒 **HMAC-SHA256 Webhook Auth:** Replay-resistant webhook verification with payload signature validation.
- ⚡ **Idempotent State Machine:** Strict database transitions (`PENDING` $\rightarrow$ `PAID` $\rightarrow$ `PROCESSING` $\rightarrow$ `DELIVERED`) preventing double-topups.
- 🧪 **Zero-Cost Simulation Mode:** Built-in development sandbox engine for instant end-to-end testing without real bank funds.

</td>
<td width="50%" valign="top">

### 🤖 Multi-Supplier Automation
- 🔌 **Dynamic Upstream Routing:** Routes each product dynamically to Bay2Game, Khmer TopUp, or FrozenYuki.
- 🔄 **Autonomous Status Sync:** Background status refresher resolving pending provider outcomes without duplicate deliveries.
- 📩 **Unified Telegram Alerts:** Consolidated single-message receipts for payment confirmations and supplier delivery status.
- 🛡️ **Progressive Lockout System:** Escalating lockout tiers defending against brute-force attacks across all auth factors.

</td>
</tr>
</table>

---

## 🔐 3-Factor Authentication (3FA) Architecture

TheziessStore implements a state-of-the-art **3-Tier Authentication Cascade** protecting the administrative command center:

```
[ Step 1: Credentials ] ──► [ Step 2: TOTP 2FA ] ──► [ Step 3: Telegram Security Key ] ──► [ Admin Dashboard ]
Email + Master Password      Google Authenticator       264-Char High-Entropy Token          Full Access
(Rate limit: 10 / 15m)       (6-Digit Time-Based)       (Issued via Telegram Bot /getkey)    (Strict Session)
```

1. **Factor 1: Master Credentials** — Email and high-entropy Argon2/scrypt hashed password evaluated with progressive IP rate-limiting.
2. **Factor 2: Time-Based OTP (TOTP)** — RFC 6238 compliant 6-digit verification code generated via Google Authenticator or 1Password.
3. **Factor 3: High-Entropy Telegram Security Key** — Dynamic 264-character cryptographic token generated directly through the store's private Telegram bot webhook (`/getkey`). Single-use with a strict 5-minute expiration window.

---

## 🔌 Automated Top-Up Suppliers

TheziessStore abstracts provider differences through a unified supplier adapter layer (`lib/topup/`):

| Provider | Supported Games | Protocol | Capabilities |
| :--- | :--- | :--- | :--- |
| **Bay2Game** | MLBB, Free Fire, Genshin, PUBG | REST / JSON | Instant top-up, Balance check, Order status query, Product catalog sync |
| **Khmer TopUp** | MLBB, Free Fire, Telegram Stars | REST / HTTPS | Async/Sync top-up, Player verification, Webhook callback |
| **FrozenYuki** | Mobile Legends, Free Fire, Global | REST / JSON | High-volume game currency dispatch, Dynamic package mapping |

### Order Fulfillment Controls (`/admin/orders`):
- **⚡ Call API**: Fulfills individual paid orders on demand with real-time status toast feedback.
- **⚡ Retry API**: Safely re-attempts supplier delivery on failed orders without manual database edits.
- **⚡ Call API for All Ready (N)**: Concurrently processes all pending paid orders in a single batch.

---

## ⚡ 5-Minute Quickstart

### Prerequisites
- Node.js `20.x` or higher
- PostgreSQL database (Recommended: [Neon Serverless](https://neon.tech))
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))

### 1. Clone & Install

```bash
git clone https://github.com/sophal111323/backdystore.git theziessstore
cd theziessstore
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Database (Neon Serverless PostgreSQL)
DATABASE_URL="postgresql://user:password@ep-divine-shape.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# Security & Admin 3FA Authentication
ADMIN_JWT_SECRET="generate-a-secure-random-64-character-secret-key"
ADMIN_EMAIL="admin@theziessstore.com"
ADMIN_PASSWORD="YourSuperSecurePassword123!@#"
ADMIN_TOTP_SECRET="JBSWY3DPEHPK3PXP" # Base32 secret for Google Authenticator

# Telegram Bot (Fulfillment Alerts & 3FA Key Dispatch)
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
TELEGRAM_CHAT_ID="-1001234567890"
TELEGRAM_ADMIN_USER_IDS="123456789" # Telegram user IDs authorized to request 3FA keys

# Payment Gateway (Tola Saint / KHQR)
PAYMENT_SIMULATION_MODE="true" # Set false for production
TOLA_SAINT_BASE_URL="https://api.tolasaint.com"
TOLA_SAINT_API_KEY="your-api-key"
TOLA_SAINT_WEBHOOK_SECRET="your-webhook-secret"

# Upstream Top-up Suppliers
BAY2GAME_PARTNER_ID="your-partner-id"
BAY2GAME_SECRET_KEY="your-secret-key"
KHMER_TOPUP_API_KEY="your-api-key"

# App URLs
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Initialize Database Schema

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

- 🌐 **Storefront:** [http://localhost:3000](http://localhost:3000)
- 🔒 **Admin Portal:** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🛠️ Admin Control Center

| Route | Purpose | Key Actions | Role Required |
| :--- | :--- | :--- | :---: |
| `/admin` | Live Dashboard | Real-time revenue charts, active order counts, quick stats | `Admin` |
| `/admin/orders` | Order Management | ⚡ **Call API**, **Retry Failed**, **Batch Fulfill**, CSV Export | `Admin` |
| `/admin/orders/[id]` | Order Deep Dive | Raw supplier response, player UID verification, delivery notes | `Admin` |
| `/admin/games` | Catalog Manager | Add games, reorder display sequence, upload banner art | `Admin` |
| `/admin/products` | Package Pricing | Configure diamond tiers, profit margins, supplier code mappings | `Admin` |
| `/admin/banners` | Promo Hero Slider | Upload edge-to-edge promotional banners & set click links | `Admin` |
| `/admin/customers` | Customer Directory | View lifetime spend, purchase history & player UID records | `Admin` |
| `/admin/banlist` | Fraud Shield | Block malicious IP addresses, fraudulent UIDs & emails | `SuperAdmin` |
| `/admin/audit-logs` | Compliance Trail | Immutable log of administrative actions, logins & IP addresses | `SuperAdmin` |
| `/admin/settings` | Store Settings | Maintenance gate toggle, branding, exchange rate & announcements | `SuperAdmin` |

---

## 📂 Project Structure

```
TheziessStore/
├── app/
│   ├── (storefront)/              # Customer views (Home, Checkout, Order Tracker, Privacy)
│   ├── admin/                     # 3FA Admin command center views
│   │   ├── orders/                # Order management with ⚡ Call API & bulk fulfillment
│   │   ├── games/                 # Game catalog management
│   │   ├── products/              # Product packages & supplier code mapping
│   │   └── settings/              # Store branding, maintenance gate & controls
│   └── api/                       # REST API handlers
│       ├── admin/                 # Protected admin APIs (Auth 3FA, Orders, Fulfill, Upload)
│       ├── orders/                # Order placement & public status tracking
│       ├── payment/webhook/       # KHQR payment confirmation webhooks
│       └── telegram/webhook/      # Telegram bot webhook (/getkey, /status)
├── components/                    # Modular React components
│   ├── Header.tsx                 # Transparent mascot navigation header
│   ├── HeroCarousel.tsx           # Full-bleed responsive promotional slider
│   ├── GameCard.tsx               # Interactive game catalog cards
│   ├── KHQRSheet.tsx              # Dynamic QR payment modal with countdown
│   └── AdminSidebar.tsx           # Dashboard navigation with active states
├── lib/                           # Core business logic & services
│   ├── topup/                     # Multi-supplier fulfillment adapters (Bay2Game, KhmerTopup, FrozenYuki)
│   ├── fulfillment.ts             # Idempotent order fulfillment & retry state machine
│   ├── payment/                   # KHQR generator & webhook verification
│   ├── secureLogger.ts            # Sanitized security event logging
│   ├── lockPolicy.ts              # Progressive lockout brute-force defense
│   ├── telegram.ts                # Telegram notification dispatcher
│   └── prisma.ts                  # Shared Prisma client instance
├── prisma/
│   ├── schema.prisma              # Database schema definition
│   └── seed.ts                    # Initial games, products & admin seed script
└── public/                        # Static assets, transparent logos & icons
```

---

## 📄 License & Copyright

**Copyright © 2026 TheziessStore (SokPhal). All Rights Reserved.**

Developed & Maintained with ❤️ by **[SokPhal](https://sophal.vercel.app/)** for **TheziessStore**.

This software and its source code are proprietary and confidential. Unauthorized copying, reverse engineering, redistribution, or modification of this project, in whole or in part, via any medium is strictly prohibited without prior written consent from the author.

---

<div align="center">

Built with ⚡ for the Cambodian gaming community by **[SokPhal](https://sophal.vercel.app/)**.  
Portfolio: **[sophal.vercel.app](https://sophal.vercel.app/)**

</div>
