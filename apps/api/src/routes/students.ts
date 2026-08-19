import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync } from 'fs';
import ExcelJS from 'exceljs';
import { requireAuth, requirePermission } from './auth.js';
import { runStudentImport, reconcileAssetsByStudentName } from '../services/studentImporter.js';
import { generateStudentLoginCards } from '../services/studentLoginCardService.js';
import { canViewStudentPasswords, redactStudentPassword } from '../lib/redact.js';

const router = Router();

// Apply auth to all routes
router.use(requireAuth, requirePermission('canAccessStudents'));

// Build the shared students where-clause from list/export query params
function buildStudentWhere(query: Request['query']): Prisma.StudentWhereInput {
  const { search, status, schoolYear, homeGroup } = query;
  const where: Prisma.StudentWhereInput = {};

  if (search) {
    const searchStr = search as string;
    const searchParts = searchStr.trim().split(/\s+/);

    // Build search conditions for full name and individual parts
    const searchConditions: Prisma.StudentWhereInput[] = [
      { firstName: { contains: searchStr } },
      { surname: { contains: searchStr } },
      { email: { contains: searchStr } },
      { username: { contains: searchStr } }
    ];

    // If search contains space, also try full name combinations with startsWith
    if (searchParts.length >= 2) {
      // Try "firstName surname" combination (surname starts with second part)
      searchConditions.push({
        AND: [
          { firstName: { contains: searchParts[0] } },
          { surname: { startsWith: searchParts[1] } }
        ]
      });
      // Try reverse "surname firstName" combination (firstName starts with second part)
      searchConditions.push({
        AND: [
          { firstName: { startsWith: searchParts[1] } },
          { surname: { contains: searchParts[0] } }
        ]
      });
    }

    where.OR = searchConditions;
  }

  // Build status filter with AND to exclude "Left"
  if (status && status !== '_all') {
    where.AND = [
      { status: status as string },
      { status: { not: 'Left' } }
    ];
  } else {
    // Always exclude students with "Left" status
    where.status = { not: 'Left' };
  }

  if (schoolYear && schoolYear !== '_all') {
    where.schoolYear = schoolYear as string;
  }

  if (homeGroup && homeGroup !== '_all') {
    where.homeGroup = homeGroup as string;
  }

  return where;
}

// List students with pagination, filtering, and sorting
router.get('/', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const {
      page = '1',
      limit = '50',
      sortBy = 'firstName',
      sortOrder = 'asc'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where = buildStudentWhere(req.query);

    // Build orderBy
    const orderBy: Prisma.StudentOrderByWithRelationInput = {
      [sortBy as string]: sortOrder as 'asc' | 'desc'
    };

    // Get total count and students
    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        select: {
          id: true,
          firstName: true,
          surname: true,
          homeGroup: true,
          schoolYear: true,
          status: true,
          email: true,
          createdAt: true,
          updatedAt: true
          // Note: password is explicitly NOT returned in list view
        }
      })
    ]);

    res.json({
      data: students,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Search students (lightweight for combobox)
router.get('/search', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const { q = '' } = req.query;
    const query = (q as string).trim();

    if (query.length < 2) {
      return res.json([]);
    }

    const queryParts = query.split(/\s+/);

    // Build search conditions for full name and individual parts
    const searchConditions: Prisma.StudentWhereInput[] = [
      { firstName: { contains: query } },
      { surname: { contains: query } },
      { email: { contains: query } }
    ];

    // If search contains space, also try full name combinations with startsWith
    if (queryParts.length >= 2) {
      // Try "firstName surname" combination (surname starts with second part)
      searchConditions.push({
        AND: [
          { firstName: { contains: queryParts[0] } },
          { surname: { startsWith: queryParts[1] } }
        ]
      });
      // Try reverse "surname firstName" combination (firstName starts with second part)
      searchConditions.push({
        AND: [
          { firstName: { startsWith: queryParts[1] } },
          { surname: { contains: queryParts[0] } }
        ]
      });
    }

    const students = await prisma.student.findMany({
      where: {
        OR: searchConditions
      },
      select: {
        id: true,
        firstName: true,
        surname: true,
        schoolYear: true,
        homeGroup: true
      },
      take: 20
    });

    res.json(students);
  } catch (error) {
    console.error('Error searching students:', error);
    res.status(500).json({ error: 'Failed to search students' });
  }
});

