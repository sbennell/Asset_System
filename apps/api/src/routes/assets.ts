import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { requireAuth, requirePermission } from './auth.js';
import { canViewDevicePasswords, redactAssetPassword } from '../lib/redact.js';

const router = Router();

// Apply auth to all routes
router.use(requireAuth, requirePermission('canAccessAssets'));

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
      stocktakeStatus,
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

    // "Last stocktake" status - mirrors the reviewed/overdue/never logic used by
    // the Stocktake Review report (reports.ts), so the two views agree.
    if (stocktakeStatus === 'never') {
      where.lastReviewDate = null;
    } else if (stocktakeStatus === 'overdue' || stocktakeStatus === 'reviewed') {
      const now = new Date();
      const overdueDate = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
      where.lastReviewDate = stocktakeStatus === 'overdue' ? { lt: overdueDate } : { gte: overdueDate };
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
          location: true,
          ipAddresses: true,
          student: {
            select: {
              id: true,
              firstName: true,
              surname: true
            }
          }
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

    const allowPasswords = canViewDevicePasswords(req);
    res.json({
      data: assets.map((a) => redactAssetPassword(a, allowPasswords)),
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
        ipAddresses: true,
        attachments: true,
        student: {
          select: {
            id: true,
            firstName: true,
            surname: true
          }
        },
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

    res.json(redactAssetPassword(asset, canViewDevicePasswords(req)));
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
      ipAddresses,
      assignedTo,
      studentId,
      locationId,
      warrantyExpiration,
      endOfLifeDate,
      comments,
      businessPurpose,
      businessOwner,
      technicalOwner,
      version,
      criticalityTier,
      dataClassification,
      hostingType,
      supportType,
      internetFacing
    } = req.body;

    if (!itemNumber) {
      return res.status(400).json({ error: 'Item number is required' });
    }

    // Process IPs: accept either single ipAddress or ipAddresses array
    interface IPData {
      ip: string;
      label?: string | null;
    }
    let ipsToCreate: IPData[] = ipAddresses && Array.isArray(ipAddresses) ? ipAddresses : [];
    if (ipAddress && !ipAddresses) {
      ipsToCreate = [{ ip: ipAddress }];
    }

    // Enforce mutual exclusivity: studentId and assignedTo cannot both be set
    const finalAssignedTo = studentId ? null : assignedTo;
    const finalStudentId = studentId || null;

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
        assignedTo: finalAssignedTo,
        studentId: finalStudentId,
        locationId,
        warrantyExpiration: warrantyExpiration ? new Date(warrantyExpiration) : null,
        endOfLifeDate: endOfLifeDate ? new Date(endOfLifeDate) : null,
        comments,
        businessPurpose,
        businessOwner,
        technicalOwner,
        version,
        criticalityTier,
        dataClassification,
        hostingType,
        supportType,
        internetFacing: internetFacing === undefined ? undefined : internetFacing,
        ipAddresses: ipsToCreate.length > 0 ? {
          create: ipsToCreate.map(ip => ({
            ip: ip.ip,
            label: ip.label || null,
            // ip fields
          }))
        } : undefined
      },
      include: {
        category: true,
        manufacturer: true,
        supplier: true,
        location: true,
        ipAddresses: true,
        student: {
          select: {
            id: true,
            firstName: true,
            surname: true
          }
        }
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

    res.status(201).json(redactAssetPassword(asset, canViewDevicePasswords(req)));
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
    // Get current asset for audit log and to preserve name if switching from student
    const current = await prisma.asset.findUnique({
      where: { id },
      include: { student: { select: { firstName: true, surname: true } } }
    });
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
      ipAddresses,
      assignedTo,
      studentId,
      locationId,
      warrantyExpiration,
      endOfLifeDate,
      lastReviewDate,
      decommissionDate,
      comments,
      businessPurpose,
      businessOwner,
      technicalOwner,
      version,
      criticalityTier,
      dataClassification,
      hostingType,
      supportType,
      internetFacing
    } = req.body;

    // Process IPs: accept either single ipAddress or ipAddresses array
    interface IPData {
      ip: string;
      label?: string | null;
    }
    let ipsToUpdate: IPData[] | undefined;
    if (ipAddresses && Array.isArray(ipAddresses)) {
      ipsToUpdate = ipAddresses;
    } else if (ipAddress) {
      ipsToUpdate = [{ ip: ipAddress as string }];
    }

    // Only update IPs if explicitly provided (ipAddresses array)
    // If only ipAddress (single field) is provided, only update the primary IP, don't wipe others
    if (ipAddresses && Array.isArray(ipAddresses)) {
      // Full replacement - delete existing and recreate
      await prisma.assetIP.deleteMany({ where: { assetId: id } });
    } else if (ipAddress) {
      // Only update primary IP - find existing primary and update it, or create new one
      const existingPrimary = await prisma.assetIP.findFirst({
        where: { assetId: id }
      });

      if (existingPrimary) {
        // Update existing primary IP
        await prisma.assetIP.update({
          where: { id: existingPrimary.id },
          data: { ip: ipAddress as string }
        });
        ipsToUpdate = undefined; // Don't recreate
      }
      // else: let the create logic below handle it (no primary IP exists)
    }

    // Enforce mutual exclusivity: studentId and assignedTo cannot both be set
    // If studentId is being removed (was set, now not) and no new assignedTo is provided,
    // restore the student's name in assignedTo
    let finalAssignedTo = studentId ? null : assignedTo;
    const finalStudentId = studentId || null;

    if (!studentId && current.studentId && !assignedTo && current.student) {
      // Switching from Student to Staff/Other mode with no new assignedTo value
      const s = current.student;
      finalAssignedTo = `${s.firstName} ${s.surname}`;
    }

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
        assignedTo: finalAssignedTo,
        studentId: finalStudentId,
        locationId,
        warrantyExpiration: warrantyExpiration ? new Date(warrantyExpiration) : null,
        endOfLifeDate: endOfLifeDate ? new Date(endOfLifeDate) : null,
        lastReviewDate: lastReviewDate ? new Date(lastReviewDate) : null,
        decommissionDate: decommissionDate ? new Date(decommissionDate) : null,
        comments,
        businessPurpose,
        businessOwner,
        technicalOwner,
        version,
        criticalityTier,
        dataClassification,
        hostingType,
        supportType,
        internetFacing: internetFacing === undefined ? undefined : internetFacing
      },
      include: {
        category: true,
        manufacturer: true,
        supplier: true,
        location: true,
        ipAddresses: true,
        student: {
          select: {
            id: true,
            firstName: true,
            surname: true
          }
        }
      }
    });

    // Handle IP creation if needed (only when doing full replacement)
    if (ipsToUpdate && ipsToUpdate.length > 0) {
      await prisma.assetIP.createMany({
        data: ipsToUpdate.map((ipData: IPData) => ({
          assetId: id,
          ip: ipData.ip,
          label: ipData.label || null
        }))
      });
    } else if (ipAddress && !await prisma.assetIP.findFirst({ where: { assetId: id } })) {
      // If single ipAddress provided and none exists, create one
      await prisma.assetIP.create({
        data: {
          assetId: id,
          ip: ipAddress as string
        }
      });
    }

    // Fetch updated asset with IPs
    const updatedAsset = await prisma.asset.findUnique({
      where: { id },
      include: {
        category: true,
        manufacturer: true,
        supplier: true,
        location: true,
        ipAddresses: true,
        student: {
          select: {
            id: true,
            firstName: true,
            surname: true
          }
        }
      }
    });

    // Create audit log - only log actual changes
    const normalizeValue = (value: any): any => {
      // Handle Date objects from database
      if (value instanceof Date) {
        return value.toISOString().split('T')[0];
      }
      // Handle ISO timestamp strings
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return value.split('T')[0];
      }
      return value;
    };

    // Resolve lookup field IDs to friendly names
    const resolveLookupValue = async (fieldName: string, fieldValue: any): Promise<string | null> => {
      if (!fieldValue) return null;

      if (fieldName === 'locationId') {
        const location = await prisma.location.findUnique({ where: { id: fieldValue } });
        return location?.name || fieldValue;
      } else if (fieldName === 'categoryId') {
        const category = await prisma.category.findUnique({ where: { id: fieldValue } });
        return category?.name || fieldValue;
      } else if (fieldName === 'manufacturerId') {
        const manufacturer = await prisma.manufacturer.findUnique({ where: { id: fieldValue } });
        return manufacturer?.name || fieldValue;
      } else if (fieldName === 'supplierId') {
        const supplier = await prisma.supplier.findUnique({ where: { id: fieldValue } });
        return supplier?.name || fieldValue;
      }
      return fieldValue;
    };

    // Mask sensitive fields for audit log
    const maskSensitiveValue = (fieldName: string, value: any): any => {
      if (!value) return value;
      // Mask password fields
      if (['devicePassword'].includes(fieldName)) {
        return typeof value === 'string' ? '••••••••••' : value;
      }
      return value;
    };

    // Build before/after objects with only changed fields
    const beforeData: Record<string, any> = {};
    const afterData: Record<string, any> = {};
    let hasChanges = false;

    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'ipAddress' || key === 'ipAddresses') continue; // Skip IPs, handled separately

      const currentValue = normalizeValue((current as any)[key]);
      const newValue = normalizeValue(value);

      // Compare actual values
      if (JSON.stringify(currentValue) !== JSON.stringify(newValue)) {
        // Resolve lookup fields to friendly names
        if (['locationId', 'categoryId', 'manufacturerId', 'supplierId'].includes(key)) {
          beforeData[key] = await resolveLookupValue(key, (current as any)[key]);
          afterData[key] = await resolveLookupValue(key, value);
        } else {
          // Store actual values (no masking) - masking happens on frontend for display
          // This ensures the frontend can properly detect password changes
          beforeData[key] = currentValue;
          afterData[key] = newValue;
        }
        hasChanges = true;
      }
    }

    // Only create audit log if there are actual changes
    if (hasChanges) {
      await prisma.auditLog.create({
        data: {
          assetId: id,
          userId: req.session.userId,
          action: 'UPDATE',
          changes: JSON.stringify({ before: beforeData, after: afterData }),
          ipAddress: req.ip
        }
      });
    }

    res.json(updatedAsset ? redactAssetPassword(updatedAsset, canViewDevicePasswords(req)) : updatedAsset);
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

