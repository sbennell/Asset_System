import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { requireAuth } from './auth.js';

const router = Router();

// Apply auth to all routes
router.use(requireAuth);

// List assets with pagination, filtering, and sorting
router.get('/', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const {
      page = '1',
      limit = '50',
      search,
      status,
      category,
      manufacturer,
      location,
      sortBy = 'itemNumber',
      sortOrder = 'asc'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.AssetWhereInput = {};

    if (search) {
      where.OR = [
        { itemNumber: { contains: search as string } },
        { serialNumber: { contains: search as string } },
        { model: { contains: search as string } },
        { hostname: { contains: search as string } },
        { assignedTo: { contains: search as string } },
        { description: { contains: search as string } }
      ];
    }

    if (status === '_active') {
      where.status = { not: { startsWith: 'Decommissioned' } } as any;
    } else if (status && status !== '_all') {
      where.status = status as any;
    }

    if (category) {
      where.categoryId = category as string;
    }

    if (manufacturer) {
      where.manufacturerId = manufacturer as string;
    }

    if (location) {
      where.locationId = location as string;
    }

    // Build orderBy - handle special cases
    let orderBy: Prisma.AssetOrderByWithRelationInput | Prisma.AssetOrderByWithRelationInput[] = {
      [sortBy as string]: sortOrder as 'asc' | 'desc'
    };

    // Handle related field sorting (manufacturer, category, location)
    if (sortBy === 'manufacturer') {
      orderBy = { manufacturer: { name: sortOrder as 'asc' | 'desc' } };
    } else if (sortBy === 'category') {
      orderBy = { category: { name: sortOrder as 'asc' | 'desc' } };
    } else if (sortBy === 'location') {
      orderBy = { location: { name: sortOrder as 'asc' | 'desc' } };
    } else if (sortBy === 'itemNumber') {
      // We'll handle this with post-fetch sorting for accurate numeric order
      orderBy = { itemNumber: 'asc' }; // Placeholder, will be re-sorted
    }

    // Get total count and assets
    const [total, assetsRaw] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        orderBy,
        skip: sortBy === 'itemNumber' ? 0 : skip, // Fetch all for numeric sort
        take: sortBy === 'itemNumber' ? undefined : limitNum,
        include: {
          category: true,
          manufacturer: true,
          supplier: true,
          location: true
        }
      })
    ]);

    // Natural sort for itemNumber
    let assets = assetsRaw;
    if (sortBy === 'itemNumber') {
      assets = assetsRaw.sort((a, b) => {
        // Extract numeric parts for comparison
        const numA = parseInt(a.itemNumber.replace(/\D/g, '') || '0', 10);
        const numB = parseInt(b.itemNumber.replace(/\D/g, '') || '0', 10);
        if (numA !== numB) {
          return sortOrder === 'asc' ? numA - numB : numB - numA;
        }
        // If numbers are equal, sort alphabetically
        return sortOrder === 'asc'
          ? a.itemNumber.localeCompare(b.itemNumber)
          : b.itemNumber.localeCompare(a.itemNumber);
      });
      // Apply pagination after sorting
      assets = assets.slice(skip, skip + limitNum);
    }

    res.json({
      data: assets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Get next item number (must be before /:id route)
router.get('/next-item-number', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const assets = await prisma.asset.findMany({
      select: { itemNumber: true }
    });

    let maxNum = 0;
    for (const asset of assets) {
      const nums = asset.itemNumber.match(/\d+/g);
      if (nums) {
        const last = parseInt(nums[nums.length - 1], 10);
        if (last > maxNum) maxNum = last;
      }
    }

    res.json({ nextItemNumber: String(maxNum + 1) });
  } catch (error) {
    console.error('Error getting next item number:', error);
    res.status(500).json({ error: 'Failed to get next item number' });
  }
});