// Get unique student statuses (excluding "Left")
router.get('/statuses', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const statuses = await prisma.student.findMany({
      select: { status: true },
      distinct: ['status'],
      where: { status: { not: 'Left' } },
      orderBy: { status: 'asc' }
    });

    const uniqueStatuses = statuses.map(s => s.status).filter(Boolean);
    res.json(uniqueStatuses);
  } catch (error) {
    console.error('Error fetching student statuses:', error);
    res.status(500).json({ error: 'Failed to fetch student statuses' });
  }
});

// Get unique year levels
router.get('/year-levels', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const yearLevels = await prisma.student.findMany({
      select: { schoolYear: true },
      distinct: ['schoolYear'],
      orderBy: { schoolYear: 'asc' }
    });

    const uniqueYearLevels = yearLevels.map(y => y.schoolYear).filter(Boolean);
    res.json(uniqueYearLevels);
  } catch (error) {
    console.error('Error fetching year levels:', error);
    res.status(500).json({ error: 'Failed to fetch year levels' });
  }
});

// Get unique home groups
router.get('/home-groups', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const homeGroups = await prisma.student.findMany({
      select: { homeGroup: true },
      distinct: ['homeGroup'],
      orderBy: { homeGroup: 'asc' }
    });

    const uniqueHomeGroups = homeGroups.map(h => h.homeGroup).filter(Boolean);
    res.json(uniqueHomeGroups);
  } catch (error) {
    console.error('Error fetching home groups:', error);
    res.status(500).json({ error: 'Failed to fetch home groups' });
  }
});

// Get import file headers
router.get('/import/headers', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const fileSetting = await prisma.settings.findUnique({ where: { key: 'studentImportFile' } });

    if (!fileSetting?.value) {
      return res.status(400).json({ error: 'Import file not configured' });
    }

    const filePath = fileSetting.value.replace(/\\/g, '/');
    const content = readFileSync(filePath, 'utf8');
    const firstLine = content.split(/\r?\n/)[0];
    const headers = firstLine
      .split(',')
      .map(h => h.trim().replace(/^"|"$/g, ''));

    res.json(headers);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Import file not found' });
    }
    console.error('Error reading import file headers:', error);
    res.status(500).json({ error: 'Failed to read import file headers' });
  }
});

// Download student login cards as PDF
router.get('/login-cards', requirePermission('canViewStudentPasswords'), async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const { homeGroup, schoolYear, studentId } = req.query;

    // Build where clause
    const where: Prisma.StudentWhereInput = {
      status: { not: 'Left' }
    };

    if (studentId) {
      where.id = studentId as string;
    } else if (homeGroup) {
      where.homeGroup = homeGroup as string;
    } else if (schoolYear) {
      where.schoolYear = schoolYear as string;
    }

    // Fetch students sorted alphabetically
    const students = await prisma.student.findMany({
      where,
      orderBy: [{ surname: 'asc' }, { firstName: 'asc' }],
      select: {
        firstName: true,
        surname: true,
        homeGroup: true,
        schoolYear: true,
        username: true,
        email: true,
        password: true
      }
    });

    // Generate PDF
    const pdfBytes = await generateStudentLoginCards(students);

    // Determine filename based on filter
    const slugify = (value: string) => value.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');

    let filename = 'login-cards-all.pdf';
    if (studentId) {
      const student = students[0];
      if (student) {
        const parts = [student.firstName, student.surname, student.homeGroup]
          .filter((part): part is string => !!part && part.trim().length > 0)
          .map(slugify);
        filename = `login-card-${parts.join('-')}.pdf`;
      } else {
        filename = 'login-card.pdf';
      }
    } else if (homeGroup) {
      filename = `login-cards-${(homeGroup as string).replace(/\s+/g, '-')}.pdf`;
    } else if (schoolYear) {
      filename = `login-cards-year${schoolYear}.pdf`;
    }

    // Send PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Error generating login cards:', error);
    res.status(500).json({ error: 'Failed to generate login cards' });
  }
});

// Field catalog for GET /export - keys must stay in sync with the checkboxes in
// apps/web/src/components/StudentExportModal.tsx
const STUDENT_EXPORT_FIELDS: Record<string, { header: string; width: number }> = {
  firstName: { header: 'First Name', width: 16 },
  surname: { header: 'Surname', width: 16 },
  homeGroup: { header: 'Home Group', width: 14 },
  schoolYear: { header: 'Year Level', width: 12 },
  status: { header: 'Status', width: 14 },
  email: { header: 'Email', width: 28 },
  username: { header: 'Username', width: 18 },
  edupassUsername: { header: 'Edupass Username', width: 20 },
  birthdate: { header: 'Birthdate', width: 14 },
  password: { header: 'Password', width: 16 }
};

