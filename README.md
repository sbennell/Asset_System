# Asset System

A web-based IT Asset Management System built with React, Express, and MySQL.

## Features

- Full asset lifecycle management (create, read, update, delete)
- Search and filter assets by status, category, manufacturer, location
- Generate barcode labels (QR Code, Data Matrix, Code128, Aztec)
- Print-ready label templates
- Manage categories, manufacturers, suppliers, and locations
- Audit trail for all changes
- Simple password-based authentication

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, TanStack Query, TanStack Table
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: MySQL 8.0+
- **Barcodes**: bwip-js

## Prerequisites

- Node.js 20+ LTS
- MySQL 8.0+

## Setup

### 1. Clone and Install Dependencies

```bash
cd Asset_System
npm install
```

### 2. Set Up MySQL Database

Create a new MySQL database:

```sql
CREATE DATABASE asset_system;
```

### 3. Configure Environment

Create the API environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` with your MySQL credentials:

```
DATABASE_URL="mysql://root:yourpassword@localhost:3306/asset_system"
SESSION_SECRET="change-this-to-a-random-string"
```

### 4. Initialize Database

```bash
cd apps/api
npm run db:push
```

This creates all the database tables.

### 5. Start Development Servers

From the root directory:

```bash
npm run dev
```

This starts both the API (port 3001) and the web app (port 5173).

Open http://localhost:5173 in your browser.

### 6. First Login

On your first login, enter a password of your choice. This will be saved as your application password.

## Docker Deployment

### Quick Start with Docker

Build and run the application:

```bash
docker-compose up --build
```

Run in background:

```bash
docker-compose up -d
```

The API will be available at http://localhost:3001

### Configuration

Set environment variables in `docker-compose.yml` or create a `.env` file:

```
SESSION_SECRET=your-secure-secret-here
```

### Data Persistence

SQLite data is persisted in a Docker volume (`asset_data`). To backup:

```bash
docker cp $(docker-compose ps -q app):/app/data/asset_system.db ./backup.db
```

### Stopping

```bash
docker-compose down
```

To remove data volume as well:

```bash
docker-compose down -v
```

## Project Structure

```
Asset_System/
├── apps/
│   ├── api/                  # Express backend
│   │   ├── prisma/           # Database schema
│   │   └── src/
│   │       ├── routes/       # API endpoints
│   │       └── index.ts      # Server entry
│   └── web/                  # React frontend
│       └── src/
│           ├── components/   # Reusable components
│           ├── pages/        # Page components
│           └── lib/          # Utilities & API client
├── package.json              # Workspace root
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Check auth status

### Assets
- `GET /api/assets` - List assets (with pagination, search, filters)
- `GET /api/assets/:id` - Get single asset
- `POST /api/assets` - Create asset
- `PUT /api/assets/:id` - Update asset
- `DELETE /api/assets/:id` - Delete asset

### Lookups
- `GET /api/lookups/categories` - List categories
- `POST /api/lookups/categories` - Create category
- `GET /api/lookups/manufacturers` - List manufacturers
- `GET /api/lookups/suppliers` - List suppliers
- `GET /api/lookups/locations` - List locations

### Labels
- `GET /api/labels/barcode/:id` - Generate barcode image
- `GET /api/labels/preview/:id` - Get label data
- `POST /api/labels/batch` - Generate multiple labels

## Data Migration

To migrate data from the original Access database, a migration script will be provided. The script reads from `Asset_System.accdb` and imports records into MySQL.

## License

Private - Internal Use Only
