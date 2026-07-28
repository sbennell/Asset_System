import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { requireAuth, requireAdmin } from './auth.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB - generous for a spreadsheet, bounds memory use
});

// Apply auth to all routes - admin only for import
router.use(requireAuth);
router.use(requireAdmin);

const VALID_STATUS = [
  'Planned',
  'In Use',
  'In Use - Infrastructure',
  'In Use - Loaned to student',
  'In Use - Loaned to staff',
  'Awaiting allocation',
  'Awaiting delivery',
  'Awaiting collection',
  'Waiting Repair',
  'Decommissioned',
  'Decommissioned - Beyond service age',
  'Decommissioned - Damaged',
  'Decommissioned - Stolen',
  'Decommissioned - In storage',
  'Decommissioned - User left',
  'Decommissioned - Written Off',
  'Decommissioned - Unreturned'
];

const VALID_CONDITION = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];

// Compliance/governance fields are export-only for now (see COLUMNS/rowData below) -
// bulk import of these fields is not yet supported, so no VALID_* arrays are needed here.
// Mirrors apps/web/src/lib/utils.ts label maps - duplicated here to keep the API
// package independent of the web package for a handful of small enum labels.
const CRITICALITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CROWN_JEWEL: 'Critical'
};

const DATA_CLASSIFICATION_LABELS: Record<string, string> = {
  PUBLIC: 'Public',
  INTERNAL: 'Business Use',
  SENSITIVE: 'Confidential',
  RESTRICTED: 'Restricted'
};

const HOSTING_LABELS: Record<string, string> = {
  ON_PREM: 'On-Premises',
  SCHOOL_CLOUD: 'School Managed Cloud',
  MACS_CLOUD: 'MACS Managed Cloud',
  THIRD_PARTY_CLOUD: 'Third-Party Managed Cloud',
  DET_HOSTED: 'DET Managed Hosted'
};

const SUPPORT_LABELS: Record<string, string> = {
  IN_HOUSE: 'In-house IT',
  SAAS: 'SaaS',
  VENDOR: 'Vendor Supported'
};

// Column configuration for Excel
const COLUMNS = [
  { header: 'Item Number *', key: 'itemNumber', width: 15 },
  { header: 'Serial Number', key: 'serialNumber', width: 18 },
  { header: 'Manufacturer', key: 'manufacturer', width: 20 },
  { header: 'Model', key: 'model', width: 20 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Description', key: 'description', width: 30 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Condition', key: 'condition', width: 12 },
  { header: 'Acquired Date', key: 'acquiredDate', width: 14 },
  { header: 'Purchase Price', key: 'purchasePrice', width: 14 },
  { header: 'Supplier', key: 'supplier', width: 20 },
  { header: 'Order Number', key: 'orderNumber', width: 15 },
  { header: 'Hostname', key: 'hostname', width: 18 },
  { header: 'Device Username', key: 'deviceUsername', width: 16 },
  { header: 'Device Password', key: 'devicePassword', width: 16 },
  { header: 'LAN MAC', key: 'lanMacAddress', width: 18 },
  { header: 'WLAN MAC', key: 'wlanMacAddress', width: 18 },
  { header: 'IP Address', key: 'ipAddress', width: 15 },
  { header: 'IP Address Label', key: 'ipAddressLabel', width: 18 },
  { header: 'IP Address 2', key: 'ipAddress2', width: 15 },
  { header: 'IP Address 2 Label', key: 'ipAddress2Label', width: 18 },
  { header: 'IP Address 3', key: 'ipAddress3', width: 15 },
  { header: 'IP Address 3 Label', key: 'ipAddress3Label', width: 18 },
  { header: 'IP Address 4', key: 'ipAddress4', width: 15 },
  { header: 'IP Address 4 Label', key: 'ipAddress4Label', width: 18 },
  { header: 'IP Address 5', key: 'ipAddress5', width: 15 },
  { header: 'IP Address 5 Label', key: 'ipAddress5Label', width: 18 },
  { header: 'Assigned To', key: 'assignedTo', width: 20 },
  { header: 'Location', key: 'location', width: 20 },
  { header: 'Warranty Expiration', key: 'warrantyExpiration', width: 18 },
  { header: 'End of Life Date', key: 'endOfLifeDate', width: 16 },
  { header: 'Last Review Date', key: 'lastReviewDate', width: 16 },
  { header: 'Decommission Date', key: 'decommissionDate', width: 18 },
  { header: 'Comments', key: 'comments', width: 30 },
  { header: 'Business Purpose', key: 'businessPurpose', width: 30 },
  { header: 'Business Owner', key: 'businessOwner', width: 20 },
  { header: 'Technical Owner', key: 'technicalOwner', width: 20 },
  { header: 'Version', key: 'version', width: 14 },
  { header: 'Criticality', key: 'criticalityTier', width: 14 },
  { header: 'Data Classification', key: 'dataClassification', width: 16 },
  { header: 'Hosting', key: 'hostingType', width: 20 },
  { header: 'Support Type', key: 'supportType', width: 16 },
  { header: 'Internet Facing', key: 'internetFacing', width: 14 }
];