const ASSET_EXPORT_FIELDS: Record<string, { header: string; width: number }> = {
  itemNumber: { header: 'Item Number', width: 16 },
  category: { header: 'Category', width: 16 },
  manufacturer: { header: 'Manufacturer', width: 16 },
  model: { header: 'Model', width: 20 },
  serialNumber: { header: 'Serial Number', width: 20 },
  description: { header: 'Description', width: 28 },
  assetStatus: { header: 'Asset Status', width: 16 },
  condition: { header: 'Condition', width: 12 },
  location: { header: 'Location', width: 18 },
  acquiredDate: { header: 'Acquired Date', width: 14 },
  warrantyExpiration: { header: 'Warranty Expiration', width: 18 },
  orderNumber: { header: 'Order Number', width: 15 },
  supplier: { header: 'Supplier', width: 18 },
  comments: { header: 'Comments', width: 30 }
};

const DEFAULT_STUDENT_EXPORT_FIELDS = ['firstName', 'surname', 'homeGroup', 'schoolYear', 'status', 'email'];
const DEFAULT_ASSET_EXPORT_FIELDS = ['itemNumber', 'category', 'manufacturer', 'model', 'serialNumber'];

// Maps an asset export field to its Prisma select shape (relations need a nested select)
const ASSET_FIELD_SELECT: Record<string, Prisma.AssetSelect> = {
  itemNumber: { itemNumber: true },
  category: { category: { select: { name: true } } },
  manufacturer: { manufacturer: { select: { name: true } } },
  model: { model: true },
  serialNumber: { serialNumber: true },
  description: { description: true },
  assetStatus: { status: true },
  condition: { condition: true },
  location: { location: { select: { name: true } } },
  acquiredDate: { acquiredDate: true },
  warrantyExpiration: { warrantyExpiration: true },
  orderNumber: { orderNumber: true },
  supplier: { supplier: { select: { name: true } } },
  comments: { comments: true }
};

// Reads an asset export field's value off the fetched asset row (handles relation fields)
function getAssetFieldValue(asset: any, field: string) {
  switch (field) {
    case 'category': return asset.category?.name ?? null;
    case 'manufacturer': return asset.manufacturer?.name ?? null;
    case 'location': return asset.location?.name ?? null;
    case 'supplier': return asset.supplier?.name ?? null;
    case 'assetStatus': return asset.status ?? null;
    default: return asset[field] ?? null;
  }
}

