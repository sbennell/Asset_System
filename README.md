# IT Management System (ITMS)

**Version 1.28.12**

A web-based IT Management System for tracking hardware and equipment inventory, plus a separate software/license register. Built with React, Express, and SQLite.

## Features

### Asset Management
- **Asset Tracking**: Track IT assets including computers, monitors, printers, and other equipment
- **Detailed Records**: Store item numbers, serial numbers, models, manufacturers, and more
- **Custom Fields**: Track hostname, IP address, assigned users, and locations
- **Status Tracking**: Monitor asset status (Planned, In Use, In Storage, Retired, etc.)
- **Condition Tracking**: Track asset condition (Excellent, Good, Fair, Poor)
- **Compliance / Governance Fields**: Track business purpose, business/technical owner, version, criticality tier, data classification, hosting location, support type, and internet-facing status per asset (supports MACS Asset Management Standard compliance)
- **Audit History**: View complete change history for each asset

### Software Management
- **Separate Software Register**: A dedicated "Software" section in the sidebar, distinct from hardware Assets, with its own list/detail/add/edit pages and per-user permission toggle
- **Licensing & Deployment Tracking**: Publisher, category, version, URL, app store, deployment mechanism, license expiration, license count, and supplier
- **Same Compliance / Governance Fields**: Business purpose, business/technical owner, criticality, data classification, hosting, support type, and internet-facing status - the same taxonomy used for hardware assets
- **File Attachments**: Upload and download license documents, quotes, or other files per software item (PDF, Word, Excel, PNG, JPEG)
- **Audit History**: View complete change history for each software item
- **Software Import/Export**: Admin-only Excel export of the full software register, and import from Excel/CSV (with auto-created Publisher/Category/Supplier lookups) - re-uploading a downloaded export round-trips all fields, including compliance/governance data

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
- **Printable Condition Barcodes**: Print an A4 sheet of scannable condition QR codes, including a "No Change" code to clear the lock, to lock a condition (Single Asset or Continuous mode) while scanning assets

### Reports & Analytics
- **Warranty Expiry Report**: Track warranty expiration status with timeline charts and expiration alerts
- **Fleet Health Report**: Analyze asset condition distribution across the fleet
- **Asset Value Report**: Monitor total fleet value, cost per category, and financial breakdown
- **Age & Lifecycle Report**: Track asset age, purchase history, and end-of-life dates
- **Interactive Charts**: Visual analytics with bar charts, line charts, and data visualizations
- **Filterable Reports**: Filter all reports by category, location, manufacturer, and report-specific criteria
- **Summary Metrics**: Key performance indicators and summary statistics for each report

### IP Address Manager
- **Network Configuration**: Define and manage subnets with CIDR notation (e.g., `192.168.1.0/24`)
- **IP Browser**: View all IP addresses in a subnet with real-time status (Linked/Free)
- **Asset Linking**: Link existing assets to IP addresses or quickly create new assets with pre-filled IPs
- **Hostname Discovery**: View device hostnames alongside IP addresses for network identification
- **Search & Link Modal**: Debounced search to find and link assets to IP addresses
- **Performance Optimized**: Support for large subnets up to /20 (4094 IPs)

### Student Management
- **Student Records**: Maintain comprehensive student database with personal and account details
- **CSV Import**: Automated student data import with flexible column mapping
- **Flexible Search**: Advanced search by name, email, username, and full-name matching
- **Asset Assignment**: Link assets to students with automatic reconciliation by name
- **School Customization**: Conditional fields based on school type (Standard or Department of Education)
- **Import Automation**: File watcher for automatic imports when student data changes
- **Quick View**: Student detail pages with assigned assets and account information

### Data Management
- **Import/Export**: Import assets from Excel/CSV, export to Excel
- **MACS Asset Register Export**: One-click export of just the minimum fields required by the MACS IT Security Asset Management Standard, in the standard's order
- **Bulk Operations**: Perform batch updates on multiple assets
- **Search & Filter**: Find assets by any field with advanced filtering
- **Sorting**: Sort by any column with natural number ordering
- **Pagination**: Configurable page sizes (50, 100, 200, 500, 1000, All)

### Lookup Tables
- **Add, Rename & Delete**: Every lookup table below supports inline renaming in addition to adding and deleting entries
- **Categories**: Organize assets by type (Laptop, Desktop, Monitor, etc.)
- **Manufacturers**: Track device manufacturers
- **Locations**: Define physical locations for assets
- **Suppliers**: Manage vendor/supplier information (shared between hardware and software)
- **Software Publishers & Categories**: Separate lookup tables for organizing the software register

### User Management
- **Authentication**: Secure login with session management
- **Role-Based Access**: Admin and User roles
- **Per-User Feature Permissions**: Scope a User account to just the areas it needs - Assets (incl. label printing), Software, Students, Stocktake, Reports & Network/IPAM - plus independent toggles for viewing stored device passwords and student passwords
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
- **Recharts** - Data visualization and charts

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

### Quick Install (Windows)

Run the following command in PowerShell as Administrator:

```powershell
irm "https://raw.githubusercontent.com/sbennell/ITMS/refs/heads/main/install.ps1" | iex
```

The script handles everything: directory setup, dependencies, build, database, Windows service, firewall, scheduled tasks, and backups.

### Manual Installation

For step-by-step manual installation instructions, see [Manual Installation Guide](doc/MANUAL_INSTALL.md).

### First Login

On first login, enter any username and password to create the initial admin account.

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

### Reports
- `GET /api/reports/warranty` - Warranty expiration analytics
- `GET /api/reports/condition` - Asset condition distribution and fleet health
- `GET /api/reports/value` - Asset financial value and cost analysis
- `GET /api/reports/lifecycle` - Asset age and end-of-life tracking

### Network / IP Address Manager
- `GET /api/network/subnets` - List all configured subnets
- `POST /api/network/subnets` - Create subnet (admin-only)
- `PUT /api/network/subnets/:id` - Update subnet (admin-only)
- `DELETE /api/network/subnets/:id` - Delete subnet (admin-only)
- `GET /api/network/subnets/:id/ips` - Get all IPs in subnet with asset associations

### Students
- `GET /api/students` - List students (with pagination, filtering, sorting)
- `GET /api/students/:id` - Get single student with assigned assets
- `GET /api/students/search?q=` - Search students by name, email, username
- `GET /api/students/statuses` - Get available student statuses
- `GET /api/students/year-levels` - Get school year levels
- `GET /api/students/home-groups` - Get home groups
- `POST /api/students/import/run` - Trigger manual student import
- `POST /api/students/reconcile-assets` - Link assets to students by name matching

### Lookups
- `GET /api/lookups/categories` - List categories
- `GET /api/lookups/manufacturers` - List manufacturers
- `GET /api/lookups/locations` - List locations
- `GET /api/lookups/suppliers` - List suppliers

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Check auth status

### Public (no authentication)
- `GET /api/public/asset-by-serial/:serialNumber` - Look up an asset's item number by serial number. Returns only `{ itemNumber }`. Intentionally unauthenticated so device-side scripts (e.g. asset-tag lockscreen tooling) that run as SYSTEM with no stored credentials can call it; rate-limited to 30 requests/minute per IP.

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
