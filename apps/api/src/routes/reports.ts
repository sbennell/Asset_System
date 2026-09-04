import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { requireAuth, requirePermission } from './auth.js';

const router = Router();

// Apply auth to all routes
router.use(requireAuth, requirePermission('canAccessReports'));

// Helper: Build base where clause for non-decommissioned assets
function buildBaseWhere(categoryId?: string, locationId?: string): Prisma.AssetWhereInput {
  const where: Prisma.AssetWhereInput = {
    status: { not: { startsWith: 'Decommissioned' } } as any
  };

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (locationId) {
    where.locationId = locationId;
  }

  return where;
}

// GET /warranty - Warranty Expiry Report
router.get('/warranty', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const {
      days = '90',
      category,
      location,
      skip = '0',
      limit = '50'
    } = req.query;

    const daysNum = parseInt(days as string, 10);
    const skipNum = parseInt(skip as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const now = new Date();
    const thresholdDate = new Date(now.getTime() + daysNum * 24 * 60 * 60 * 1000);

    const classify = (warrantyExpiration: Date | null): { daysUntilExpiry: number | null; warrantyStatus: 'no_warranty' | 'expired' | 'expiring_soon' | 'ok' } => {
      if (!warrantyExpiration) {
        return { daysUntilExpiry: null, warrantyStatus: 'no_warranty' };
      }
      const daysUntilExpiry = Math.floor((warrantyExpiration.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const warrantyStatus = daysUntilExpiry < 0 ? 'expired' : daysUntilExpiry <= daysNum ? 'expiring_soon' : 'ok';
      return { daysUntilExpiry, warrantyStatus };
    };

    // baseWhere scopes the summary/chart to everything matching category/location,
    // independent of the days threshold, so "OK" and the timeline still show the
    // full picture. listWhere additionally restricts the table to assets that
    // actually need attention (no warranty on file, expired, or expiring within
    // `days`) so changing the Days filter visibly changes which rows are shown.
    const baseWhere = buildBaseWhere(category as string, location as string);
    const listWhere: Prisma.AssetWhereInput = {
      ...baseWhere,
      OR: [{ warrantyExpiration: null }, { warrantyExpiration: { lte: thresholdDate } }]
    };

    // Get total count and paginated assets for the table, plus the full
    // category/location-scoped set (warranty date only) for aggregations
    const [total, assets, allAssets] = await Promise.all([
      prisma.asset.count({ where: listWhere }),
      prisma.asset.findMany({
        where: listWhere,
        skip: skipNum,
        take: limitNum,
        include: {
          category: true,
          manufacturer: true,
          location: true
        },
        orderBy: { itemNumber: 'asc' }
      }),
      prisma.asset.findMany({ where: baseWhere, select: { warrantyExpiration: true } })
    ]);

    // Process assets to compute warranty status
    const processedAssets = assets.map((asset) => {
      const { daysUntilExpiry, warrantyStatus } = classify(asset.warrantyExpiration);

      return {
        id: asset.id,
        itemNumber: asset.itemNumber,
        model: asset.model,
        serialNumber: asset.serialNumber,
        status: asset.status,
        manufacturer: asset.manufacturer ? { id: asset.manufacturer.id, name: asset.manufacturer.name } : null,
        category: asset.category ? { id: asset.category.id, name: asset.category.name } : null,
        location: asset.location ? { id: asset.location.id, name: asset.location.name } : null,
        warrantyExpiration: asset.warrantyExpiration?.toISOString() || null,
        daysUntilExpiry,
        warrantyStatus
      };
    });

    // Group by warranty month (full category/location-scoped set, not just this page)
    const byMonth = new Map<string, number>();
    allAssets.forEach((asset) => {
      if (asset.warrantyExpiration) {
        const yearMonth = asset.warrantyExpiration.toISOString().slice(0, 7);
        byMonth.set(yearMonth, (byMonth.get(yearMonth) || 0) + 1);
      }
    });

    // Compute summary (full category/location-scoped set, not just this page)
    const summary = { noWarranty: 0, expired: 0, expiringSoon: 0, ok: 0 };
    allAssets.forEach((asset) => {
      const { warrantyStatus } = classify(asset.warrantyExpiration);
      if (warrantyStatus === 'no_warranty') summary.noWarranty++;
      else if (warrantyStatus === 'expired') summary.expired++;
      else if (warrantyStatus === 'expiring_soon') summary.expiringSoon++;
      else summary.ok++;
    });

    res.json({
      summary,
      byMonth: Array.from(byMonth.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      assets: processedAssets,
      pagination: {
        skip: skipNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      meta: {
        thresholdDays: daysNum,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching warranty report:', error);
    res.status(500).json({ error: 'Failed to fetch warranty report' });
  }
});

// GET /condition - Fleet Health Report (Condition Breakdown)
router.get('/condition', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const { category, location, skip = '0', limit = '50' } = req.query;

    const skipNum = parseInt(skip as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const where = buildBaseWhere(category as string, location as string);

    // Get total count and assets
    const [total, assets] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        skip: skipNum,
        take: limitNum,
        include: {
          category: true,
          location: true
        },
        orderBy: { itemNumber: 'asc' }
      })
    ]);

    // Process assets
    const processedAssets = assets.map((asset) => ({
      id: asset.id,
      itemNumber: asset.itemNumber,
      model: asset.model,
      status: asset.status,
      condition: asset.condition,
      category: asset.category ? { id: asset.category.id, name: asset.category.name } : null,
      location: asset.location ? { id: asset.location.id, name: asset.location.name } : null
    }));

    // Compute summary - count per condition
    const conditionCounts = {
      NEW: 0,
      EXCELLENT: 0,
      GOOD: 0,
      FAIR: 0,
      POOR: 0,
      NON_FUNCTIONAL: 0
    };

    // Count from all assets (not just paginated)
    const allAssets = await prisma.asset.findMany({
      where,
      select: { condition: true }
    });

    allAssets.forEach((asset) => {
      const cond = asset.condition as keyof typeof conditionCounts;
      if (cond in conditionCounts) {
        conditionCounts[cond]++;
      }
    });

    const summary = conditionCounts;

    // byCondition array
    const byCondition = Object.entries(conditionCounts)
      .map(([condition, count]) => ({ condition, count }))
      .sort((a, b) => b.count - a.count);

    // byCategory - cross-tab
    const allWithCategory = await prisma.asset.findMany({
      where,
      include: { category: true }
    });

    const byCategory = new Map<string, Record<keyof typeof conditionCounts, number>>();
    allWithCategory.forEach((asset) => {
      const categoryName = asset.category?.name || 'Uncategorized';
      if (!byCategory.has(categoryName)) {
        byCategory.set(categoryName, { NEW: 0, EXCELLENT: 0, GOOD: 0, FAIR: 0, POOR: 0, NON_FUNCTIONAL: 0 });
      }
      const cond = asset.condition as keyof typeof conditionCounts;
      const counts = byCategory.get(categoryName)!;
      counts[cond]++;
    });

    const byCategoryArray = Array.from(byCategory.entries())
      .map(([category, counts]) => ({
        category,
        ...counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0)
      }))
      .sort((a, b) => b.total - a.total);

    res.json({
      summary,
      byCondition,
      byCategory: byCategoryArray,
      assets: processedAssets,
      pagination: {
        skip: skipNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      meta: {
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching condition report:', error);
    res.status(500).json({ error: 'Failed to fetch condition report' });
  }
});

// GET /value - Asset Value Report (Financial)
router.get('/value', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const { category, location, manufacturer, skip = '0', limit = '50' } = req.query;

    const skipNum = parseInt(skip as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const where = buildBaseWhere(category as string, location as string);

    if (manufacturer) {
      where.manufacturerId = manufacturer as string;
    }

    // Get total count and paginated assets
    const [total, assets] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        skip: skipNum,
        take: limitNum,
        include: {
          category: true,
          location: true,
          manufacturer: true
        },
        orderBy: { itemNumber: 'asc' }
      })
    ]);

    // Process assets
    const processedAssets = assets.map((asset) => ({
      id: asset.id,
      itemNumber: asset.itemNumber,
      model: asset.model,
      status: asset.status,
      purchasePrice: asset.purchasePrice,
      acquiredDate: asset.acquiredDate?.toISOString() || null,
      category: asset.category ? { id: asset.category.id, name: asset.category.name } : null,
      location: asset.location ? { id: asset.location.id, name: asset.location.name } : null,
      manufacturer: asset.manufacturer ? { id: asset.manufacturer.id, name: asset.manufacturer.name } : null
    }));

    // Get all assets for aggregations
    const allAssets = await prisma.asset.findMany({
      where,
      include: {
        category: true,
        location: true,
        manufacturer: true
      }
    });

    // Compute summary
    const assetsWithPrice = allAssets.filter((a) => a.purchasePrice !== null && a.purchasePrice > 0);
    const totalValue = assetsWithPrice.reduce((sum, a) => sum + (a.purchasePrice || 0), 0);
    const avgValue = assetsWithPrice.length > 0 ? totalValue / assetsWithPrice.length : 0;
    const prices = assetsWithPrice.map((a) => a.purchasePrice!);
    const maxValue = prices.length > 0 ? Math.max(...prices) : 0;
    const minValue = prices.length > 0 ? Math.min(...prices) : 0;

    const summary = {
      totalValue: Math.round(totalValue * 100) / 100,
      avgValue: Math.round(avgValue * 100) / 100,
      assetCount: allAssets.length,
      assetsWithPrice: assetsWithPrice.length,
      assetsWithoutPrice: allAssets.length - assetsWithPrice.length,
      maxValue: Math.round(maxValue * 100) / 100,
      minValue: Math.round(minValue * 100) / 100
    };

    // byCategory
    const byCategory = new Map<string, { totalValue: number; count: number }>();
    allAssets.forEach((asset) => {
      const categoryName = asset.category?.name || 'Uncategorized';
      if (!byCategory.has(categoryName)) {
        byCategory.set(categoryName, { totalValue: 0, count: 0 });
      }
      const data = byCategory.get(categoryName)!;
      data.count++;
      if (asset.purchasePrice) {
        data.totalValue += asset.purchasePrice;
      }
    });

    const byCategoryArray = Array.from(byCategory.entries())
      .map(([category, data]) => ({
        category,
        count: data.count,
        totalValue: Math.round(data.totalValue * 100) / 100,
        avgValue: Math.round((data.totalValue / data.count) * 100) / 100
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    // byLocation
    const byLocation = new Map<string, { totalValue: number; count: number }>();
    allAssets.forEach((asset) => {
      const locationName = asset.location?.name || 'Unassigned';
      if (!byLocation.has(locationName)) {
        byLocation.set(locationName, { totalValue: 0, count: 0 });
      }
      const data = byLocation.get(locationName)!;
      data.count++;
      if (asset.purchasePrice) {
        data.totalValue += asset.purchasePrice;
      }
    });

    const byLocationArray = Array.from(byLocation.entries())
      .map(([location, data]) => ({
        location,
        count: data.count,
        totalValue: Math.round(data.totalValue * 100) / 100
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    // byManufacturer
    const byManufacturer = new Map<string, { totalValue: number; count: number }>();
    allAssets.forEach((asset) => {
      const manufacturerName = asset.manufacturer?.name || 'Unknown';
      if (!byManufacturer.has(manufacturerName)) {
        byManufacturer.set(manufacturerName, { totalValue: 0, count: 0 });
      }
      const data = byManufacturer.get(manufacturerName)!;
      data.count++;
      if (asset.purchasePrice) {
        data.totalValue += asset.purchasePrice;
      }
    });

    const byManufacturerArray = Array.from(byManufacturer.entries())
      .map(([manufacturer, data]) => ({
        manufacturer,
        count: data.count,
        totalValue: Math.round(data.totalValue * 100) / 100,
        avgValue: Math.round((data.totalValue / data.count) * 100) / 100
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    res.json({
      summary,
      byCategory: byCategoryArray,
      byLocation: byLocationArray,
      byManufacturer: byManufacturerArray,
      assets: processedAssets,
      pagination: {
        skip: skipNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      meta: {
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching value report:', error);
    res.status(500).json({ error: 'Failed to fetch value report' });
  }
});

// GET /lifecycle - Age & Lifecycle Report
router.get('/lifecycle', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const { category, location, eolDays = '365', skip = '0', limit = '50' } = req.query;

    const eolDaysNum = parseInt(eolDays as string, 10);
    const skipNum = parseInt(skip as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const now = new Date();

    const where = buildBaseWhere(category as string, location as string);

    // Get total count and paginated assets
    const [total, assets] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        skip: skipNum,
        take: limitNum,
        include: {
          category: true,
          location: true
        },
        orderBy: { itemNumber: 'asc' }
      })
    ]);

    // Helper to compute age group
    function getAgeGroup(ageYears: number | null): string {
      if (ageYears === null) return 'Unknown';
      if (ageYears < 1) return '< 1 year';
      if (ageYears < 3) return '1-3 years';
      if (ageYears < 5) return '3-5 years';
      if (ageYears < 7) return '5-7 years';
      return '7+ years';
    }

    // Helper to compute EOL status
    function getEolStatus(
      endOfLifeDate: Date | null,
      ageYears: number | null
    ): 'no_eol_date' | 'passed' | 'upcoming' | 'ok' {
      if (!endOfLifeDate) return 'no_eol_date';
      if (endOfLifeDate < now) return 'passed';
      const daysUntil = Math.floor((endOfLifeDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (daysUntil <= eolDaysNum) return 'upcoming';
      return 'ok';
    }

    // Process assets
    const processedAssets = assets.map((asset) => {
      let ageYears: number | null = null;
      let daysUntilEol: number | null = null;

      if (asset.acquiredDate) {
        ageYears = (now.getTime() - asset.acquiredDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      }

      if (asset.endOfLifeDate) {
        daysUntilEol = Math.floor(
          (asset.endOfLifeDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );
      }

      return {
        id: asset.id,
        itemNumber: asset.itemNumber,
        model: asset.model,
        status: asset.status,
        category: asset.category ? { id: asset.category.id, name: asset.category.name } : null,
        location: asset.location ? { id: asset.location.id, name: asset.location.name } : null,
        acquiredDate: asset.acquiredDate?.toISOString() || null,
        endOfLifeDate: asset.endOfLifeDate?.toISOString() || null,
        ageYears: ageYears !== null ? Math.round(ageYears * 10) / 10 : null,
        ageGroup: getAgeGroup(ageYears),
        daysUntilEol,
        eolStatus: getEolStatus(asset.endOfLifeDate, ageYears)
      };
    });

    // Get all assets for aggregations
    const allAssets = await prisma.asset.findMany({ where });

    // Compute summary
    const ages = allAssets
      .filter((a) => a.acquiredDate)
      .map((a) => (now.getTime() - a.acquiredDate!.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    const avgAgeYears = ages.length > 0 ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10 : 0;

    const eolPassed = allAssets.filter((a) => a.endOfLifeDate && a.endOfLifeDate < now).length;
    const eolUpcoming = allAssets.filter((a) => {
      if (!a.endOfLifeDate || a.endOfLifeDate < now) return false;
      const daysUntil = Math.floor((a.endOfLifeDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      return daysUntil <= eolDaysNum;
    }).length;

    const summary = {
      total: allAssets.length,
      avgAgeYears,
      noAcquiredDate: allAssets.filter((a) => !a.acquiredDate).length,
      eolPassed,
      eolUpcoming
    };

    // byAgeGroup
    const ageGroupCounts = {
      '< 1 year': 0,
      '1-3 years': 0,
      '3-5 years': 0,
      '5-7 years': 0,
      '7+ years': 0,
      'Unknown': 0
    };

    allAssets.forEach((asset) => {
      let ageYears: number | null = null;
      if (asset.acquiredDate) {
        ageYears = (now.getTime() - asset.acquiredDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      }
      const group = getAgeGroup(ageYears);
      ageGroupCounts[group as keyof typeof ageGroupCounts]++;
    });

    const byAgeGroup = Object.entries(ageGroupCounts)
      .map(([ageGroup, count]) => ({ ageGroup, count }))
      .filter((x) => x.count > 0);

    res.json({
      summary,
      byAgeGroup,
      assets: processedAssets,
      pagination: {
        skip: skipNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      meta: {
        eolThresholdDays: eolDaysNum,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching lifecycle report:', error);
    res.status(500).json({ error: 'Failed to fetch lifecycle report' });
  }
});

// GET /stocktake-review - Stocktake Review Report
router.get('/stocktake-review', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const { year, status, category, location, overdueMonths = '12', skip = '0', limit = '50' } = req.query;

    const overdueMonthsNum = parseInt(overdueMonths as string, 10);
    const skipNum = parseInt(skip as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const now = new Date();
    const overdueDate = new Date(now.getFullYear(), now.getMonth() - overdueMonthsNum, now.getDate());

    const where = buildBaseWhere(category as string, location as string);

    // Helper to compute review status
    function getReviewStatus(lastReviewDate: Date | null): 'reviewed' | 'overdue' | 'never' {
      if (!lastReviewDate) return 'never';
      if (lastReviewDate < overdueDate) return 'overdue';
      return 'reviewed';
    }

    // The table is further restricted by status/year (on top of category/location),
    // while summary/byYear below stay scoped to category/location only so they keep
    // showing the full breakdown regardless of which slice the table is showing.
    const listConditions: Prisma.AssetWhereInput[] = [];
    if (status === 'never') {
      listConditions.push({ lastReviewDate: null });
    } else if (status === 'overdue') {
      listConditions.push({ lastReviewDate: { lt: overdueDate } });
    } else if (status === 'reviewed') {
      listConditions.push({ lastReviewDate: { gte: overdueDate } });
    }
    if (year) {
      const yearNum = parseInt(year as string, 10);
      listConditions.push({
        lastReviewDate: { gte: new Date(yearNum, 0, 1), lt: new Date(yearNum + 1, 0, 1) }
      });
    }
    const listWhere: Prisma.AssetWhereInput = listConditions.length > 0 ? { ...where, AND: listConditions } : where;

    // Get total count and paginated assets
    const [total, assets] = await Promise.all([
      prisma.asset.count({ where: listWhere }),
      prisma.asset.findMany({
        where: listWhere,
        skip: skipNum,
        take: limitNum,
        include: {
          category: true,
          location: true,
          manufacturer: true
        },
        orderBy: { itemNumber: 'asc' }
      })
    ]);

    // Process assets
    const processedAssets = assets.map((asset) => {
      const reviewYear = asset.lastReviewDate ? asset.lastReviewDate.getFullYear() : null;
      const daysSinceReview = asset.lastReviewDate
        ? Math.floor((now.getTime() - asset.lastReviewDate.getTime()) / (24 * 60 * 60 * 1000))
        : null;

      return {
        id: asset.id,
        itemNumber: asset.itemNumber,
        model: asset.model,
        serialNumber: asset.serialNumber,
        category: asset.category ? { id: asset.category.id, name: asset.category.name } : null,
        location: asset.location ? { id: asset.location.id, name: asset.location.name } : null,
        manufacturer: asset.manufacturer ? { id: asset.manufacturer.id, name: asset.manufacturer.name } : null,
        status: asset.status,
        lastReviewDate: asset.lastReviewDate?.toISOString() || null,
        reviewYear,
        reviewStatus: getReviewStatus(asset.lastReviewDate),
        daysSinceReview
      };
    });

    // Get all category/location-scoped assets for aggregations (independent of the
    // status/year filter applied to the table above)
    const allAssets = await prisma.asset.findMany({ where });

    // Compute summary
    const reviewedThisYear = allAssets.filter(
      (a) => a.lastReviewDate && a.lastReviewDate.getFullYear() === now.getFullYear()
    ).length;
    const overdueCount = allAssets.filter((a) => getReviewStatus(a.lastReviewDate) === 'overdue').length;
    const neverReviewedCount = allAssets.filter((a) => getReviewStatus(a.lastReviewDate) === 'never').length;

    const summary = {
      totalAssets: allAssets.length,
      reviewedThisYear,
      overdueCount,
      neverReviewedCount
    };

    // byYear
    const yearCounts = new Map<number, number>();
    allAssets.forEach((asset) => {
      if (asset.lastReviewDate) {
        const y = asset.lastReviewDate.getFullYear();
        yearCounts.set(y, (yearCounts.get(y) || 0) + 1);
      }
    });

    const byYear = Array.from(yearCounts.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year);

    res.json({
      summary,
      byYear,
      assets: processedAssets,
      pagination: {
        skip: skipNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      meta: {
        overdueThresholdMonths: overdueMonthsNum,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching stocktake review report:', error);
    res.status(500).json({ error: 'Failed to fetch stocktake review report' });
  }
});

export default router;
