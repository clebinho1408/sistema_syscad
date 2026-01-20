# SysCad - Sistema de Cadastro

## Overview

This is a corporate web system (formerly DETRAN Solicitation Management System) for internal control of registration requests and cadastral changes submitted by driving schools (autoescolas) to DETRAN (Brazilian Department of Motor Vehicles) agencies.

The platform serves as an internal management system with authentication, access levels, analysis workflow, document verification, and real-time communication between driving schools and DETRAN operators.

**Core Purpose:**
- Driving schools submit registration and modification requests for candidates/drivers
- DETRAN operators analyze and process these requests
- Real-time chat communication within each solicitation
- Complete audit trail of all actions

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework:** React 18 with TypeScript
- **Routing:** Wouter (lightweight React router)
- **State Management:** TanStack Query (React Query) for server state
- **UI Components:** shadcn/ui with Radix UI primitives
- **Styling:** Tailwind CSS with CSS variables for theming
- **Build Tool:** Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime:** Node.js with Express 5
- **Language:** TypeScript compiled with tsx
- **API Pattern:** RESTful endpoints under `/api/*`
- **Real-time:** WebSocket server (ws) for chat functionality
- **Session Management:** express-session with PostgreSQL store (connect-pg-simple)
- **Authentication:** Passport.js with local strategy

### Data Layer
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM with drizzle-zod for validation
- **Schema Location:** `shared/schema.ts` (shared between client and server)
- **Migrations:** Drizzle Kit with `db:push` command

### User Roles & Access Control
1. **Autoescola (Driving School):** Create and track solicitations, upload documents, chat with operators
2. **Operador (Operator):** Analyze requests, update statuses, communicate with schools
3. **Admin:** Full system access, user management, reports, audit logs, solicitation types management

### Solicitation Types (Managed via Admin CRUD)
- Transferência + Renovação
- Reinício
- Transferência
- Renovação
- Adição Categoria
- Primeira Habilitação
- Mudança de Categoria

### Solicitation Statuses
- Em Análise: Initial status, under review
- Pendente de Correção: Requires corrections from driving school
- Cadastro Finalizado: Processing completed, chat still enabled
- Aprovada: Fully approved, chat disabled
- Aguardando Penalidade: Waiting for penalty release date

### Key Design Patterns
- **Monorepo Structure:** Client (`client/`), Server (`server/`), Shared (`shared/`)
- **Path Aliases:** `@/*` for client, `@shared/*` for shared code
- **Authentication Guard:** Route-level protection with role-based access
- **Audit Logging:** All significant actions are logged for compliance

### Build Process
- Development: Vite dev server with HMR proxied through Express
- Production: Vite builds static assets, esbuild bundles server to single file

## External Dependencies

### Database
- **PostgreSQL:** Primary database via `DATABASE_URL` environment variable
- **Session Storage:** PostgreSQL table for persistent sessions

### Third-Party Libraries
- **UI Framework:** Radix UI primitives (dialogs, dropdowns, forms, etc.)
- **Form Handling:** React Hook Form with Zod validation
- **Date Utilities:** date-fns with Portuguese locale
- **File Upload:** Multer for document handling

### Environment Requirements
- `DATABASE_URL`: PostgreSQL connection string (required)
- `SESSION_SECRET`: Session encryption key (optional, has default)

### Replit-Specific Integrations
- `@replit/vite-plugin-runtime-error-modal`: Error overlay in development
- `@replit/vite-plugin-cartographer`: Development tooling
- `@replit/vite-plugin-dev-banner`: Development indicator