// Column configuration for the MACS Asset Register export - just the minimum
// required fields from the MACS IT Security Asset Management Standard, in the
// order the standard lists them, so the sheet can be handed to an auditor as-is.
const MACS_COLUMNS = [
  { header: 'Unique ID', key: 'itemNumber', width: 15 },
  { header: 'Type of Asset', key: 'category', width: 20 },
  { header: 'Business Purpose / Function', key: 'businessPurpose', width: 30 },
  { header: 'Business Owner', key: 'businessOwner', width: 20 },
  { header: 'Technical Owner', key: 'technicalOwner', width: 20 },
  { header: 'Date of Acquisition / Implementation', key: 'acquiredDate', width: 20 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Date of Decommissioning / Disposal', key: 'decommissionDate', width: 20 },
  { header: 'Supplier', key: 'supplier', width: 20 },
  { header: 'Version', key: 'version', width: 14 },
  { header: 'End-of-Life Support Date', key: 'endOfLifeDate', width: 18 },
  { header: 'Criticality Category', key: 'criticalityTier', width: 16 },
  { header: 'Data Classification', key: 'dataClassification', width: 16 },
  { header: 'Hosting', key: 'hostingType', width: 20 },
  { header: 'Support', key: 'supportType', width: 16 },
  { header: 'Internet Facing / Accessible', key: 'internetFacing', width: 16 },
  { header: 'Supporting Notes', key: 'comments', width: 30 }
];

// Column configuration for the MACS Software Asset Register sheet - same minimum
// required field set as MACS_COLUMNS, sourced from the Software model instead of
// Asset, plus a Name column (software's "Title" per the standard) since Type of
// Asset alone (a software category) isn't enough to identify a specific item.
const SOFTWARE_MACS_COLUMNS = [
  { header: 'Unique ID', key: 'itemNumber', width: 15 },
  { header: 'Name', key: 'name', width: 25 },
  { header: 'Type of Asset', key: 'category', width: 20 },
  { header: 'Business Purpose / Function', key: 'businessPurpose', width: 30 },
  { header: 'Business Owner', key: 'businessOwner', width: 20 },
  { header: 'Technical Owner', key: 'technicalOwner', width: 20 },
  { header: 'Date of Acquisition / Implementation', key: 'initialInstallDate', width: 20 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Date of Decommissioning / Disposal', key: 'decommissionDate', width: 20 },
  { header: 'Supplier', key: 'supplier', width: 20 },
  { header: 'Version', key: 'version', width: 14 },
  { header: 'End-of-Life Support Date', key: 'licenseExpiration', width: 18 },
  { header: 'Criticality Category', key: 'criticalityTier', width: 16 },
  { header: 'Data Classification', key: 'dataClassification', width: 16 },
  { header: 'Hosting', key: 'hostingType', width: 20 },
  { header: 'Support', key: 'supportType', width: 16 },
  { header: 'Internet Facing / Accessible', key: 'internetFacing', width: 16 },
  { header: 'Supporting Notes', key: 'comments', width: 30 }
];

// GET /api/import/template - Download Excel template with dropdowns
router.get('/template', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    // Fetch existing lookups from database
    const [manufacturers, categories, suppliers, locations] = await Promise.all([
      prisma.manufacturer.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.category.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.supplier.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.location.findMany({ select: { name: true }, orderBy: { name: 'asc' } })
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'IT Management System (ITMS)';
    workbook.created = new Date();

    // Create main data sheet first (so it's the active sheet when opened)
    const dataSheet = workbook.addWorksheet('Asset Import');

    // Create README sheet with instructions
    const readmeSheet = workbook.addWorksheet('README');
    readmeSheet.getColumn('A').width = 80;

    const instructions = [
      ['Asset Import Template - Instructions'],
      [''],
      ['GETTING STARTED'],
      ['1. Go to the "Asset Import" sheet to enter your asset data'],
      ['2. Fill in one asset per row, starting from row 2 (row 1 has headers)'],
      ['3. Save the file and upload it in Settings > Data Import / Export'],
      [''],
      ['REQUIRED FIELDS'],
      ['- Item Number: Must be unique for each asset (marked with *)'],
      [''],
      ['DROPDOWN FIELDS (click cell to see options)'],
      ['- Status: ACTIVE, INACTIVE, DISPOSED, IN_REPAIR'],
      ['- Condition: NEW, GOOD, FAIR, POOR, DAMAGED'],
      ['- Manufacturer: Select from existing or type new (will be created)'],
      ['- Category: Select from existing or type new (will be created)'],
      ['- Supplier: Select from existing or type new (will be created)'],
      ['- Location: Select from existing or type new (will be created)'],
      [''],
      ['IP ADDRESS FIELDS'],
      ['- IP Address: The primary IP address (first one listed)'],
      ['- IP Address Label: Optional label for the primary IP (e.g., "LAN", "WLAN", "Management")'],
      ['- IP Address 2-5: Optional additional IP addresses'],
      ['- IP Address 2-5 Label: Optional labels for additional IPs'],
      ['- On import, the first IP becomes primary. Additional IPs can also be added via these columns'],
      ['- Leave additional IP columns blank if not needed'],
      [''],
      ['DATE FIELDS (use format: YYYY-MM-DD)'],
      ['- Acquired Date: When the asset was purchased/acquired'],
      ['- Warranty Expiration: When warranty expires'],
      ['- End of Life Date: Planned end of life for the asset'],
      ['- Last Review Date: When the asset was last reviewed/verified'],
      ['- Decommission Date: When the asset was decommissioned'],
      [''],
      ['IMPORT OPTIONS (in the web application)'],
      ['- Skip duplicates: Skip rows where Item Number already exists'],
      ['- Update existing: Update existing assets that match by Item Number'],
      ['- Default (neither checked): Error on duplicate Item Numbers'],
      [''],
      ['TIPS'],
      ['- You can import up to 500 assets at a time'],
      ['- New manufacturers, categories, suppliers, and locations are created automatically'],
      ['- Leave optional fields blank if not applicable'],
      ['- The Purchase Price field accepts numbers (e.g., 1234.56)'],
      ['- Each asset can have up to 5 IP addresses (columns: IP Address through IP Address 5)'],
      ['- All IP addresses can have optional labels (e.g., "LAN", "WLAN", "Management") in their respective Label columns'],
      ['- When importing, the first IP (IP Address column) becomes the primary IP'],
      ['- When updating existing assets, all IPs in the import will replace existing IPs, with the first IP as primary'],
      ['- All IP addresses and labels are preserved on export and round-trip import'],
      ['- Additional IPs can also be managed through the Asset Edit form in the application']
    ];

    instructions.forEach((row, index) => {
      const cell = readmeSheet.getCell(`A${index + 1}`);
      cell.value = row[0];
      if (index === 0) {
        cell.font = { bold: true, size: 14, color: { argb: 'FF4472C4' } };
      } else if (row[0]?.match(/^[A-Z]/) && !row[0]?.startsWith('-')) {
        cell.font = { bold: true };
      }
    });

    // Create hidden Lookups sheet last
    const lookupsSheet = workbook.addWorksheet('Lookups', { state: 'hidden' });

    // Populate lookups sheet
    // Column A: Manufacturers
    lookupsSheet.getColumn('A').values = ['Manufacturers', ...manufacturers.map(m => m.name)];
    // Column B: Categories
    lookupsSheet.getColumn('B').values = ['Categories', ...categories.map(c => c.name)];
    // Column C: Suppliers
    lookupsSheet.getColumn('C').values = ['Suppliers', ...suppliers.map(s => s.name)];
    // Column D: Locations
    lookupsSheet.getColumn('D').values = ['Locations', ...locations.map(l => l.name)];
    // Column E: Status
    lookupsSheet.getColumn('E').values = ['Status', ...VALID_STATUS];
    // Column F: Condition
    lookupsSheet.getColumn('F').values = ['Condition', ...VALID_CONDITION];
    dataSheet.columns = COLUMNS;

    // Style header row
    const headerRow = dataSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 20;

    // Add data validation dropdowns for rows 2-500
    const maxRows = 500;

    for (let row = 2; row <= maxRows; row++) {
      // Manufacturer dropdown (column C)
      if (manufacturers.length > 0) {
        dataSheet.getCell(`C${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`Lookups!$A$2:$A$${manufacturers.length + 1}`],
          showErrorMessage: true
        };
      }

      // Category dropdown (column E)
      if (categories.length > 0) {
        dataSheet.getCell(`E${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`Lookups!$B$2:$B$${categories.length + 1}`],
          showErrorMessage: true
        };
      }

      // Status dropdown (column G)
      dataSheet.getCell(`G${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Lookups!$E$2:$E$${VALID_STATUS.length + 1}`],
        showErrorMessage: true
      };

      // Condition dropdown (column H)
      dataSheet.getCell(`H${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Lookups!$F$2:$F$${VALID_CONDITION.length + 1}`],
        showErrorMessage: true
      };

      // Supplier dropdown (column K)
      if (suppliers.length > 0) {
        dataSheet.getCell(`K${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`Lookups!$C$2:$C$${suppliers.length + 1}`],
          showErrorMessage: true
        };
      }

      // Location dropdown (column T)
      if (locations.length > 0) {
        dataSheet.getCell(`T${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`Lookups!$D$2:$D$${locations.length + 1}`],
          showErrorMessage: true
        };
      }

      // Date format for date columns
      dataSheet.getCell(`I${row}`).numFmt = 'yyyy-mm-dd';
      dataSheet.getCell(`U${row}`).numFmt = 'yyyy-mm-dd';
      dataSheet.getCell(`V${row}`).numFmt = 'yyyy-mm-dd';
      dataSheet.getCell(`W${row}`).numFmt = 'yyyy-mm-dd';
      dataSheet.getCell(`X${row}`).numFmt = 'yyyy-mm-dd';

      // Number format for price
      dataSheet.getCell(`J${row}`).numFmt = '#,##0.00';
    }

    // Freeze header row
    dataSheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Return as Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="asset-import-template.xlsx"');
    res.send(buffer);

  } catch (error: any) {
    console.error('Template error:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// Helper to parse date strings
function parseDate(dateStr: string | Date | undefined | null): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  const str = String(dateStr).trim();
  if (str === '') return null;
  const date = new Date(str);
  if (isNaN(date.getTime())) return null;
  return date;
}

// Helper to parse number strings
function parseNumber(numStr: string | number | undefined | null): number | null {
  if (numStr === null || numStr === undefined) return null;
  if (typeof numStr === 'number') return numStr;
  const str = String(numStr).trim();
  if (str === '') return null;
  const num = parseFloat(str);
  if (isNaN(num)) return null;
  return num;
}

// Resolve a compliance-field cell (which may contain either the raw enum key,
// e.g. "LOW", or the human label exported for it, e.g. "Low") back to its key.
// Accepts round-tripped exports as well as hand-typed values in either form.
function resolveEnumValue(
  labelMap: Record<string, string>,
  input: string | undefined | null
): { value: string | null; invalid?: string } {
  if (!input) return { value: null };
  const trimmed = String(input).trim();
  if (trimmed === '') return { value: null };

  const keyMatch = Object.keys(labelMap).find((k) => k.toLowerCase() === trimmed.toLowerCase());
  if (keyMatch) return { value: keyMatch };

  const labelMatch = Object.entries(labelMap).find(([, label]) => label.toLowerCase() === trimmed.toLowerCase());
  if (labelMatch) return { value: labelMatch[0] };

  return { value: null, invalid: trimmed };
}

// Helper to get cell value as string
function getCellString(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) return String(value.text).trim();
  if (typeof value === 'object' && 'result' in value) return String(value.result).trim();
  return String(value).trim();
}

// POST /api/import/assets - Import assets from Excel or CSV
router.post('/assets', upload.single('file'), async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const skipDuplicates = req.query.skipDuplicates === 'true';
  const updateExisting = req.query.updateExisting === 'true';

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    let records: any[] = [];
    const isExcel = req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    req.file.originalname?.endsWith('.xlsx');

    if (isExcel) {
      // Parse Excel file
      const workbook = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(req.file.buffer as any);
      const worksheet = workbook.worksheets.find(ws => ws.name === 'Asset Import') || workbook.worksheets[0];

      if (!worksheet) {
        return res.status(400).json({ error: 'No worksheet found in Excel file' });
      }

      // Get header row to map columns
      const headerRow = worksheet.getRow(1);
      const columnMap: { [key: string]: number } = {};
      headerRow.eachCell((cell, colNumber) => {
        const header = getCellString(cell).toLowerCase().replace(/[^a-z0-9]/g, '');
        // Map header to column key
        if (header.includes('itemnumber')) columnMap['itemNumber'] = colNumber;
        else if (header.includes('serialnumber')) columnMap['serialNumber'] = colNumber;
        else if (header.includes('manufacturer')) columnMap['manufacturer'] = colNumber;
        else if (header.includes('model')) columnMap['model'] = colNumber;
        else if (header.includes('category')) columnMap['category'] = colNumber;
        else if (header.includes('description')) columnMap['description'] = colNumber;
        else if (header.includes('status')) columnMap['status'] = colNumber;
        else if (header.includes('condition')) columnMap['condition'] = colNumber;
        else if (header.includes('acquireddate') || header.includes('acquired')) columnMap['acquiredDate'] = colNumber;
        else if (header.includes('purchaseprice') || header.includes('price')) columnMap['purchasePrice'] = colNumber;
        else if (header.includes('supplier')) columnMap['supplier'] = colNumber;
        else if (header.includes('ordernumber') || header.includes('order')) columnMap['orderNumber'] = colNumber;
        else if (header.includes('hostname')) columnMap['hostname'] = colNumber;
        else if (header.includes('deviceusername') || header.includes('username')) columnMap['deviceUsername'] = colNumber;
        else if (header.includes('devicepassword') || header.includes('password')) columnMap['devicePassword'] = colNumber;
        else if (header.includes('lanmac') || header === 'lanmac') columnMap['lanMacAddress'] = colNumber;
        else if (header.includes('wlanmac') || header === 'wlanmac') columnMap['wlanMacAddress'] = colNumber;
        else if (header.includes('ipaddress5') || header === 'ipaddress5') columnMap['ipAddress5'] = colNumber;
        else if (header.includes('ipaddress5label')) columnMap['ipAddress5Label'] = colNumber;
        else if (header.includes('ipaddress4') || header === 'ipaddress4') columnMap['ipAddress4'] = colNumber;
        else if (header.includes('ipaddress4label')) columnMap['ipAddress4Label'] = colNumber;
        else if (header.includes('ipaddress3') || header === 'ipaddress3') columnMap['ipAddress3'] = colNumber;
        else if (header.includes('ipaddress3label')) columnMap['ipAddress3Label'] = colNumber;
        else if (header.includes('ipaddress2') || header === 'ipaddress2') columnMap['ipAddress2'] = colNumber;
        else if (header.includes('ipaddress2label')) columnMap['ipAddress2Label'] = colNumber;
        else if (header.includes('ipaddresslabel')) columnMap['ipAddressLabel'] = colNumber;
        else if (header.includes('ipaddress') || header === 'ip') columnMap['ipAddress'] = colNumber;
        else if (header.includes('assignedto') || header.includes('assigned')) columnMap['assignedTo'] = colNumber;
        else if (header.includes('location')) columnMap['location'] = colNumber;
        else if (header.includes('warrantyexpiration') || header.includes('warranty')) columnMap['warrantyExpiration'] = colNumber;
        else if (header.includes('endoflife') || header.includes('eol')) columnMap['endOfLifeDate'] = colNumber;
        else if (header.includes('lastreviewdate') || header.includes('reviewed')) columnMap['lastReviewDate'] = colNumber;
        else if (header.includes('decommissiondate') || header.includes('decommissioned')) columnMap['decommissionDate'] = colNumber;
        else if (header.includes('comments') || header.includes('notes')) columnMap['comments'] = colNumber;
        else if (header.includes('businesspurpose')) columnMap['businessPurpose'] = colNumber;
        else if (header.includes('businessowner')) columnMap['businessOwner'] = colNumber;
        else if (header.includes('technicalowner')) columnMap['technicalOwner'] = colNumber;
        else if (header.includes('version')) columnMap['version'] = colNumber;
        else if (header.includes('criticality')) columnMap['criticalityTier'] = colNumber;
        else if (header.includes('dataclassification')) columnMap['dataClassification'] = colNumber;
        else if (header.includes('hosting')) columnMap['hostingType'] = colNumber;
        else if (header.includes('supporttype')) columnMap['supportType'] = colNumber;
        else if (header.includes('internetfacing')) columnMap['internetFacing'] = colNumber;
      });

      // Parse data rows
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const record: any = {};
        for (const [key, colNum] of Object.entries(columnMap)) {
          const cell = row.getCell(colNum);
          if (key === 'acquiredDate' || key === 'warrantyExpiration' || key === 'endOfLifeDate' || key === 'lastReviewDate' || key === 'decommissionDate') {
            record[key] = cell.value;
          } else if (key === 'purchasePrice') {
            record[key] = cell.value;
          } else {
            record[key] = getCellString(cell);
          }
        }

        // Only add non-empty rows
        if (record.itemNumber) {
          records.push(record);
        }
      });

    } else {
      // Parse CSV file
      const csvContent = req.file.buffer.toString('utf-8');
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    }

    if (records.length === 0) {
      return res.status(400).json({ error: 'File is empty or has no data rows' });
    }

    // Cache for lookups to avoid repeated queries
    const manufacturerCache = new Map<string, string>();
    const categoryCache = new Map<string, string>();
    const supplierCache = new Map<string, string>();
    const locationCache = new Map<string, string>();

    // Pre-load existing lookups
    const [manufacturers, categories, suppliers, locations] = await Promise.all([
      prisma.manufacturer.findMany({ select: { id: true, name: true } }),
      prisma.category.findMany({ select: { id: true, name: true } }),
      prisma.supplier.findMany({ select: { id: true, name: true } }),
      prisma.location.findMany({ select: { id: true, name: true } })
    ]);

    manufacturers.forEach(m => manufacturerCache.set(m.name.toLowerCase(), m.id));
    categories.forEach(c => categoryCache.set(c.name.toLowerCase(), c.id));
    suppliers.forEach(s => supplierCache.set(s.name.toLowerCase(), s.id));
    locations.forEach(l => locationCache.set(l.name.toLowerCase(), l.id));

    // Helper to get or create lookup
    async function getOrCreateLookup(
      cache: Map<string, string>,
      name: string | undefined,
      createFn: (name: string) => Promise<{ id: string }>
    ): Promise<string | null> {
      if (!name || String(name).trim() === '') return null;
      const normalizedName = String(name).trim().toLowerCase();

      if (cache.has(normalizedName)) {
        return cache.get(normalizedName)!;
      }

      const created = await createFn(String(name).trim());
      cache.set(normalizedName, created.id);
      return created.id;
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as { row: number; message: string }[]
    };

    // Process each row
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // +2 for 1-indexed and header row

      try {
        const itemNumber = String(row.itemNumber || '').trim();

        // Validate required fields
        if (!itemNumber) {
          results.errors.push({ row: rowNum, message: 'Item Number is required' });
          continue;
        }

        const statusInput = String(row.status || '').trim();
        const conditionInput = String(row.condition || '').trim().toUpperCase();

        // Validate and normalize status (case-insensitive match)
        let status = '';
        if (statusInput) {
          const matchedStatus = VALID_STATUS.find(s => s.toLowerCase() === statusInput.toLowerCase());
          if (!matchedStatus) {
            results.errors.push({
              row: rowNum,
              message: `Invalid status "${row.status}". Must be one of: ${VALID_STATUS.join(', ')}`
            });
            continue;
          }
          status = matchedStatus;
        }

        // Validate condition if provided
        if (conditionInput && !VALID_CONDITION.includes(conditionInput)) {
          results.errors.push({
            row: rowNum,
            message: `Invalid condition "${row.condition}". Must be one of: ${VALID_CONDITION.join(', ')}`
          });
          continue;
        }

        // Validate and resolve compliance/governance enum fields (accepts either the
        // raw key or the human label exported for it, so re-importing an export round-trips)
        const criticalityResolved = resolveEnumValue(CRITICALITY_LABELS, row.criticalityTier);
        if (criticalityResolved.invalid) {
          results.errors.push({
            row: rowNum,
            message: `Invalid criticality "${criticalityResolved.invalid}". Must be one of: ${Object.values(CRITICALITY_LABELS).join(', ')}`
          });
          continue;
        }

        const dataClassificationResolved = resolveEnumValue(DATA_CLASSIFICATION_LABELS, row.dataClassification);
        if (dataClassificationResolved.invalid) {
          results.errors.push({
            row: rowNum,
            message: `Invalid data classification "${dataClassificationResolved.invalid}". Must be one of: ${Object.values(DATA_CLASSIFICATION_LABELS).join(', ')}`
          });
          continue;
        }

        const hostingResolved = resolveEnumValue(HOSTING_LABELS, row.hostingType);
        if (hostingResolved.invalid) {
          results.errors.push({
            row: rowNum,
            message: `Invalid hosting "${hostingResolved.invalid}". Must be one of: ${Object.values(HOSTING_LABELS).join(', ')}`
          });
          continue;
        }

        const supportResolved = resolveEnumValue(SUPPORT_LABELS, row.supportType);
        if (supportResolved.invalid) {
          results.errors.push({
            row: rowNum,
            message: `Invalid support type "${supportResolved.invalid}". Must be one of: ${Object.values(SUPPORT_LABELS).join(', ')}`
          });
          continue;
        }

        let internetFacing: boolean | null = null;
        const internetFacingInput = String(row.internetFacing || '').trim().toLowerCase();
        if (internetFacingInput) {
          if (['yes', 'y', 'true'].includes(internetFacingInput)) {
            internetFacing = true;
          } else if (['no', 'n', 'false'].includes(internetFacingInput)) {
            internetFacing = false;
          } else {
            results.errors.push({
              row: rowNum,
              message: `Invalid internet facing value "${row.internetFacing}". Must be Yes or No.`
            });
            continue;
          }
        }

        // Check for existing asset
        const existingAsset = await prisma.asset.findUnique({
          where: { itemNumber }
        });

        // Get or create lookups
        const manufacturerId = await getOrCreateLookup(
          manufacturerCache,
          row.manufacturer,
          (name) => prisma.manufacturer.create({ data: { name } })
        );
        const categoryId = await getOrCreateLookup(
          categoryCache,
          row.category,
          (name) => prisma.category.create({ data: { name } })
        );
        const supplierId = await getOrCreateLookup(
          supplierCache,
          row.supplier,
          (name) => prisma.supplier.create({ data: { name } })
        );
        const locationId = await getOrCreateLookup(
          locationCache,
          row.location,
          (name) => prisma.location.create({ data: { name } })
        );

        // Collect all IP addresses and labels
        const ips: Array<{ ip: string; label: string | null }> = [];
        const ipAddressStr = String(row.ipAddress || '').trim();
        if (ipAddressStr) {
          const primaryLabel = String(row.ipAddressLabel || '').trim() || null;
          ips.push({ ip: ipAddressStr, label: primaryLabel }); // Primary IP
        }
        // Add additional IPs
        for (let ipNum = 2; ipNum <= 5; ipNum++) {
          const ipStr = String(row[`ipAddress${ipNum}` as keyof typeof row] || '').trim();
          if (ipStr) {
            const label = String(row[`ipAddress${ipNum}Label` as keyof typeof row] || '').trim() || null;
            ips.push({ ip: ipStr, label });
          }
        }

        const assetData = {
          serialNumber: String(row.serialNumber || '').trim() || null,
          manufacturerId,
          model: String(row.model || '').trim() || null,
          categoryId,
          description: String(row.description || '').trim() || null,
          status: status || (existingAsset?.status || 'In Use'),
          condition: conditionInput || (existingAsset?.condition || 'GOOD'),
          acquiredDate: parseDate(row.acquiredDate),
          purchasePrice: parseNumber(row.purchasePrice),
          supplierId,
          orderNumber: String(row.orderNumber || '').trim() || null,
          hostname: String(row.hostname || '').trim() || null,
          deviceUsername: String(row.deviceUsername || '').trim() || null,
          devicePassword: String(row.devicePassword || '').trim() || null,
          lanMacAddress: String(row.lanMacAddress || '').trim() || null,
          wlanMacAddress: String(row.wlanMacAddress || '').trim() || null,
          assignedTo: String(row.assignedTo || '').trim() || null,
          locationId,
          warrantyExpiration: parseDate(row.warrantyExpiration),
          endOfLifeDate: parseDate(row.endOfLifeDate),
          lastReviewDate: parseDate(row.lastReviewDate),
          decommissionDate: parseDate(row.decommissionDate),
          comments: String(row.comments || '').trim() || null,
          businessPurpose: String(row.businessPurpose || '').trim() || null,
          businessOwner: String(row.businessOwner || '').trim() || null,
          technicalOwner: String(row.technicalOwner || '').trim() || null,
          version: String(row.version || '').trim() || null,
          criticalityTier: criticalityResolved.value,
          dataClassification: dataClassificationResolved.value,
          hostingType: hostingResolved.value,
          supportType: supportResolved.value,
          internetFacing
        };

        if (existingAsset) {
          if (updateExisting) {
            // Update the asset
            await prisma.asset.update({
              where: { id: existingAsset.id },
              data: assetData
            });

            // If any IPs are provided, replace all IPs
            if (ips.length > 0) {
              await prisma.assetIP.deleteMany({ where: { assetId: existingAsset.id } });
              // Create new IP entries
              for (let i = 0; i < ips.length; i++) {
                await prisma.assetIP.create({
                  data: {
                    assetId: existingAsset.id,
                    ip: ips[i].ip,
                    label: ips[i].label
                  }
                });
              }
            }

            results.updated++;
          } else if (skipDuplicates) {
            results.skipped++;
          } else {
            results.errors.push({
              row: rowNum,
              message: `Asset with Item Number "${itemNumber}" already exists`
            });
          }
          continue;
        }

        // Create new asset with optional IPs
        await prisma.asset.create({
          data: {
            itemNumber,
            ...assetData,
            ...(ips.length > 0 && {
              ipAddresses: {
                create: ips.map((ipData) => ({
                  ip: ipData.ip,
                  label: ipData.label
                }))
              }
            })
          }
        });
        results.created++;

      } catch (error: any) {
        results.errors.push({
          row: rowNum,
          message: error.message || 'Unknown error'
        });
      }
    }

    res.json(results);

  } catch (error: any) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import assets: ' + error.message });
  }
});

