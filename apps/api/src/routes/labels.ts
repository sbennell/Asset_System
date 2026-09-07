import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin, requirePermission, requireAnyPermission } from './auth.js';
import {
  createLabelPDF as createBrotherPDF,
  createLabelPreview as createBrotherPreview,
  createConditionSheetPDF,
  printLabel as printBrother,
  getAvailablePrinters,
  parseSettings,
  settingsToKeyValue,
  LabelAsset,
  LabelSettings,
} from '../services/labelService.js';
import {
  createLabelPDF as createDymoPDF,
  createLabelPreview as createDymoPreview,
  printLabel as printDymo,
  buildDymoLabelXml,
  buildDymoLabelManagerXml,
} from '../services/labelService-dymo.js';

const DYMO_LABEL_TYPES = new Set(['dymo-1933081', 'dymo-labelmanager']);

const router = Router();

// Get label preview as PNG image
router.get('/preview/:assetId', requireAuth, requirePermission('canAccessAssets'), async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const assetId = req.params.assetId as string;

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { manufacturer: true, ipAddresses: true, student: true },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Get label settings
    const settingsRecords = await prisma.settings.findMany({
      where: {
        key: { in: ['label.labelType', 'label.showAssignedTo', 'label.showHostname', 'label.showIpAddress', 'label.qrCodeContent'] },
      },
    });
    const settingsMap: Record<string, string> = {};
    settingsRecords.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });
    const settings = parseSettings(settingsMap);
    const labelTypeOverride = req.query.labelType as 'brother-dk22211' | 'dymo-1933081' | 'dymo-labelmanager' | undefined;
    const finalSettings = { ...settings, ...(labelTypeOverride !== undefined && { labelType: labelTypeOverride }) };

    // Resolve first IP (all IPs are equal now)
    const primaryIP = asset.ipAddresses?.[0]?.ip;

    // Construct assignedTo: use assignedTo if set, otherwise construct from student name
    let assignedTo = asset.assignedTo;
    if (!assignedTo && asset.student) {
      assignedTo = `${asset.student.firstName} ${asset.student.surname}`;
    }

    // Select correct preview function based on label type
    const createLabelPreview = DYMO_LABEL_TYPES.has(finalSettings.labelType) ? createDymoPreview : createBrotherPreview;
    const previewBuffer = await createLabelPreview({ ...asset, ipAddress: primaryIP, assignedTo } as LabelAsset, finalSettings);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="label-${asset.itemNumber}.png"`);
    res.send(previewBuffer);
  } catch (error) {
    console.error('Label preview error:', error);
    res.status(500).json({ error: 'Failed to generate label preview' });
  }
});

// Print single asset label
router.post('/print/:assetId', requireAuth, requirePermission('canAccessAssets'), async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const assetId = req.params.assetId as string;
    const { copies = 1, showAssignedTo, showHostname, showIpAddress, qrCodeContent, labelType } = req.body;

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { manufacturer: true, ipAddresses: true, student: true },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Get label settings and organization name
    const settingsRecords = await prisma.settings.findMany({
      where: {
        key: { in: ['label.labelType', 'label.printerName', 'label.showAssignedTo', 'label.showHostname', 'label.showIpAddress', 'label.qrCodeContent', 'organization'] },
      },
    });
    const settingsMap: Record<string, string> = {};
    settingsRecords.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });
    const settings = parseSettings(settingsMap);
    const organizationName = settingsMap['organization'] || null;

    // Override settings from request body if provided
    const finalSettings = {
      ...settings,
      ...(labelType !== undefined && { labelType }),
      ...(showAssignedTo !== undefined && { showAssignedTo }),
      ...(showHostname !== undefined && { showHostname }),
      ...(showIpAddress !== undefined && { showIpAddress }),
      ...(qrCodeContent !== undefined && { qrCodeContent }),
    };

    // Select correct service based on label type
    const isDymo = DYMO_LABEL_TYPES.has(finalSettings.labelType);
    const createLabelPDF = isDymo ? createDymoPDF : createBrotherPDF;
    const printLabel = isDymo ? printDymo : printBrother;

    // Resolve first IP (all IPs are equal now)
    const primaryIP = asset.ipAddresses?.[0]?.ip;

    // Construct assignedTo: use assignedTo if set, otherwise construct from student name
    let assignedTo = asset.assignedTo;
    if (!assignedTo && asset.student) {
      assignedTo = `${asset.student.firstName} ${asset.student.surname}`;
    }

    // Generate and print label
    const labelAsset: LabelAsset = { ...asset, ipAddress: primaryIP, organizationName, assignedTo };
    const pdfBytes = await createLabelPDF(labelAsset, finalSettings);

    for (let i = 0; i < copies; i++) {
      await printLabel(pdfBytes, settings.printerName);
    }

    res.json({
      success: true,
      message: `Printed ${copies} label(s) for ${asset.itemNumber}`,
    });
  } catch (error) {
    console.error('Label print error:', error);
    res.status(500).json({
      error: 'Failed to print label',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Print batch of labels
router.post('/print-batch', requireAuth, requirePermission('canAccessAssets'), async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const { assetIds, copies = 1, showAssignedTo, showHostname, showIpAddress, qrCodeContent, labelType } = req.body;

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ error: 'assetIds array is required' });
    }

    // Get label settings and organization name
    const settingsRecords = await prisma.settings.findMany({
      where: {
        key: { in: ['label.labelType', 'label.printerName', 'label.showAssignedTo', 'label.showHostname', 'label.showIpAddress', 'label.qrCodeContent', 'organization'] },
      },
    });
    const settingsMap: Record<string, string> = {};
    settingsRecords.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });
    const settings = parseSettings(settingsMap);
    const organizationName = settingsMap['organization'] || null;

    // Override settings from request body if provided
    const finalSettings = {
      ...settings,
      ...(labelType !== undefined && { labelType }),
      ...(showAssignedTo !== undefined && { showAssignedTo }),
      ...(showHostname !== undefined && { showHostname }),
      ...(showIpAddress !== undefined && { showIpAddress }),
      ...(qrCodeContent !== undefined && { qrCodeContent }),
    };

    // Select correct service based on label type
    const isDymo = DYMO_LABEL_TYPES.has(finalSettings.labelType);
    const createLabelPDF = isDymo ? createDymoPDF : createBrotherPDF;
    const printLabel = isDymo ? printDymo : printBrother;

    // Fetch all assets
    const assets = await prisma.asset.findMany({
      where: { id: { in: assetIds } },
      include: { manufacturer: true, ipAddresses: true, student: true },
    });

    let printed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const asset of assets) {
      try {
        // Resolve first IP (all IPs are equal now)
        const primaryIP = asset.ipAddresses?.[0]?.ip;

        // Construct assignedTo: use assignedTo if set, otherwise construct from student name
        let assignedTo = asset.assignedTo;
        if (!assignedTo && asset.student) {
          assignedTo = `${asset.student.firstName} ${asset.student.surname}`;
        }

        const labelAsset: LabelAsset = { ...asset, ipAddress: primaryIP, organizationName, assignedTo };
        const pdfBytes = await createLabelPDF(labelAsset, finalSettings);
        for (let i = 0; i < copies; i++) {
          await printLabel(pdfBytes, settings.printerName);
        }
        printed++;
      } catch (error) {
        failed++;
        errors.push(`${asset.itemNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Check for assets not found
    const foundIds = assets.map(a => a.id);
    const notFoundIds = assetIds.filter((id: string) => !foundIds.includes(id));
    if (notFoundIds.length > 0) {
      failed += notFoundIds.length;
      errors.push(`Assets not found: ${notFoundIds.length}`);
    }

    res.json({
      success: failed === 0,
      printed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Batch print error:', error);
    res.status(500).json({ error: 'Failed to print labels' });
  }
});

