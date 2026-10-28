# WAEC Monitoring & Operations System (WAEC MOS)

[![Next.js](https://img.shields.io/badge/Next.js-16.4.3-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![Database](https://img.shields.io/badge/PostgreSQL-Neon-00e599?style=flat&logo=postgresql)](https://neon.tech/)
[![Security](https://img.shields.io/badge/Auth-Better--Auth-indigo?style=flat)](https://www.better-auth.com/)

The **WAEC Monitoring & Operations System (MOS)** is a centralized, role-based operations management and dispatch platform designed for the **West African Examinations Council (WAEC)**. It provides real-time oversight of examination field operations, personnel dispatch, GPS-verified presence, instant incident triage, emergency distress beacons (SOS), and tamper-evident audit logging across national and regional centers.

---

## 🏛 Key Capabilities

- **National & Regional Command Console:** High-altitude situational awareness with interactive telemetry maps, active distress alerts, live fleet counters, and center geofence tracking.
- **Field Officer Terminal (PWA):** Mobile-optimized operational workspace for on-ground officers to perform GPS-verified center check-in, monitor assignments, report incidents with photo attachments, and hold-to-activate emergency SOS beacons.
- **Closed Identity & Access Governance:** Zero self-registration policy. Only Super Administrators and Administrators can provision staff accounts. Compulsory first-login password rotation and instant session invalidation upon account revocation.
- **Incident Escalation Engine:** End-to-end incident management (Malpractice, Security Threat, Logistics, Medical) with severity classification (`LOW` to `CRITICAL`), automated timers, and supervisor resolution workflows.
- **Immutable Audit Trail:** Comprehensive recording of administrative operations, session states, and status changes for legal compliance and post-examination non-repudiation.

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Next.js 16.4.3](https://nextjs.org/) (App Router, Server Actions, Route Handlers) |
| **Language & Runtime** | [TypeScript 5.7](https://www.typescriptlang.org/) / Node.js 20+ / pnpm |
| **Frontend & UI** | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) |
| **Component Primitives**| `@base-ui/react`, Radix UI / shadcn style conventions |
| **Authentication** | [Better Auth](https://www.better-auth.com/) (Email & Staff ID credential strategy, session tokens) |
| **Database** | [Neon Serverless PostgreSQL](https://neon.tech/) with [Drizzle ORM](https://orm.drizzle.team/) |
| **Analytics & Telemetry**| `@vercel/analytics`, HTML5 Geolocation API |

---

## 📁 Repository Structure

```plaintext
waec-mos/
├── app/
│   ├── (auth)/                 # Public auth flows (Login, Forgot Password, Force Change Password)
│   │   ├── login/
│   │   ├── change-password/
│   │   └── forgot-password/
│   ├── (dashboard)/            # Authenticated role-scoped consoles
│   │   ├── admin/              # Super Admin & National Admin interfaces
│   │   ├── regional/           # Regional Coordinator dashboard
│   │   ├── supervisor/         # Cluster supervisor patrols & dispatch
│   │   └── field/              # Field officer mobile workspace
│   ├── api/                    # API Route Handlers (Auth, Telemetry, Incidents, Reports)
│   ├── globals.css             # Tailwind CSS v4 design tokens and theme variables
│   ├── layout.tsx              # Root HTML wrapper with analytics and fonts
│   └── page.tsx                # Dynamic portal entrypoint / prototype demo switcher
├── components/
│   ├── command/                # HQ command console components (MapPanel, Telemetry, Fleet)
│   ├── field/                  # Field terminal UI (GeofenceChecker, SOSButton, DutyStatus)
│   ├── shared/                 # Common UI components (Header, Badges, Modals, Breadcrumbs)
│   └── ui/                     # Primitives (Button, Input, Card, Dropdown, Table)
├── lib/
│   ├── auth/                   # Better Auth configuration, client, and session utilities
│   ├── db/                     # Database connection pool (Neon) and Drizzle schema definitions
│   └── utils.ts                # Styling helpers (clsx, twMerge) and geofence math
├── public/
│   ├── images/                 # Local official assets (WAEC Crest/Logo)
│   └── icons/                  # PWA icons and app manifest assets
├── PRD.md                      # Official Product Requirements Document
├── README.md                   # Project documentation & engineering handbook
└── package.json                # Project dependencies and operational scripts
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v20.x or later
- **Package Manager**: `pnpm` (v9 or v12 recommended)
- **Database**: A Neon PostgreSQL connection string (or local PostgreSQL 16+)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/kingenious0/waec-mos.git
cd waec-mos
pnpm install
```

### 2. Environment Configuration

Copy the example environment file and populate your credentials:

```bash
cp .env.example .env
```

Ensure your `.env` contains:

```env
# Database (Neon Serverless PostgreSQL)
DATABASE_URL="postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/waec_mos?sslmode=require"

# Better Auth Configuration
BETTER_AUTH_SECRET="your-generated-super-secret-key-at-least-32-chars"
BETTER_AUTH_URL="http://localhost:3000"

# Optional: Mapbox / Geo Services (for advanced map rendering)
NEXT_PUBLIC_MAPBOX_TOKEN=""
```

### 3. Run Database Migrations

Generate and apply the relational schema to your Neon database:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 4. Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## 👥 Role Hierarchy & Access Control

| Role | Target Interface | Core Responsibilities |
| :--- | :--- | :--- |
| **Super Administrator** | `/admin/console` | System settings, administrator provisioning, global audit log, cross-regional governance. |
| **Administrator** | `/admin/operations`| Field officer account creation, national exam operations, incident resolution, staff revocation. |
| **Regional Coordinator** | `/regional/dashboard`| Regional center monitoring, supervisor assignment, regional operational brief approval. |
| **Supervisor** | `/supervisor/patrols`| Patrol routing, officer check-in tracking, incident investigation and escalation. |
| **Field Officer** | `/field/workspace` | GPS center check-in, examination patrol reports, photo evidence upload, emergency SOS. |

---

## 🔒 Security & Examination Integrity Standards

1. **Zero Public Registration:** Account self-signup is strictly blocked. Every account is tied to an authorized WAEC Staff ID or verified inspector roster.
2. **Mandatory First Login Password Change:** Newly provisioned accounts are flagged with `mustChangePassword: true`, enforcing a password change before unlocking workspaces.
3. **Instant Session Invalidation:** When an administrator flags an account as `REVOKED`, active session cookies are invalidated immediately.
4. **Tamper-Evident Audit Logging:** All mutations, privilege adjustments, and check-ins are logged with actor ID, timestamp, client IP, and before/after states.

---

## 📋 Available Scripts

- `pnpm dev`: Starts the Next.js development server with hot reloading.
- `pnpm build`: Compiles production bundle with strict TypeScript validation.
- `pnpm start`: Runs the optimized production server.
- `pnpm lint`: Lints codebase using Next.js and ESLint rules.
- `pnpm db:generate`: Generates Drizzle migration files based on schema changes.
- `pnpm db:migrate`: Applies migrations directly to the Neon database.

---

## 📄 License & Confidentiality

This project is proprietary software developed for the **West African Examinations Council (WAEC)**. All rights reserved. Unauthorized reproduction, reverse engineering, or redistribution of this software or its operational workflows is strictly prohibited.
