# Version History

All notable changes to the Asset Management System are documented in this file.

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
- Direct printing to Brother QL-500 label printers (DK-22211 29mm tape)
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