// Bulk create assets with shared fields and unique serial numbers
router.post('/bulk', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const { sharedFields, serialNumbers, assignedToList } = req.body;

    if (!serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      return res.status(400).json({ error: 'At least one serial number is required' });
    }

    if (serialNumbers.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 assets can be created at once' });
    }

    // Get next item number
    const allAssets = await prisma.asset.findMany({
      select: { itemNumber: true }
    });

    let maxNum = 0;
    for (const asset of allAssets) {
      const nums = asset.itemNumber.match(/\d+/g);
      if (nums) {
        const last = parseInt(nums[nums.length - 1], 10);
        if (last > maxNum) maxNum = last;
      }
    }

    const results: {
      created: number;
      failed: number;
      errors: { serialNumber: string; message: string }[];
    } = { created: 0, failed: 0, errors: [] };

    for (let i = 0; i < serialNumbers.length; i++) {
      const serialNumber = serialNumbers[i].trim();
      if (!serialNumber) {
        results.errors.push({ serialNumber: `(empty line ${i + 1})`, message: 'Serial number is empty' });
        results.failed++;
        continue;
      }

      const itemNumber = String(maxNum + 1 + results.created);

      try {
        const asset = await prisma.asset.create({
          data: {
            itemNumber,
            serialNumber,
            manufacturerId: sharedFields.manufacturerId || null,
            model: sharedFields.model || null,
            categoryId: sharedFields.categoryId || null,
            description: sharedFields.description || null,
            status: sharedFields.status || 'In Use',
            condition: sharedFields.condition || 'GOOD',
            acquiredDate: sharedFields.acquiredDate ? new Date(sharedFields.acquiredDate) : null,
            purchasePrice: sharedFields.purchasePrice ? parseFloat(sharedFields.purchasePrice) : null,
            supplierId: sharedFields.supplierId || null,
            orderNumber: sharedFields.orderNumber || null,
            assignedTo: (assignedToList && assignedToList[i]?.trim()) || sharedFields.assignedTo || null,
            locationId: sharedFields.locationId || null,
            warrantyExpiration: sharedFields.warrantyExpiration ? new Date(sharedFields.warrantyExpiration) : null,
            endOfLifeDate: sharedFields.endOfLifeDate ? new Date(sharedFields.endOfLifeDate) : null,
            comments: sharedFields.comments || null,
          }
        });

        await prisma.auditLog.create({
          data: {
            assetId: asset.id,
            userId: req.session.userId,
            action: 'CREATE',
            changes: JSON.stringify({ ...sharedFields, serialNumber, itemNumber, bulkCreate: true }),
            ipAddress: req.ip
          }
        });

        results.created++;
      } catch (error: any) {
        results.failed++;
        if (error.code === 'P2002') {
          results.errors.push({ serialNumber, message: `Item number ${itemNumber} already exists` });
        } else {
          results.errors.push({ serialNumber, message: error.message || 'Unknown error' });
        }
      }
    }

    res.status(201).json(results);
  } catch (error) {
    console.error('Error bulk creating assets:', error);
    res.status(500).json({ error: 'Failed to bulk create assets' });
  }
});

// Bulk update assets with shared fields
router.put('/bulk-update', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const { ids, fields } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'At least one asset ID is required' });
    }

    // Strip undefined and empty string values from fields
    const cleanedFields: Record<string, any> = {};
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        // Handle date fields
        if (key === 'acquiredDate' || key === 'warrantyExpiration' || key === 'endOfLifeDate' || key === 'lastReviewDate' || key === 'decommissionDate') {
          cleanedFields[key] = value ? new Date(value as string | number) : null;
        }
        // Handle price
        else if (key === 'purchasePrice') {
          cleanedFields[key] = value ? parseFloat(value as string) : null;
        } else {
          cleanedFields[key] = value;
        }
      }
    });

    // If no fields to update, return error
    if (Object.keys(cleanedFields).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const results: {
      updated: number;
      failed: number;
      errors: { id: string; message: string }[];
    } = { updated: 0, failed: 0, errors: [] };

    for (const id of ids) {
      try {
        // Get current asset for audit log
        const current = await prisma.asset.findUnique({ where: { id } });
        if (!current) {
          results.errors.push({ id, message: 'Asset not found' });
          results.failed++;
          continue;
        }

        // Update asset
        const asset = await prisma.asset.update({
          where: { id },
          data: cleanedFields,
          include: {
            category: true,
            manufacturer: true,
            location: true,
            supplier: true
          }
        });

        // Fetch previous asset with relationships for better audit log display
        const previousAsset = await prisma.asset.findUnique({
          where: { id },
          include: {
            category: true,
            manufacturer: true,
            location: true,
            supplier: true
          }
        });

        // Build human-readable changes for audit log
        // Exclude relationship object fields from audit log
        const excludeFields = ['category', 'manufacturer', 'location', 'supplier'];
        const beforeData: Record<string, any> = {};
        const afterData: Record<string, any> = {};

        // Copy all scalar fields from before state
        Object.keys(current).forEach(key => {
          if (!excludeFields.includes(key)) {
            beforeData[key] = current[key as keyof typeof current];
            // Replace IDs with friendly names for display
            if (key === 'categoryId' && current.categoryId) beforeData[key] = previousAsset?.category?.name || current.categoryId;
            if (key === 'manufacturerId' && current.manufacturerId) beforeData[key] = previousAsset?.manufacturer?.name || current.manufacturerId;
            if (key === 'locationId' && current.locationId) beforeData[key] = previousAsset?.location?.name || current.locationId;
            if (key === 'supplierId' && current.supplierId) beforeData[key] = previousAsset?.supplier?.name || current.supplierId;
          }
        });

        // Copy all scalar fields from after state
        Object.keys(asset).forEach(key => {
          if (!excludeFields.includes(key)) {
            afterData[key] = (asset as any)[key];
            // Replace IDs with friendly names for display
            if (key === 'categoryId' && asset.categoryId) afterData[key] = asset.category?.name || asset.categoryId;
            if (key === 'manufacturerId' && asset.manufacturerId) afterData[key] = asset.manufacturer?.name || asset.manufacturerId;
            if (key === 'locationId' && asset.locationId) afterData[key] = asset.location?.name || asset.locationId;
            if (key === 'supplierId' && asset.supplierId) afterData[key] = asset.supplier?.name || asset.supplierId;
          }
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            assetId: id,
            userId: req.session.userId,
            action: 'BULK_UPDATE',
            changes: JSON.stringify({ before: beforeData, after: afterData, bulkUpdate: true }),
            ipAddress: req.ip
          }
        });

        results.updated++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({ id, message: error.message || 'Unknown error' });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error bulk updating assets:', error);
    res.status(500).json({ error: 'Failed to bulk update assets' });
  }
});