// Add IP to asset
router.post('/:id/ips', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;
  const { ip, label } = req.body;

  try {
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }

    // Check if asset exists
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Create the new IP entry
    const assetIP = await prisma.assetIP.create({
      data: {
        assetId: id,
        ip,
        label: label || null
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        assetId: id,
        userId: req.session.userId,
        action: 'UPDATE',
        changes: JSON.stringify({
          before: { ipAddresses: 'unchanged' },
          after: { ipAddresses: `Added IP: ${ip}${label ? ` (${label})` : ''}` }
        }),
        ipAddress: req.ip
      }
    });

    res.status(201).json(assetIP);
  } catch (error) {
    console.error('Error adding IP to asset:', error);
    res.status(500).json({ error: 'Failed to add IP to asset' });
  }
});

// Update IP entry
router.put('/:id/ips/:ipId', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;
  const ipId = req.params.ipId as string;
  const { ip, label } = req.body;

  try {
    // Check if asset exists
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Check if IP entry exists
    const assetIP = await prisma.assetIP.findUnique({ where: { id: ipId } });
    if (!assetIP || assetIP.assetId !== id) {
      return res.status(404).json({ error: 'IP entry not found' });
    }

    // Build before state
    const before = {
      ipAddresses: `${assetIP.ip}${assetIP.label ? ` (${assetIP.label})` : ''}`
    };

    // Update the IP entry
    const updatedIP = await prisma.assetIP.update({
      where: { id: ipId },
      data: {
        ip: ip !== undefined ? ip : undefined,
        label: label !== undefined ? label : undefined
      }
    });

    // Build after state
    const after = {
      ipAddresses: `${updatedIP.ip}${updatedIP.label ? ` (${updatedIP.label})` : ''}`
    };

    // Create audit log
    await prisma.auditLog.create({
      data: {
        assetId: id,
        userId: req.session.userId,
        action: 'UPDATE',
        changes: JSON.stringify({ before, after }),
        ipAddress: req.ip
      }
    });

    res.json(updatedIP);
  } catch (error) {
    console.error('Error updating IP entry:', error);
    res.status(500).json({ error: 'Failed to update IP entry' });
  }
});

// Delete IP from asset
router.delete('/:id/ips/:ipId', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;
  const ipId = req.params.ipId as string;

  try {
    // Check if asset exists
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Check if IP entry exists
    const assetIP = await prisma.assetIP.findUnique({ where: { id: ipId } });
    if (!assetIP || assetIP.assetId !== id) {
      return res.status(404).json({ error: 'IP entry not found' });
    }

    // Delete the IP entry
    await prisma.assetIP.delete({ where: { id: ipId } });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        assetId: id,
        userId: req.session.userId,
        action: 'UPDATE',
        changes: JSON.stringify({
          before: { ipAddresses: `${assetIP.ip}${assetIP.label ? ` (${assetIP.label})` : ''}` },
          after: { ipAddresses: 'removed' }
        }),
        ipAddress: req.ip
      }
    });

    res.json({ success: true, message: 'IP deleted' });
  } catch (error) {
    console.error('Error deleting IP:', error);
    res.status(500).json({ error: 'Failed to delete IP' });
  }
});

export default router;
