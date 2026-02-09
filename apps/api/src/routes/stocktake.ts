import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from './auth.js';

const router = Router();

// Apply auth to all routes
router.use(requireAuth);

// Get all stocktakes
router.get('/', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const stocktakes = await prisma.stocktake.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        _count: {
          select: { records: true }
        }
      }
    });

    // Get verified counts
    const stocktakesWithStats = await Promise.all(
      stocktakes.map(async (st) => {
        const verifiedCount = await prisma.stocktakeRecord.count({
          where: { stocktakeId: st.id, verified: true }
        });
        return {
          ...st,
          verifiedCount,
          totalCount: st._count.records
        };
      })
    );

    res.json(stocktakesWithStats);
  } catch (error) {
    console.error('Error fetching stocktakes:', error);
    res.status(500).json({ error: 'Failed to fetch stocktakes' });
  }
});

// Get single stocktake with records
router.get('/:id', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;

  try {
    const stocktake = await prisma.stocktake.findUnique({
      where: { id },
      include: {
        records: {
          include: {
            asset: {
              include: {
                category: true,
                location: true,
                manufacturer: true
              }
            }
          },
          orderBy: { asset: { itemNumber: 'asc' } }
        }
      }
    });

    if (!stocktake) {
      return res.status(404).json({ error: 'Stocktake not found' });
    }

    res.json(stocktake);
  } catch (error) {
    console.error('Error fetching stocktake:', error);
    res.status(500).json({ error: 'Failed to fetch stocktake' });
  }
});

// Create new stocktake
router.post('/', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const { name, notes, categoryId, locationId } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    // Build asset filter - include all "In Use" assets
    const assetWhere: any = { status: { startsWith: 'In Use' } };
    if (categoryId) assetWhere.categoryId = categoryId;
    if (locationId) assetWhere.locationId = locationId;

    // Get all active assets matching filter
    const assets = await prisma.asset.findMany({
      where: assetWhere,
      select: { id: true }
    });

    if (assets.length === 0) {
      return res.status(400).json({ error: 'No assets found matching the criteria' });
    }

    // Create stocktake with records
    const stocktake = await prisma.stocktake.create({
      data: {
        name,
        startDate: new Date(),
        status: 'IN_PROGRESS',
        notes,
        records: {
          create: assets.map(asset => ({
            assetId: asset.id,
            verified: false
          }))
        }
      },
      include: {
        _count: {
          select: { records: true }
        }
      }
    });

    res.status(201).json({
      ...stocktake,
      verifiedCount: 0,
      totalCount: stocktake._count.records
    });
  } catch (error) {
    console.error('Error creating stocktake:', error);
    res.status(500).json({ error: 'Failed to create stocktake' });
  }
});

// Update stocktake (name, notes, status)
router.put('/:id', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;
  const { name, notes, status } = req.body;

  try {
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'COMPLETED') {
        updateData.endDate = new Date();

        // Get all verified records with their condition updates
        const verifiedRecords = await prisma.stocktakeRecord.findMany({
          where: { stocktakeId: id as string, verified: true },
          select: { assetId: true, newCondition: true }
        });

        if (verifiedRecords.length > 0) {
          // Update lastReviewDate on all verified assets
          await prisma.asset.updateMany({
            where: {
              id: { in: verifiedRecords.map(r => r.assetId) }
            },
            data: {
              lastReviewDate: new Date()
            }
          });

          // Update condition for assets where newCondition was specified
          const conditionUpdates = verifiedRecords.filter(r => r.newCondition);
          for (const record of conditionUpdates) {
            await prisma.asset.update({
              where: { id: record.assetId },
              data: { condition: record.newCondition! }
            });
          }
        }
      }
    }

    const stocktake = await prisma.stocktake.update({
      where: { id },
      data: updateData
    });

    res.json(stocktake);
  } catch (error) {
    console.error('Error updating stocktake:', error);
    res.status(500).json({ error: 'Failed to update stocktake' });
  }
});

// Delete stocktake
router.delete('/:id', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;

  try {
    await prisma.stocktake.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting stocktake:', error);
    res.status(500).json({ error: 'Failed to delete stocktake' });
  }
});

// Verify a single asset in stocktake
router.post('/:id/verify/:assetId', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;
  const assetId = req.params.assetId as string;
  const { locationMatch, conditionMatch, newCondition, notes } = req.body;

  try {
    const record = await prisma.stocktakeRecord.update({
      where: {
        stocktakeId_assetId: {
          stocktakeId: id,
          assetId
        }
      },
      data: {
        verified: true,
        verifiedAt: new Date(),
        locationMatch,
        conditionMatch,
        newCondition,
        notes
      },
      include: {
        asset: {
          include: {
            category: true,
            location: true,
            manufacturer: true
          }
        }
      }
    });

    res.json(record);
  } catch (error) {
    console.error('Error verifying asset:', error);
    res.status(500).json({ error: 'Failed to verify asset' });
  }
});

// Unverify a single asset in stocktake
router.post('/:id/unverify/:assetId', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;
  const assetId = req.params.assetId as string;

  try {
    const record = await prisma.stocktakeRecord.update({
      where: {
        stocktakeId_assetId: {
          stocktakeId: id,
          assetId
        }
      },
      data: {
        verified: false,
        verifiedAt: null,
        locationMatch: null,
        conditionMatch: null,
        newCondition: null,
        notes: null
      },
      include: {
        asset: {
          include: {
            category: true,
            location: true,
            manufacturer: true
          }
        }
      }
    });

    res.json(record);
  } catch (error) {
    console.error('Error unverifying asset:', error);
    res.status(500).json({ error: 'Failed to unverify asset' });
  }
});

// Quick verify by item number or barcode scan
router.post('/:id/quick-verify', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;
  const { itemNumber, newCondition } = req.body;

  if (!itemNumber) {
    return res.status(400).json({ error: 'Item number is required' });
  }

  try {
    // Find the asset
    const asset = await prisma.asset.findUnique({
      where: { itemNumber }
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Find the record in this stocktake
    const record = await prisma.stocktakeRecord.findUnique({
      where: {
        stocktakeId_assetId: {
          stocktakeId: id,
          assetId: asset.id
        }
      }
    });

    if (!record) {
      return res.status(404).json({ error: 'Asset not in this stocktake' });
    }

    if (record.verified) {
      return res.status(400).json({ error: 'Asset already verified', asset });
    }

    // Verify the asset
    const updatedRecord = await prisma.stocktakeRecord.update({
      where: {
        stocktakeId_assetId: {
          stocktakeId: id,
          assetId: asset.id
        }
      },
      data: {
        verified: true,
        verifiedAt: new Date(),
        locationMatch: true,
        conditionMatch: !newCondition,
        newCondition: newCondition || null
      },
      include: {
        asset: {
          include: {
            category: true,
            location: true,
            manufacturer: true
          }
        }
      }
    });

    res.json(updatedRecord);
  } catch (error) {
    console.error('Error quick verifying asset:', error);
    res.status(500).json({ error: 'Failed to verify asset' });
  }
});

export default router;
