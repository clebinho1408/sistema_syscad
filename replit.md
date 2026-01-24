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
- Cadastro Finalizado: Processing completed, chat disabled
- Aguardando Penalidade: Waiting for penalty release date

### Admin Capabilities
- Full CRUD on solicitation types (via Settings page - Requerimentos tab)
- Full CRUD on users: create, edit (name, email, role), delete, and block/unblock (via Settings page - Usuários tab)
- Create, edit (name, phone, address), delete, and block/unblock driving schools
- Delete solicitations with confirmation
- Transfer candidates between driving schools
- Reset any user's password to default (key icon in users table)
- Access to all statistics and reports

### Password Management
- **Default Password:** New driving school users are created with default password "123456"
- **Password Change:** All logged-in users can change their password via sidebar dropdown menu → "Alterar Senha"
- **Admin Reset:** Admins can reset any user's password to default "123456" via Settings → Usuários tab (key icon)
- **Security:** All passwords hashed with bcrypt, minimum 6 characters required for new passwords
- **Validation:** Zod schemas validate password change and registration requests server-side
- **Audit Trail:** Password changes and resets are logged in audit trail

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
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID`: Replit Object Storage bucket ID (configured automatically)
- `GEMINI_API_KEY`: Google Gemini API key for document OCR (optional, enables automatic form filling)

### Replit-Specific Integrations
- `@replit/vite-plugin-runtime-error-modal`: Error overlay in development
- `@replit/vite-plugin-cartographer`: Development tooling
- `@replit/vite-plugin-dev-banner`: Development indicator

### Object Storage Integration
- **Purpose:** Store document files externally instead of base64 in database
- **Service:** Replit Object Storage (in Replit) or Local File Storage (in VPS/self-hosted)
- **Environment Detection:** Automatic - uses Replit Object Storage if REPL_ID and DEFAULT_OBJECT_STORAGE_BUCKET_ID are set, otherwise uses local storage
- **Routes:**
  - `POST /api/documents/request-upload-url`: Get upload URL with token binding
  - `PUT /api/uploads/:uploadId`: Direct file upload (local/VPS mode only, requires valid token)
  - `POST /api/documents/save`: Save document metadata after upload (validates token)
  - `GET /api/documents/:id/download`: Download document (supports both object storage and legacy base64)
  - `GET /objects/*`: Serve files from storage (requires auth + ACL check)
- **Security Model:**
  - Token binding system validates upload requests belong to authorized users
  - ACL policies set on files with owner verification
  - One-time use tokens with 15-minute expiration
- **Database Schema:** documents table has `fileKey` (object path) and `fileData` (nullable, legacy base64)
- **Backward Compatibility:** Existing base64 documents continue to work during gradual migration
- **Local Storage Path:** Configured via `LOCAL_STORAGE_PATH` env var (default: `./uploads`)

### VPS/Self-Hosted Deployment
- **Documentation:** See `DEPLOY.md` for complete deployment guide to VPS (Hostinger, etc.)
- **Environment:** See `.env.example` for all required environment variables
- **Key Files:**
  - `server/storage_adapter.ts`: Storage adapter that auto-detects environment
  - `server/local_storage/`: Local file storage implementation for VPS

### Document OCR Integration
- **Purpose:** Automatically extract data from ID documents (RG, CNH) to pre-fill solicitation forms
- **Service:** Google Gemini AI (gemini-2.5-flash model)
- **Routes:**
  - `GET /api/documents/ocr-status`: Check if OCR is available (returns {available: boolean})
  - `POST /api/documents/analyze`: Analyze document image and extract data
- **Extracted Fields:** nome, cpf, rg, dataNascimento, sexo, nomeMae, nomePai, nacionalidade, naturalidade, ufNascimento
- **Frontend:** OCR upload component only appears when GEMINI_API_KEY is configured
- **Location:** `server/gemini.ts` (Gemini integration), `client/src/pages/solicitations/new.tsx` (UI)

### Document Authenticity Verification
- **Purpose:** Detect document fraud by analyzing visual elements and PDF metadata
- **Service:** Google Gemini AI (gemini-2.5-flash model) + pdf-lib for metadata extraction
- **Routes:**
  - `POST /api/documents/:id/verify-authenticity`: Analyze document for fraud indicators (operador/admin only)
- **Visual Analysis:**
  - Font consistency and typography
  - Alignment and layout irregularities
  - Image quality and editing artifacts
  - Security elements (watermarks, holograms)
  - Data consistency
- **PDF Metadata Analysis:**
  - Detects suspicious software (Canva, Photoshop, GIMP, Paint, etc.)
  - Flags suspicious authors (gráficas, casas de impressão)
  - Checks for modifications after creation
  - Flags very recent creation dates
  - Analyzes suspicious keywords
- **Response:** Returns risk level (BAIXO/MEDIO/ALTO), confidence score, suspicious points, detailed analysis, and recommendation (APROVAR/SOLICITAR_NOVO_DOCUMENTO/INVESTIGAR)
- **Frontend:** "Verificar Autenticidade" button in document viewer (operador/admin only), modal with detailed results including PDF metadata display
- **Location:** `server/gemini.ts` (analyzeDocumentAuthenticity, extractPdfMetadata), `client/src/pages/solicitations/detail.tsx` (UI)