// Get single asset
router.get('/:id', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;

  try {
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        category: true,
        manufacturer: true,
        supplier: true,
        location: true,
        attachments: true,
        auditLogs: {
          orderBy: { timestamp: 'desc' },
          take: 20,
          include: {
            user: {
              select: { id: true, username: true, fullName: true }
            }
          }
        }
      }
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json(asset);
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// Create asset
router.post('/', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const {
      itemNumber,
      serialNumber,
      manufacturerId,
      model,
      categoryId,
      description,
      status,
      condition,
      acquiredDate,
      purchasePrice,
      supplierId,
      orderNumber,
      hostname,
      deviceUsername,
      devicePassword,
      lanMacAddress,
      wlanMacAddress,
      ipAddress,
      assignedTo,
      locationId,
      warrantyExpiration,
      endOfLifeDate,
      comments
    } = req.body;

    if (!itemNumber) {
      return res.status(400).json({ error: 'Item number is required' });
    }

    const asset = await prisma.asset.create({
      data: {
        itemNumber,
        serialNumber,
        manufacturerId,
        model,
        categoryId,
        description,
        status: status || 'In Use',
        condition: condition || 'GOOD',
        acquiredDate: acquiredDate ? new Date(acquiredDate) : null,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        supplierId,
        orderNumber,
        hostname,
        deviceUsername,
        devicePassword,
        lanMacAddress,
        wlanMacAddress,
        ipAddress,
        assignedTo,
        locationId,
        warrantyExpiration: warrantyExpiration ? new Date(warrantyExpiration) : null,
        endOfLifeDate: endOfLifeDate ? new Date(endOfLifeDate) : null,
        comments
      },
      include: {
        category: true,
        manufacturer: true,
        supplier: true,
        location: true
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        assetId: asset.id,
        userId: req.session.userId,
        action: 'CREATE',
        changes: JSON.stringify(req.body),
        ipAddress: req.ip
      }
    });

    res.status(201).json(asset);
  } catch (error: any) {
    console.error('Error creating asset:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Item number already exists' });
    }
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// Update asset
router.put('/:id', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;

  try {
    // Get current asset for audit log
    const current = await prisma.asset.findUnique({ where: { id } });
    if (!current) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const {
      itemNumber,
      serialNumber,
      manufacturerId,
      model,
      categoryId,
      description,
      status,
      condition,
      acquiredDate,
      purchasePrice,
      supplierId,
      orderNumber,
      hostname,
      deviceUsername,
      devicePassword,
      lanMacAddress,
      wlanMacAddress,
      ipAddress,
      assignedTo,
      locationId,
      warrantyExpiration,
      endOfLifeDate,
      lastReviewDate,
      decommissionDate,
      comments
    } = req.body;

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        itemNumber,
        serialNumber,
        manufacturerId,
        model,
        categoryId,
        description,
        status,
        condition,
        acquiredDate: acquiredDate ? new Date(acquiredDate) : null,
        purchasePrice: purchasePrice !== undefined ? (purchasePrice ? parseFloat(purchasePrice) : null) : undefined,
        supplierId,
        orderNumber,
        hostname,
        deviceUsername,
        devicePassword,
        lanMacAddress,
        wlanMacAddress,
        ipAddress,
        assignedTo,
        locationId,
        warrantyExpiration: warrantyExpiration ? new Date(warrantyExpiration) : null,
        endOfLifeDate: endOfLifeDate ? new Date(endOfLifeDate) : null,
        lastReviewDate: lastReviewDate ? new Date(lastReviewDate) : null,
        decommissionDate: decommissionDate ? new Date(decommissionDate) : null,
        comments
      },
      include: {
        category: true,
        manufacturer: true,
        supplier: true,
        location: true
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        assetId: asset.id,
        userId: req.session.userId,
        action: 'UPDATE',
        changes: JSON.stringify({ before: current, after: req.body }),
        ipAddress: req.ip
      }
    });

    res.json(asset);
  } catch (error: any) {
    console.error('Error updating asset:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Item number already exists' });
    }
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// Delete asset
router.delete('/:id', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;

  try {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Delete related records that don't have cascade delete
    await prisma.stocktakeRecord.deleteMany({ where: { assetId: id } });

    // Now delete the asset (auditLogs and attachments have cascade delete)
    await prisma.asset.delete({ where: { id } });

    res.json({ success: true, message: 'Asset deleted' });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// Get asset history
router.get('/:id/history', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;

  try {
    const logs = await prisma.auditLog.findMany({
      where: { assetId: id },
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: { id: true, username: true, fullName: true }
        }
      }
    });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching asset history:', error);
    res.status(500).json({ error: 'Failed to fetch asset history' });
  }
});

export default router;
