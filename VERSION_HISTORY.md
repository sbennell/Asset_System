# Version History

All notable changes to the Asset Management System are documented in this file.

---

## [1.5.0] - 2026-02-14

### New Features

- **Active Status Filter**: New default "Active" filter on the asset list excludes all Decommissioned assets
  - "All Statuses" option available to show everything including decommissioned
  - Individual status filters still available
- **Auto Item Number**: Item Number field is automatically prefilled with the next available number when creating a new asset
  - Scans all existing item numbers and suggests the next highest value
- **Adobe Reader Install**: Install script now installs Adobe Reader via Chocolatey
  - Required by `pdf-to-printer` for label printing on Windows

---

## [1.4.0] - 2026-02-14

### New Features

- **About Dialog**: Clicking version or update notification opens an About modal
  - Displays current version, changelog summary parsed from GitHub, and copyright info
  - Links to GitHub repository and full changelog
  - Admin users can trigger updates directly from the modal
  - Non-admin users see a link to GitHub releases

### Bug Fixes

- **Update Lock File**: Fixed `update.lock` not being deleted after web update completes
  - Lock file now removed before service restart to avoid script-on-disk changes from `git pull` corrupting the `finally` block
  - `finally` block retained as safety net for failure cases

### Changes

- Sidebar version text is replaced by "Update to vX.X.X" notification when an update is available
- Update confirmation moved from browser `confirm()` dialog to the About modal
- Removed hardcoded default credentials from install script; first login creates the admin account
- Updated README with one-line install command and link to manual install guide
- Updated MANUAL_INSTALL.md with Chocolatey NSSM install, web update instructions, and scheduled task setup

---

## [1.3.2] - 2026-02-14

### Bug Fixes

- **Web Update Process Fix**: Fixed update script being killed when NSSM stops the service
  - NSSM uses Windows Job Objects to kill the entire process tree when stopping the service
  - Update now runs via Windows Task Scheduler, fully independent of the NSSM service
  - Reuses existing `update.ps1` with new `-AutoUpdate` parameter (skips confirmation, logs to file)
  - Scheduled task created during installation via `install.ps1`
  - `update.ps1` try/finally block ensures service restart and lock file cleanup even on failure

---

## [1.3.1] - 2026-02-13

### Bug Fixes

- **Login Fix**: Fixed issue where users had to log in twice after application boot
  - Login now sets auth data directly in the query cache instead of relying on a background refetch
  - Eliminates race condition between navigation and auth status check
- **Web Update Fix**: Fixed 500 error when triggering update from web interface
  - Ensures logs directory is created automatically if it doesn't exist
  - Improved error messages for easier debugging

---

## [1.3.0] - 2026-02-13

### New Features

- **Web-Based Update**: Admins can trigger system updates directly from the web interface
  - "Update to v{x.y.z}" button appears in sidebar when a new version is detected
  - Shows full-page overlay with progress spinner during update
  - Automatically reloads the page when the update completes and service restarts
  - Backs up database, pulls code, rebuilds, and restarts service automatically
  - Update logs saved to server logs directory
  - Only available to admin users in production mode
- **Brother QL Printer Support**: Updated from QL-500 only to support all Brother QL printer models
  - Users select their specific printer model from the available printers list in Settings
  - Label format unchanged (DK-22211, 29mm continuous tape)
- **NSSM via Chocolatey**: Install script now uses `choco install nssm` instead of direct download from nssm.cc (more reliable)
- **dotenv Support**: Production server now loads `.env` file via dotenv as fallback for environment variables

### Changes

- Default printer name no longer hardcoded to "Brother QL-500" - users must select their printer
- Version bumped across all files (root package.json, README, useVersionCheck)

---

## [1.2.1] - 2025-02-11

### New Features

- **Version Update Check**: Automatically checks GitHub for newer versions
  - Compares current app version against latest in VERSION_HISTORY.md on GitHub
  - Shows animated notification badge in sidebar when an update is available
  - Links to GitHub releases page for easy download
  - Checks once per hour in the background
