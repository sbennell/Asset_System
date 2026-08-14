import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';

const router = Router();

// This router is intentionally unauthenticated (see README.md "Public (no authentication)"),
// so keep the limiter tight enough to blunt serial-number enumeration.
const lookupRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

// Look up an asset's item number by serial number. No auth - used by device-side scripts
// (e.g. LockScreenInfo) that run as SYSTEM with no ITMS credentials available. Only returns
// itemNumber to keep disclosure minimal on a route with no auth.
router.get('/asset-by-serial/:serialNumber', lookupRateLimiter, async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const serialNumber = (req.params.serialNumber as string || '').trim();

  if (!serialNumber) {
    return res.status(400).json({ error: 'Serial number is required' });
  }

  try {
    const asset = await prisma.asset.findFirst({
      where: { serialNumber },
      select: { itemNumber: true }
    });

    if (!asset) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({ itemNumber: asset.itemNumber });
  } catch (error) {
    console.error('Error looking up asset by serial number:', error);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

export default router;
