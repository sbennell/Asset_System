import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from './auth.js';
import {
  createLabelPDF,
  createLabelPreview,
  printLabel,
  getAvailablePrinters,
  parseSettings,
  settingsToKeyValue,
  LabelAsset,
  LabelSettings,
} from '../services/labelService.js';

const router = Router();

// Get label preview as PNG image
router.get('/preview/:assetId', requireAuth, async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const assetId = req.params.assetId as string;

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { manufacturer: true },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const previewBuffer = await createLabelPreview(asset as LabelAsset);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="label-${asset.itemNumber}.png"`);
    res.send(previewBuffer);
  } catch (error) {
    console.error('Label preview error:', error);
    res.status(500).json({ error: 'Failed to generate label preview' });
  }
});

// Print single asset label
router.post('/print/:assetId', requireAuth, async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const assetId = req.params.assetId as string;
    const { copies = 1, showAssignedTo, showModel, showSerialNumber } = req.body;

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { manufacturer: true },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Get label settings and organization name
    const settingsRecords = await prisma.settings.findMany({
      where: {
        key: { in: ['label.printerName', 'label.showAssignedTo', 'label.showModel', 'label.showHostname', 'label.showSerialNumber', 'organization'] },
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
      ...(showAssignedTo !== undefined && { showAssignedTo }),
      ...(showModel !== undefined && { showModel }),
      ...(showSerialNumber !== undefined && { showSerialNumber }),
    };

    // Generate and print label
    const labelAsset: LabelAsset = { ...asset, organizationName };
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
router.post('/print-batch', requireAuth, async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const { assetIds, copies = 1 } = req.body;

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ error: 'assetIds array is required' });
    }

    // Get label settings and organization name
    const settingsRecords = await prisma.settings.findMany({
      where: {
        key: { in: ['label.printerName', 'label.showAssignedTo', 'label.showModel', 'label.showHostname', 'label.showSerialNumber', 'organization'] },
      },
    });
    const settingsMap: Record<string, string> = {};
    settingsRecords.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });
    const settings = parseSettings(settingsMap);
    const organizationName = settingsMap['organization'] || null;

    // Fetch all assets
    const assets = await prisma.asset.findMany({
      where: { id: { in: assetIds } },
      include: { manufacturer: true },
    });

    let printed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const asset of assets) {
      try {
        const labelAsset: LabelAsset = { ...asset, organizationName };
        const pdfBytes = await createLabelPDF(labelAsset, settings);
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

// Get available printers
router.get('/printers', requireAuth, async (_req: Request, res: Response) => {
  try {
    const printers = await getAvailablePrinters();
    res.json(printers);
  } catch (error) {
    console.error('Get printers error:', error);
    res.status(500).json({ error: 'Failed to get printers' });
  }
});

// Get label settings
router.get('/settings', requireAuth, async (req: Request, res: Response) => {
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

// Update label settings
router.put('/settings', requireAuth, async (req: Request, res: Response) => {
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
router.get('/download/:assetId', requireAuth, async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const assetId = req.params.assetId as string;

    // Get optional query params for settings override
    const showAssignedTo = req.query.showAssignedTo !== undefined ? req.query.showAssignedTo === 'true' : undefined;
    const showModel = req.query.showModel !== undefined ? req.query.showModel === 'true' : undefined;
    const showSerialNumber = req.query.showSerialNumber !== undefined ? req.query.showSerialNumber === 'true' : undefined;

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { manufacturer: true },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Get label settings and organization name
    const settingsRecords = await prisma.settings.findMany({
      where: {
        key: { in: ['label.printerName', 'label.showAssignedTo', 'label.showModel', 'label.showHostname', 'label.showSerialNumber', 'organization'] },
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
      ...(showAssignedTo !== undefined && { showAssignedTo }),
      ...(showModel !== undefined && { showModel }),
      ...(showSerialNumber !== undefined && { showSerialNumber }),
    };

    const labelAsset: LabelAsset = { ...asset, organizationName };
    const pdfBytes = await createLabelPDF(labelAsset, finalSettings);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="label-${asset.itemNumber}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Label download error:', error);
    res.status(500).json({ error: 'Failed to generate label PDF' });
  }
});

export default router;
