# Asset Management System

**Version 1.4.0**

A web-based IT asset management system for tracking hardware, software, and equipment inventory. Built with React, Express, and SQLite.

## Features

### Asset Management
- **Asset Tracking**: Track IT assets including computers, monitors, printers, and other equipment
- **Detailed Records**: Store item numbers, serial numbers, models, manufacturers, and more
- **Custom Fields**: Track hostname, IP address, assigned users, and locations
- **Status Tracking**: Monitor asset status (In Use, In Storage, Retired, etc.)
- **Condition Tracking**: Track asset condition (Excellent, Good, Fair, Poor)
- **Audit History**: View complete change history for each asset

### Label Printing
- **QR Code Labels**: Generate labels with QR codes for easy asset identification
- **Brother QL Printer Support**: Direct printing to Brother QL label printers (DK-22211 29mm tape)
- **Batch Printing**: Print labels for multiple assets at once
- **PDF Download**: Download labels as PDF for manual printing
- **Customizable Content**: Choose which fields to display on labels (Assigned To, Hostname, IP Address)

### Stocktake
- **Inventory Audits**: Create stocktake sessions to verify asset locations
- **QR Code Scanning**: Quickly verify assets by scanning QR codes
- **Progress Tracking**: Monitor verification progress in real-time
- **Condition Updates**: Update asset condition during stocktake

### Data Management
- **Import/Export**: Import assets from Excel/CSV, export to Excel
- **Bulk Operations**: Perform batch updates on multiple assets
- **Search & Filter**: Find assets by any field with advanced filtering
- **Sorting**: Sort by any column with natural number ordering
- **Pagination**: Configurable page sizes (50, 100, 200, 500, 1000, All)

### Lookup Tables
- **Categories**: Organize assets by type (Laptop, Desktop, Monitor, etc.)
- **Manufacturers**: Track device manufacturers
- **Locations**: Define physical locations for assets
- **Suppliers**: Manage vendor/supplier information

### User Management
- **Authentication**: Secure login with session management
- **Role-Based Access**: Admin and User roles
- **User Administration**: Create, edit, and disable user accounts
- **Password Management**: Secure password hashing with bcrypt

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **TanStack Query** - Data fetching and caching
- **TanStack Table** - Data tables
- **React Router** - Navigation
- **React Hook Form** - Form handling
- **Lucide React** - Icons

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **Prisma** - Database ORM
- **SQLite** - Database
- **bcryptjs** - Password hashing
- **express-session** - Session management

### Label Generation
- **pdf-lib** - PDF generation
- **bwip-js** - Barcode/QR code generation
- **pdf-to-printer** - Windows printing support

## Installation

### Prerequisites
- Node.js 18+
- npm 9+

### Setup

1. Clone the repository:
```bash
git clone https://github.com/your-repo/asset-system.git
cd asset-system
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cd apps/api
cp .env.example .env
```

Edit `apps/api/.env` with your settings:
```env
# Database connection string (SQLite)
DATABASE_URL="file:./dev.db"

# Server port
PORT=3001

# Session secret (change this in production!)
SESSION_SECRET="your-secret-key-change-in-production"
```

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `file:./dev.db` (SQLite) |
| `PORT` | API server port | `3001` |
| `SESSION_SECRET` | Secret key for session encryption | Must be changed in production |

4. Initialize the database:
```bash
npx prisma generate
npx prisma db push
```

5. Start the development server:
```bash
npm run dev
```

6. Open http://localhost:5173 in your browser

### Default Login
- **Username**: admin
- **Password**: admin123

*Change the default password after first login!*

## Updating

### Automatic Update (Production)
Run the update script as Administrator on the server:
```powershell
.\update.ps1
```

The script will:
- Check GitHub for available updates
- Back up the database before updating
- Pull latest code from GitHub
- Install/update dependencies
- Run database migrations
- Rebuild the application
- Restart the Windows service

Options:
```powershell
.\update.ps1 -InstallPath "D:\AssetSystem"   # Custom install path
.\update.ps1 -Branch "develop"                # Pull from a different branch
.\update.ps1 -SkipBackup                      # Skip database backup
.\update.ps1 -SkipService                     # Skip service restart
```

### Manual Update (Development)
```bash
git pull origin main
npm install
cd apps/api
npx prisma generate
npx prisma db push
cd ../..
npm run build
```

## Configuration

### Organization Name
Set your organization name in Settings > Organization. This appears on printed labels.

### Label Printer
Configure your label printer in Settings > Label Settings:
- Select printer from available Windows printers
- Configure default field visibility

### Database
The SQLite database is stored at `apps/api/prisma/dev.db`. Back up this file regularly.

## Project Structure

```
Asset_System/
├── apps/
│   ├── api/                 # Backend Express API
│   │   ├── prisma/          # Database schema and migrations
│   │   └── src/
│   │       ├── routes/      # API endpoints
│   │       └── services/    # Business logic
│   └── web/                 # Frontend React app
│       └── src/
│           ├── components/  # Reusable UI components
│           ├── lib/         # Utilities and API client
│           └── pages/       # Page components
└── package.json             # Root workspace config
```

## API Endpoints

### Assets
- `GET /api/assets` - List assets (with pagination, filtering, sorting)
- `GET /api/assets/:id` - Get single asset
- `POST /api/assets` - Create asset
- `PUT /api/assets/:id` - Update asset
- `DELETE /api/assets/:id` - Delete asset

### Labels
- `GET /api/labels/preview/:assetId` - Get QR code preview
- `GET /api/labels/download/:assetId` - Download label PDF
- `POST /api/labels/print/:assetId` - Print single label
- `POST /api/labels/print-batch` - Print multiple labels
- `GET /api/labels/download-batch` - Download batch PDF

### Stocktake
- `GET /api/stocktakes` - List stocktakes
- `POST /api/stocktakes` - Create stocktake
- `POST /api/stocktakes/:id/quick-verify` - Verify asset by QR scan

### Lookups
- `GET /api/lookups/categories` - List categories
- `GET /api/lookups/manufacturers` - List manufacturers
- `GET /api/lookups/locations` - List locations
- `GET /api/lookups/suppliers` - List suppliers

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Check auth status

## Label Format

Labels are designed for Brother QL label printers with DK-22211 (29mm continuous tape):

```
┌─────────────────────────────────────────┐
│ [QR]  Assigned To Name                  │
│ [QR]  Item: 1234                        │
│ [QR]  Manufacturer Model                │
│ [QR]  S/N: ABC123                       │
│ [QR]  hostname                          │
│ [QR]  192.168.1.100                     │
├─────────────────────────────────────────┤
│         Organization Name               │
└─────────────────────────────────────────┘
```

The QR code contains all label information for scanning during stocktake.

## Browser Support

- Chrome (recommended)
- Firefox
- Edge
- Safari

## License

Proprietary - All rights reserved

## Support

For issues and feature requests, please contact your system administrator.

---

*Built with care for IT asset management*