- **Version Link**: Version number in sidebar now links to VERSION_HISTORY.md on GitHub
- **Update Script**: Added `update.ps1` PowerShell script for one-command updates from GitHub
  - Checks for available updates before proceeding
  - Automatic database backup before updating
  - Pulls latest code, installs dependencies, rebuilds, and restarts service
  - Supports custom install path, branch selection, and skip options

---

## [1.2.0] - 2025-02-11

### Security Enhancement

- **Password Protection**: Device passwords on asset detail page now require account password verification before revealing
  - Click Eye icon next to masked password to trigger verification prompt
  - User must enter their own account password to confirm identity
  - Password is re-hidden when clicking the EyeOff icon
  - Added `/verify-password` API endpoint for secure password verification

---

## [1.1.1] - 2025-02-11

### Bug Fixes

- **Print Preview Modal**: Updated preview layout to match v1.1.0 label changes
  - Assigned To name now shown centered at top
  - QR code centered vertically in middle section
  - All text fields now display in bold
  - Layout accurately reflects printed label output

---

## [1.1.0] - 2025-02-11

### Label Printing Improvements

Enhanced label layout and text formatting for better readability.

#### Changes
- **Assigned To Name**: Now centered at top of label with auto-fit sizing (14pt max, 7pt min)
- **Item Number**: Bold text at 9pt
- **Model**: Auto-fit to available width (8pt max, 5pt min) - no truncation
- **All Label Text**: Now uses bold font throughout
- **Organization Name**: Auto-fit to fill label width (14pt max, 6pt min)
- **QR Code**: Centered vertically on full label height
- **Text Spacing**: Increased gap between QR code and text fields

#### Layout
```
┌─────────────────────────────────────────┐
│         Assigned To Name (centered)     │
│ [QR]  Item: 1234                        │
│ [QR]  Manufacturer Model                │
│ [QR]  S/N: ABC123                       │
│ [QR]  hostname                          │
│ [QR]  192.168.1.100                     │
├─────────────────────────────────────────┤
│      Organization Name (centered)       │
└─────────────────────────────────────────┘
```

---

## [1.0.0] - 2025-02-11

### Initial Release

First production release of the Asset Management System.

### Features

#### Asset Management
- Create, read, update, and delete IT assets
- Track item numbers, serial numbers, models, and manufacturers
- Store hostname, IP address, MAC addresses, and device credentials
- Assign assets to users and locations
- Track asset status (In Use, In Storage, Retired, etc.)
- Track asset condition (Excellent, Good, Fair, Poor)
- Record purchase information (price, supplier, order number)
- Set warranty and end-of-life dates
- View complete audit history for each asset

#### Label Printing
- Generate QR code labels for asset identification
- Direct printing to Brother QL label printers (DK-22211 29mm tape)
- Print single labels from asset detail page
- Batch print labels for multiple assets
- Download labels as PDF for manual printing
- Configurable label content (Assigned To, Hostname, IP Address)
- Organization name displayed on all labels

#### Stocktake
- Create stocktake sessions for inventory audits
- Filter stocktake by category or location
- Quick verify assets by scanning QR codes
- Track verification progress in real-time
- Update asset condition during stocktake
- Add notes to verified assets
- Complete or cancel stocktake sessions

#### Data Management
- Import assets from Excel (.xlsx) or CSV files
- Export all assets to Excel
- Download import template with correct format
- Configurable page sizes (50, 100, 200, 500, 1000, All)
- Search across all asset fields
- Filter by status, category, manufacturer, or location
- Sort by any column with natural number ordering

#### Lookup Tables
- Categories - Organize assets by type
- Manufacturers - Track device manufacturers
- Locations - Define physical locations
- Suppliers - Manage vendor information

#### User Management
- Secure authentication with session management
- Role-based access control (Admin, User)
- Admin can create, edit, and disable users
- Password change functionality
- Secure password hashing with bcrypt

#### Settings
- Configure organization name for labels
- Select default label printer
- Set default label field visibility

### Technical Stack
- Frontend: React 18, TypeScript, Vite, TailwindCSS
- Backend: Node.js, Express, TypeScript, Prisma
- Database: SQLite
- Label Generation: pdf-lib, bwip-js, pdf-to-printer

---

## Future Versions

_Planned features and improvements will be documented here as they are released._