// Export students (with their assigned assets) to Excel, honoring the same filters as the list
// view plus a caller-selected set of columns (?fields=firstName,surname,itemNumber,...)
router.get('/export', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const fieldsParam = req.query.fields;
    const requestedFields = typeof fieldsParam === 'string' && fieldsParam.trim()
      ? fieldsParam.split(',').map((f) => f.trim()).filter(Boolean)
      : [...DEFAULT_STUDENT_EXPORT_FIELDS, ...DEFAULT_ASSET_EXPORT_FIELDS];

    const canViewPasswords = canViewStudentPasswords(req);
    const studentFields = requestedFields.filter(
      (f) => f in STUDENT_EXPORT_FIELDS && (f !== 'password' || canViewPasswords)
    );
    const assetFields = requestedFields.filter((f) => f in ASSET_EXPORT_FIELDS);

    if (studentFields.length === 0 && assetFields.length === 0) {
      res.status(400).json({ error: 'At least one field must be selected' });
      return;
    }

    const where = buildStudentWhere(req.query);
    const { sortBy = 'firstName', sortOrder = 'asc' } = req.query;
    const orderBy: Prisma.StudentOrderByWithRelationInput = {
      [sortBy as string]: sortOrder as 'asc' | 'desc'
    };

    const studentSelect: Record<string, any> = {};
    for (const f of studentFields) studentSelect[f] = true;
    if (assetFields.length > 0) {
      const assetSelect: Record<string, any> = {};
      for (const f of assetFields) Object.assign(assetSelect, ASSET_FIELD_SELECT[f]);
      studentSelect.assets = { select: assetSelect, orderBy: { itemNumber: 'asc' } };
    }

    const students = await prisma.student.findMany({
      where,
      orderBy,
      select: studentSelect
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'IT Management System (ITMS)';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Students');
    worksheet.columns = [
      ...studentFields.map((f) => ({ header: STUDENT_EXPORT_FIELDS[f].header, key: `student_${f}`, width: STUDENT_EXPORT_FIELDS[f].width })),
      ...assetFields.map((f) => ({ header: ASSET_EXPORT_FIELDS[f].header, key: `asset_${f}`, width: ASSET_EXPORT_FIELDS[f].width }))
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 20;

    for (const student of students as any[]) {
      const studentColumns: Record<string, any> = {};
      for (const f of studentFields) studentColumns[`student_${f}`] = student[f];

      const assets: any[] = assetFields.length > 0 ? student.assets : [];

      if (assets.length === 0) {
        worksheet.addRow(studentColumns);
        continue;
      }

      for (const asset of assets) {
        const row = { ...studentColumns };
        for (const f of assetFields) row[`asset_${f}`] = getAssetFieldValue(asset, f);
        worksheet.addRow(row);
      }
    }

    if (studentFields.includes('birthdate')) worksheet.getColumn('student_birthdate').numFmt = 'dd-mm-yyyy';
    if (assetFields.includes('acquiredDate')) worksheet.getColumn('asset_acquiredDate').numFmt = 'yyyy-mm-dd';
    if (assetFields.includes('warrantyExpiration')) worksheet.getColumn('asset_warrantyExpiration').numFmt = 'yyyy-mm-dd';

    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `students-export-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting students:', error);
    res.status(500).json({ error: 'Failed to export students' });
  }
});

// Get single student
router.get('/:id', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;

  try {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        assets: {
          select: {
            id: true,
            itemNumber: true,
            model: true,
            categoryId: true,
            status: true,
            createdAt: true,
            category: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(redactStudentPassword(student, canViewStudentPasswords(req)));
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// Create student
router.post('/', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const {
      firstName,
      surname,
      homeGroup,
      schoolYear,
      status,
      birthdate,
      username,
      edupassUsername,
      email,
      password
    } = req.body;

    // Validate required fields
    if (!firstName || !surname) {
      return res.status(400).json({ error: 'First name and surname are required' });
    }

    const student = await prisma.student.create({
      data: {
        firstName,
        surname,
        homeGroup: homeGroup || null,
        schoolYear: schoolYear || null,
        status: status || 'Active',
        birthdate: birthdate ? new Date(birthdate) : null,
        username: username || null,
        edupassUsername: edupassUsername || null,
        email: email || null,
        password: password || null
      }
    });

    res.status(201).json(redactStudentPassword(student, canViewStudentPasswords(req)));
  } catch (error: any) {
    console.error('Error creating student:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A student with this data already exists' });
    }
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// Update student
router.put('/:id', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;

  try {
    const {
      firstName,
      surname,
      homeGroup,
      schoolYear,
      status,
      birthdate,
      username,
      edupassUsername,
      email,
      password
    } = req.body;

    // Validate required fields
    if (!firstName || !surname) {
      return res.status(400).json({ error: 'First name and surname are required' });
    }

    // Build update data
    const updateData: any = {
      firstName,
      surname,
      homeGroup: homeGroup || null,
      schoolYear: schoolYear || null,
      status: status || 'Active',
      birthdate: birthdate ? new Date(birthdate) : null,
      username: username || null,
      edupassUsername: edupassUsername || null,
      email: email || null
    };

    // Only update password if provided and not empty
    if (password && password.trim() !== '') {
      updateData.password = password;
    }

    const student = await prisma.student.update({
      where: { id },
      data: updateData
    });

    res.json(redactStudentPassword(student, canViewStudentPasswords(req)));
  } catch (error: any) {
    console.error('Error updating student:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Delete student
router.delete('/:id', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;
  const id = req.params.id as string;

  try {
    // Get student before deleting
    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true, firstName: true, surname: true }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Build student name to restore in assignedTo
    const studentName = `${student.firstName} ${student.surname}`;

    // Set studentId to null and restore name in assignedTo for all linked assets
    await prisma.asset.updateMany({
      where: { studentId: id },
      data: { studentId: null, assignedTo: studentName }
    });

    // Then delete the student
    const deletedStudent = await prisma.student.delete({
      where: { id }
    });

    res.json({ success: true, student: deletedStudent });
  } catch (error: any) {
    console.error('Error deleting student:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Manual import trigger
router.post('/import/run', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const result = await runStudentImport(prisma);
    res.json(result);
  } catch (error) {
    console.error('Error running student import:', error);
    res.status(500).json({ error: 'Failed to run import' });
  }
});

// Reconcile assets by student name
router.post('/reconcile-assets', async (req: Request, res: Response) => {
  const prisma = req.app.locals.prisma as PrismaClient;

  try {
    const result = await reconcileAssetsByStudentName(prisma);
    res.json(result);
  } catch (error) {
    console.error('Error reconciling assets:', error);
    res.status(500).json({ error: 'Failed to reconcile assets' });
  }
});

export default router;