// GET /api/import/export - Export all assets to Excel
router.get('/export', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const assets = await prisma.asset.findMany({
      include: {
        manufacturer: true,
        category: true,
        supplier: true,
        location: true,
        ipAddresses: true,
        student: true
      },
      orderBy: { itemNumber: 'asc' }
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'IT Management System (ITMS)';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Assets');
    worksheet.columns = COLUMNS;

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 20;

    // Add data rows
    for (const asset of assets) {
      // Get all IPs
      const sortedIPs = asset.ipAddresses || [];

      const rowData: any = {
        itemNumber: asset.itemNumber,
        serialNumber: asset.serialNumber,
        manufacturer: asset.manufacturer?.name,
        model: asset.model,
        category: asset.category?.name,
        description: asset.description,
        status: asset.status,
        condition: asset.condition,
        acquiredDate: asset.acquiredDate,
        purchasePrice: asset.purchasePrice,
        supplier: asset.supplier?.name,
        orderNumber: asset.orderNumber,
        hostname: asset.hostname,
        deviceUsername: asset.deviceUsername,
        devicePassword: asset.devicePassword,
        lanMacAddress: asset.lanMacAddress,
        wlanMacAddress: asset.wlanMacAddress,
        ipAddress: sortedIPs[0]?.ip || null,
        ipAddressLabel: sortedIPs[0]?.label || null,
        assignedTo: asset.student
          ? `${asset.student.firstName} ${asset.student.surname}`
          : asset.assignedTo,
        location: asset.location?.name,
        warrantyExpiration: asset.warrantyExpiration,
        endOfLifeDate: asset.endOfLifeDate,
        lastReviewDate: asset.lastReviewDate,
        decommissionDate: asset.decommissionDate,
        comments: asset.comments,
        businessPurpose: asset.businessPurpose,
        businessOwner: asset.businessOwner,
        technicalOwner: asset.technicalOwner,
        version: asset.version,
        criticalityTier: asset.criticalityTier ? (CRITICALITY_LABELS[asset.criticalityTier] ?? asset.criticalityTier) : null,
        dataClassification: asset.dataClassification ? (DATA_CLASSIFICATION_LABELS[asset.dataClassification] ?? asset.dataClassification) : null,
        hostingType: asset.hostingType ? (HOSTING_LABELS[asset.hostingType] ?? asset.hostingType) : null,
        supportType: asset.supportType ? (SUPPORT_LABELS[asset.supportType] ?? asset.supportType) : null,
        internetFacing: asset.internetFacing === null ? null : (asset.internetFacing ? 'Yes' : 'No')
      };

      // Add additional IPs
      for (let i = 1; i < sortedIPs.length && i < 5; i++) {
        rowData[`ipAddress${i + 1}`] = sortedIPs[i].ip;
        rowData[`ipAddress${i + 1}Label`] = sortedIPs[i].label;
      }

      worksheet.addRow(rowData);
    }

    // Format date columns
    worksheet.getColumn('acquiredDate').numFmt = 'yyyy-mm-dd';
    worksheet.getColumn('warrantyExpiration').numFmt = 'yyyy-mm-dd';
    worksheet.getColumn('endOfLifeDate').numFmt = 'yyyy-mm-dd';
    worksheet.getColumn('lastReviewDate').numFmt = 'yyyy-mm-dd';
    worksheet.getColumn('decommissionDate').numFmt = 'yyyy-mm-dd';
    worksheet.getColumn('purchasePrice').numFmt = '#,##0.00';

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `assets-export-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export assets' });
  }
});

// GET /api/import/export-macs - Export the MACS Asset Register minimum required fields only
router.get('/export-macs', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const assets = await prisma.asset.findMany({
      include: {
        category: true,
        supplier: true
      },
      orderBy: { itemNumber: 'asc' }
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'IT Management System (ITMS)';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Hardware');
    worksheet.columns = MACS_COLUMNS;

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 20;

    for (const asset of assets) {
      worksheet.addRow({
        itemNumber: asset.itemNumber,
        category: asset.category?.name,
        businessPurpose: asset.businessPurpose,
        businessOwner: asset.businessOwner,
        technicalOwner: asset.technicalOwner,
        acquiredDate: asset.acquiredDate,
        status: asset.status,
        decommissionDate: asset.decommissionDate,
        supplier: asset.supplier?.name,
        version: asset.version,
        endOfLifeDate: asset.endOfLifeDate,
        criticalityTier: asset.criticalityTier ? (CRITICALITY_LABELS[asset.criticalityTier] ?? asset.criticalityTier) : null,
        dataClassification: asset.dataClassification ? (DATA_CLASSIFICATION_LABELS[asset.dataClassification] ?? asset.dataClassification) : null,
        hostingType: asset.hostingType ? (HOSTING_LABELS[asset.hostingType] ?? asset.hostingType) : null,
        supportType: asset.supportType ? (SUPPORT_LABELS[asset.supportType] ?? asset.supportType) : null,
        internetFacing: asset.internetFacing === null ? null : (asset.internetFacing ? 'Yes' : 'No'),
        comments: asset.comments
      });
    }

    // Format date columns
    worksheet.getColumn('acquiredDate').numFmt = 'yyyy-mm-dd';
    worksheet.getColumn('decommissionDate').numFmt = 'yyyy-mm-dd';
    worksheet.getColumn('endOfLifeDate').numFmt = 'yyyy-mm-dd';

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Software sheet - same minimum MACS fields, sourced from the Software register
    const software = await prisma.software.findMany({
      include: {
        category: true,
        supplier: true
      },
      orderBy: { itemNumber: 'asc' }
    });

    const softwareSheet = workbook.addWorksheet('Software');
    softwareSheet.columns = SOFTWARE_MACS_COLUMNS;

    const softwareHeaderRow = softwareSheet.getRow(1);
    softwareHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    softwareHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    softwareHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
    softwareHeaderRow.height = 20;

    for (const item of software) {
      softwareSheet.addRow({
        itemNumber: item.itemNumber,
        name: item.name,
        category: item.category?.name,
        businessPurpose: item.businessPurpose,
        businessOwner: item.businessOwner,
        technicalOwner: item.technicalOwner,
        initialInstallDate: item.initialInstallDate,
        status: item.status,
        decommissionDate: item.decommissionDate,
        supplier: item.supplier?.name,
        version: item.version,
        licenseExpiration: item.licenseExpiration,
        criticalityTier: item.criticalityTier ? (CRITICALITY_LABELS[item.criticalityTier] ?? item.criticalityTier) : null,
        dataClassification: item.dataClassification ? (DATA_CLASSIFICATION_LABELS[item.dataClassification] ?? item.dataClassification) : null,
        hostingType: item.hostingType ? (HOSTING_LABELS[item.hostingType] ?? item.hostingType) : null,
        supportType: item.supportType ? (SUPPORT_LABELS[item.supportType] ?? item.supportType) : null,
        internetFacing: item.internetFacing === null ? null : (item.internetFacing ? 'Yes' : 'No'),
        comments: item.comments
      });
    }

    softwareSheet.getColumn('initialInstallDate').numFmt = 'yyyy-mm-dd';
    softwareSheet.getColumn('decommissionDate').numFmt = 'yyyy-mm-dd';
    softwareSheet.getColumn('licenseExpiration').numFmt = 'yyyy-mm-dd';
    softwareSheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `macs-asset-register-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (error: any) {
    console.error('MACS export error:', error);
    res.status(500).json({ error: 'Failed to export MACS asset register' });
  }
});

export default router;
