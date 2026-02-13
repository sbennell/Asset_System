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