// Download batch of labels as combined PDF
router.get('/download-batch', requireAuth, requirePermission('canAccessAssets'), async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const assetIdsParam = req.query.assetIds as string;

    if (!assetIdsParam) {
      return res.status(400).json({ error: 'assetIds parameter is required' });
    }

    const assetIds = assetIdsParam.split(',');

    // Get optional query params for settings override
    const showAssignedTo = req.query.showAssignedTo !== undefined ? req.query.showAssignedTo === 'true' : undefined;
    const showHostname = req.query.showHostname !== undefined ? req.query.showHostname === 'true' : undefined;
    const showIpAddress = req.query.showIpAddress !== undefined ? req.query.showIpAddress === 'true' : undefined;
    const qrCodeContent = req.query.qrCodeContent as 'full' | 'itemNumber' | undefined;
    const labelType = req.query.labelType as 'brother-dk22211' | 'dymo-1933081' | 'dymo-labelmanager' | undefined;

    // Get label settings and organization name
    const settingsRecords = await prisma.settings.findMany({
      where: {
        key: { in: ['label.labelType', 'label.printerName', 'label.showAssignedTo', 'label.showHostname', 'label.showIpAddress', 'label.qrCodeContent', 'organization'] },
      },
    });
    const settingsMap: Record<string, string> = {};
    settingsRecords.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });
    const settings = parseSettings(settingsMap);
    const organizationName = settingsMap['organization'] || null;

    // Override settings from query params if provided
    const finalSettings = {
      ...settings,
      ...(labelType !== undefined && { labelType }),
      ...(showAssignedTo !== undefined && { showAssignedTo }),
      ...(showHostname !== undefined && { showHostname }),
      ...(showIpAddress !== undefined && { showIpAddress }),
      ...(qrCodeContent !== undefined && { qrCodeContent }),
    };

    // Select correct service based on label type
    const isDymo = DYMO_LABEL_TYPES.has(finalSettings.labelType);
    const createLabelPDF = isDymo ? createDymoPDF : createBrotherPDF;

    // Fetch all assets
    const assets = await prisma.asset.findMany({
      where: { id: { in: assetIds } },
      include: { manufacturer: true, ipAddresses: true, student: true },
    });

    if (assets.length === 0) {
      return res.status(404).json({ error: 'No assets found' });
    }

    // Generate all label PDFs and combine them
    const { PDFDocument } = await import('pdf-lib');
    const combinedPdf = await PDFDocument.create();

    for (const asset of assets) {
      // Resolve first IP (all IPs are equal now)
      const primaryIP = asset.ipAddresses?.[0]?.ip;

      // Construct assignedTo: use assignedTo if set, otherwise construct from student name
      let assignedTo = asset.assignedTo;
      if (!assignedTo && asset.student) {
        assignedTo = `${asset.student.firstName} ${asset.student.surname}`;
      }

      const labelAsset: LabelAsset = { ...asset, ipAddress: primaryIP, organizationName, assignedTo };
      const pdfBytes = await createLabelPDF(labelAsset, finalSettings);
      const labelPdf = await PDFDocument.load(pdfBytes);
      const [page] = await combinedPdf.copyPages(labelPdf, [0]);
      combinedPdf.addPage(page);
    }

    const combinedBytes = await combinedPdf.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="labels-batch-${assets.length}.pdf"`);
    res.send(Buffer.from(combinedBytes));
  } catch (error) {
    console.error('Batch download error:', error);
    res.status(500).json({ error: 'Failed to generate batch PDF' });
  }
});

// Download an A4 sheet of scannable Stocktake condition barcodes (CONDITION:GOOD, etc.)
router.get('/condition-sheet', requireAuth, requireAnyPermission('canAccessAssets', 'canAccessStocktake'), async (_req: Request, res: Response) => {
  try {
    const pdfBytes = await createConditionSheetPDF();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="stocktake-condition-barcodes.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Condition sheet error:', error);
    res.status(500).json({ error: 'Failed to generate condition barcode sheet' });
  }
});

// Get available printers
router.get('/printers', requireAuth, requirePermission('canAccessAssets'), async (_req: Request, res: Response) => {
  try {
    const printers = await getAvailablePrinters();
    res.json(printers);
  } catch (error) {
    console.error('Get printers error:', error);
    res.status(500).json({ error: 'Failed to get printers' });
  }
});

// Get label settings
router.get('/settings', requireAuth, requirePermission('canAccessAssets'), async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;

    const settingsRecords = await prisma.settings.findMany({
      where: {
        key: { startsWith: 'label.' },
      },
    });

    const settingsMap: Record<string, string> = {};
    settingsRecords.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });

    const settings = parseSettings(settingsMap);
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get label settings' });
  }
});

// Get available label types
router.get('/label-types', requireAuth, requirePermission('canAccessAssets'), async (_req: Request, res: Response) => {
  try {
    res.json([
      { id: 'brother-dk22211', name: 'Brother DK-22211 (29×62mm)' },
      { id: 'dymo-1933081', name: 'Dymo 1933081 (25×89mm)' },
      { id: 'dymo-labelmanager', name: 'Dymo 24mm Tape' },
    ]);
  } catch (error) {
    console.error('Get label types error:', error);
    res.status(500).json({ error: 'Failed to get label types' });
  }
});

// Update label settings
router.put('/settings', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const updates = req.body as Partial<LabelSettings>;

    const keyValues = settingsToKeyValue(updates);

    // Upsert each setting
    for (const [key, value] of Object.entries(keyValues)) {
      await prisma.settings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    // Return updated settings
    const settingsRecords = await prisma.settings.findMany({
      where: {
        key: { startsWith: 'label.' },
      },
    });

    const settingsMap: Record<string, string> = {};
    settingsRecords.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });

    const settings = parseSettings(settingsMap);
    res.json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update label settings' });
  }
});

// Download label as PDF (for manual printing)
router.get('/download/:assetId', requireAuth, requirePermission('canAccessAssets'), async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const assetId = req.params.assetId as string;

    // Get optional query params for settings override
    const showAssignedTo = req.query.showAssignedTo !== undefined ? req.query.showAssignedTo === 'true' : undefined;
    const showHostname = req.query.showHostname !== undefined ? req.query.showHostname === 'true' : undefined;
    const showIpAddress = req.query.showIpAddress !== undefined ? req.query.showIpAddress === 'true' : undefined;
    const qrCodeContent = req.query.qrCodeContent as 'full' | 'itemNumber' | undefined;
    const labelType = req.query.labelType as 'brother-dk22211' | 'dymo-1933081' | 'dymo-labelmanager' | undefined;

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { manufacturer: true, ipAddresses: true, student: true },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Get label settings and organization name
    const settingsRecords = await prisma.settings.findMany({
      where: {
        key: { in: ['label.labelType', 'label.printerName', 'label.showAssignedTo', 'label.showHostname', 'label.showIpAddress', 'label.qrCodeContent', 'organization'] },
      },
    });
    const settingsMap: Record<string, string> = {};
    settingsRecords.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });
    const settings = parseSettings(settingsMap);
    const organizationName = settingsMap['organization'] || null;

    // Override settings from query params if provided
    const finalSettings = {
      ...settings,
      ...(labelType !== undefined && { labelType }),
      ...(showAssignedTo !== undefined && { showAssignedTo }),
      ...(showHostname !== undefined && { showHostname }),
      ...(showIpAddress !== undefined && { showIpAddress }),
      ...(qrCodeContent !== undefined && { qrCodeContent }),
    };

    // Select correct service based on label type
    const isDymo = DYMO_LABEL_TYPES.has(finalSettings.labelType);
    const createLabelPDF = isDymo ? createDymoPDF : createBrotherPDF;

    // Resolve first IP (all IPs are equal now)
    const primaryIP = asset.ipAddresses?.[0]?.ip;

    // Construct assignedTo: use assignedTo if set, otherwise construct from student name
    let assignedTo = asset.assignedTo;
    if (!assignedTo && asset.student) {
      assignedTo = `${asset.student.firstName} ${asset.student.surname}`;
    }

    const labelAsset: LabelAsset = { ...asset, ipAddress: primaryIP, organizationName, assignedTo };
    const pdfBytes = await createLabelPDF(labelAsset, finalSettings);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="label-${asset.itemNumber}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Label download error:', error);
    res.status(500).json({ error: 'Failed to generate label PDF' });
  }
});

// Get DYMO label XML for an asset (printed client-side via the browser-local DYMO service)
router.get('/dymo-xml/:assetId', requireAuth, requirePermission('canAccessAssets'), async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const assetId = req.params.assetId as string;

    const showAssignedTo = req.query.showAssignedTo !== undefined ? req.query.showAssignedTo === 'true' : undefined;
    const showHostname = req.query.showHostname !== undefined ? req.query.showHostname === 'true' : undefined;
    const showIpAddress = req.query.showIpAddress !== undefined ? req.query.showIpAddress === 'true' : undefined;
    const qrCodeContent = req.query.qrCodeContent as 'full' | 'itemNumber' | undefined;
    const buildXml = req.query.variant === 'labelmanager' ? buildDymoLabelManagerXml : buildDymoLabelXml;

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { manufacturer: true, ipAddresses: true, student: true },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const settingsRecords = await prisma.settings.findMany({
      where: {
        key: { in: ['label.showAssignedTo', 'label.showHostname', 'label.showIpAddress', 'label.qrCodeContent', 'organization'] },
      },
    });
    const settingsMap: Record<string, string> = {};
    settingsRecords.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });
    const settings = parseSettings(settingsMap);
    const organizationName = settingsMap['organization'] || null;

    const finalSettings = {
      ...settings,
      ...(showAssignedTo !== undefined && { showAssignedTo }),
      ...(showHostname !== undefined && { showHostname }),
      ...(showIpAddress !== undefined && { showIpAddress }),
      ...(qrCodeContent !== undefined && { qrCodeContent }),
    };

    const primaryIP = asset.ipAddresses?.[0]?.ip;

    let assignedTo = asset.assignedTo;
    if (!assignedTo && asset.student) {
      assignedTo = `${asset.student.firstName} ${asset.student.surname}`;
    }

    const labelAsset: LabelAsset = { ...asset, ipAddress: primaryIP, organizationName, assignedTo };
    const xml = await buildXml(labelAsset, finalSettings);

    res.json({ itemNumber: asset.itemNumber, xml });
  } catch (error) {
    console.error('DYMO label XML error:', error);
    res.status(500).json({ error: 'Failed to generate DYMO label XML' });
  }
});

// Get DYMO label XML for a batch of assets (printed client-side via the browser-local DYMO service)
router.get('/dymo-xml-batch', requireAuth, requirePermission('canAccessAssets'), async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const assetIdsParam = req.query.assetIds as string;

    if (!assetIdsParam) {
      return res.status(400).json({ error: 'assetIds parameter is required' });
    }

    const assetIds = assetIdsParam.split(',');

    const showAssignedTo = req.query.showAssignedTo !== undefined ? req.query.showAssignedTo === 'true' : undefined;
    const showHostname = req.query.showHostname !== undefined ? req.query.showHostname === 'true' : undefined;
    const showIpAddress = req.query.showIpAddress !== undefined ? req.query.showIpAddress === 'true' : undefined;
    const qrCodeContent = req.query.qrCodeContent as 'full' | 'itemNumber' | undefined;
    const buildXml = req.query.variant === 'labelmanager' ? buildDymoLabelManagerXml : buildDymoLabelXml;

    const settingsRecords = await prisma.settings.findMany({
      where: {
        key: { in: ['label.showAssignedTo', 'label.showHostname', 'label.showIpAddress', 'label.qrCodeContent', 'organization'] },
      },
    });
    const settingsMap: Record<string, string> = {};
    settingsRecords.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });
    const settings = parseSettings(settingsMap);
    const organizationName = settingsMap['organization'] || null;

    const finalSettings = {
      ...settings,
      ...(showAssignedTo !== undefined && { showAssignedTo }),
      ...(showHostname !== undefined && { showHostname }),
      ...(showIpAddress !== undefined && { showIpAddress }),
      ...(qrCodeContent !== undefined && { qrCodeContent }),
    };

    const assets = await prisma.asset.findMany({
      where: { id: { in: assetIds } },
      include: { manufacturer: true, ipAddresses: true, student: true },
    });

    const labels = await Promise.all(assets.map(async (asset) => {
      const primaryIP = asset.ipAddresses?.[0]?.ip;
      let assignedTo = asset.assignedTo;
      if (!assignedTo && asset.student) {
        assignedTo = `${asset.student.firstName} ${asset.student.surname}`;
      }
      const labelAsset: LabelAsset = { ...asset, ipAddress: primaryIP, organizationName, assignedTo };
      return {
        assetId: asset.id,
        itemNumber: asset.itemNumber,
        xml: await buildXml(labelAsset, finalSettings),
      };
    }));

    const foundIds = assets.map(a => a.id);
    const notFound = assetIds.filter((id: string) => !foundIds.includes(id));

    res.json({ labels, notFound });
  } catch (error) {
    console.error('DYMO batch label XML error:', error);
    res.status(500).json({ error: 'Failed to generate DYMO label XML batch' });
  }
});

export default router;
