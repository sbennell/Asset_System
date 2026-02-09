import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Categories
  const categoryNames = [
    'Infrastructure – Backup System',
    'Infrastructure – Camera',
    'Infrastructure – Firewall',
    'Infrastructure – Network',
    'Infrastructure – NVR',
    'Infrastructure – Power / PDU',
    'Infrastructure – PA System',
    'Infrastructure – Rack / Enclosure',
    'Infrastructure – Server',
    'Infrastructure – Storage',
    'Infrastructure – Switch',
    'Infrastructure – UPS',
    'Infrastructure – Virtualisation Host',
    'Infrastructure – Wireless Access Points',
    'Infrastructure – Wireless LAN Controller',
    'Mobile Device – Phone',
    'Mobile Device – Laptop',
    'Mobile Device – Tablet',
    'Desktop',
    'Monitor',
    'Printer / Photocopier',
    'Digital Signage / TV / Projector',
    'Interactive Whiteboard',
    'Accessories',
    'Camera'
  ];

  const categories = await Promise.all(
    categoryNames.map(name =>
      prisma.category.upsert({
        where: { name },
        update: {},
        create: { name }
      })
    )
  );
  console.log(`Created ${categories.length} categories`);

  // Create Manufacturers
  const manufacturers = await Promise.all([
    prisma.manufacturer.upsert({
      where: { name: 'HP' },
      update: {},
      create: { name: 'HP', website: 'https://www.hp.com', supportUrl: 'https://support.hp.com' }
    }),
    prisma.manufacturer.upsert({
      where: { name: 'Dell' },
      update: {},
      create: { name: 'Dell', website: 'https://www.dell.com', supportUrl: 'https://support.dell.com' }
    }),
    prisma.manufacturer.upsert({
      where: { name: 'Lenovo' },
      update: {},
      create: { name: 'Lenovo', website: 'https://www.lenovo.com', supportUrl: 'https://support.lenovo.com' }
    }),
    prisma.manufacturer.upsert({
      where: { name: 'Apple' },
      update: {},
      create: { name: 'Apple', website: 'https://www.apple.com', supportUrl: 'https://support.apple.com' }
    }),
    prisma.manufacturer.upsert({
      where: { name: 'Cisco' },
      update: {},
      create: { name: 'Cisco', website: 'https://www.cisco.com', supportUrl: 'https://support.cisco.com' }
    }),
    prisma.manufacturer.upsert({
      where: { name: 'Microsoft' },
      update: {},
      create: { name: 'Microsoft', website: 'https://www.microsoft.com' }
    }),
    prisma.manufacturer.upsert({
      where: { name: 'Samsung' },
      update: {},
      create: { name: 'Samsung', website: 'https://www.samsung.com' }
    }),
    prisma.manufacturer.upsert({
      where: { name: 'LG' },
      update: {},
      create: { name: 'LG', website: 'https://www.lg.com' }
    })
  ]);
  console.log(`Created ${manufacturers.length} manufacturers`);

  // Create Suppliers
  const suppliers = await Promise.all([
    prisma.supplier.upsert({
      where: { name: 'CDW' },
      update: {},
      create: { name: 'CDW', website: 'https://www.cdw.com', accountNum: 'CDW-12345' }
    }),
    prisma.supplier.upsert({
      where: { name: 'Insight' },
      update: {},
      create: { name: 'Insight', website: 'https://www.insight.com', accountNum: 'INS-67890' }
    }),
    prisma.supplier.upsert({
      where: { name: 'Amazon Business' },
      update: {},
      create: { name: 'Amazon Business', website: 'https://business.amazon.com' }
    }),
    prisma.supplier.upsert({
      where: { name: 'Direct from Manufacturer' },
      update: {},
      create: { name: 'Direct from Manufacturer' }
    })
  ]);
  console.log(`Created ${suppliers.length} suppliers`);

  // Create Locations
  const locations = await Promise.all([
    prisma.location.upsert({
      where: { name: 'HQ - Floor 1' },
      update: {},
      create: { name: 'HQ - Floor 1', building: 'Headquarters', floor: '1' }
    }),
    prisma.location.upsert({
      where: { name: 'HQ - Floor 2' },
      update: {},
      create: { name: 'HQ - Floor 2', building: 'Headquarters', floor: '2' }
    }),
    prisma.location.upsert({
      where: { name: 'HQ - Server Room' },
      update: {},
      create: { name: 'HQ - Server Room', building: 'Headquarters', floor: 'B1', room: 'SR-01' }
    }),
    prisma.location.upsert({
      where: { name: 'Remote Office - NYC' },
      update: {},
      create: { name: 'Remote Office - NYC', building: 'NYC Branch', address: '123 Broadway, New York, NY' }
    }),
    prisma.location.upsert({
      where: { name: 'Warehouse' },
      update: {},
      create: { name: 'Warehouse', building: 'Storage Facility' }
    }),
    prisma.location.upsert({
      where: { name: 'IT Storage' },
      update: {},
      create: { name: 'IT Storage', building: 'Headquarters', room: 'IT-STORE' }
    })
  ]);
  console.log(`Created ${locations.length} locations`);

  // Get IDs for reference
  const laptop = categories.find(c => c.name === 'Mobile Device – Laptop')!;
  const desktop = categories.find(c => c.name === 'Desktop')!;
  const monitor = categories.find(c => c.name === 'Monitor')!;
  const server = categories.find(c => c.name === 'Infrastructure – Server')!;
  const networkSwitch = categories.find(c => c.name === 'Infrastructure – Switch')!;

  const hp = manufacturers.find(m => m.name === 'HP')!;
  const dell = manufacturers.find(m => m.name === 'Dell')!;
  const lenovo = manufacturers.find(m => m.name === 'Lenovo')!;
  const apple = manufacturers.find(m => m.name === 'Apple')!;
  const cisco = manufacturers.find(m => m.name === 'Cisco')!;
  const samsung = manufacturers.find(m => m.name === 'Samsung')!;
  const lg = manufacturers.find(m => m.name === 'LG')!;

  const cdw = suppliers.find(s => s.name === 'CDW')!;
  const insight = suppliers.find(s => s.name === 'Insight')!;

  const floor1 = locations.find(l => l.name === 'HQ - Floor 1')!;
  const floor2 = locations.find(l => l.name === 'HQ - Floor 2')!;
  const serverRoom = locations.find(l => l.name === 'HQ - Server Room')!;
  const itStorage = locations.find(l => l.name === 'IT Storage')!;

  // Create Assets
  const assets = [
    {
      itemNumber: 'AST-001',
      serialNumber: '5CG1234567',
      manufacturerId: hp.id,
      model: 'ProBook 450 G8',
      categoryId: laptop.id,
      description: '15.6" laptop, Intel i5, 16GB RAM, 512GB SSD',
      status: 'In Use',
      condition: 'GOOD',
      acquiredDate: new Date('2023-06-15'),
      purchasePrice: 899.99,
      supplierId: cdw.id,
      orderNumber: 'PO-2023-0156',
      hostname: 'WS-JSMITH01',
      ipAddress: '192.168.1.101',
      lanMacAddress: '00:1A:2B:3C:4D:5E',
      assignedTo: 'John Smith',
      locationId: floor1.id,
      warrantyExpiration: new Date('2026-06-15')
    },
    {
      itemNumber: 'AST-002',
      serialNumber: '5CG7654321',
      manufacturerId: hp.id,
      model: 'ProBook 450 G8',
      categoryId: laptop.id,
      description: '15.6" laptop, Intel i5, 16GB RAM, 512GB SSD',
      status: 'In Use',
      condition: 'GOOD',
      acquiredDate: new Date('2023-06-15'),
      purchasePrice: 899.99,
      supplierId: cdw.id,
      orderNumber: 'PO-2023-0156',
      hostname: 'WS-JDOE01',
      ipAddress: '192.168.1.102',
      lanMacAddress: '00:1A:2B:3C:4D:5F',
      assignedTo: 'Jane Doe',
      locationId: floor1.id,
      warrantyExpiration: new Date('2026-06-15')
    },
    {
      itemNumber: 'AST-003',
      serialNumber: 'FVFXYZ123456',
      manufacturerId: apple.id,
      model: 'MacBook Pro 14"',
      categoryId: laptop.id,
      description: 'M3 Pro, 18GB RAM, 512GB SSD',
      status: 'In Use',
      condition: 'EXCELLENT',
      acquiredDate: new Date('2024-01-10'),
      purchasePrice: 1999.00,
      supplierId: insight.id,
      orderNumber: 'PO-2024-0012',
      hostname: 'MAC-DESIGN01',
      assignedTo: 'Sarah Designer',
      locationId: floor2.id,
      warrantyExpiration: new Date('2027-01-10')
    },
    {
      itemNumber: 'AST-004',
      serialNumber: 'PF2ABC789',
      manufacturerId: dell.id,
      model: 'OptiPlex 7090',
      categoryId: desktop.id,
      description: 'Intel i7, 32GB RAM, 1TB SSD',
      status: 'In Use',
      condition: 'GOOD',
      acquiredDate: new Date('2022-11-20'),
      purchasePrice: 1299.00,
      supplierId: cdw.id,
      orderNumber: 'PO-2022-0289',
      hostname: 'WS-RECEPTION',
      ipAddress: '192.168.1.50',
      lanMacAddress: '00:AA:BB:CC:DD:01',
      assignedTo: 'Reception Desk',
      locationId: floor1.id,
      warrantyExpiration: new Date('2025-11-20')
    },
    {
      itemNumber: 'AST-005',
      serialNumber: 'CN-0123456',
      manufacturerId: samsung.id,
      model: 'S27A800',
      categoryId: monitor.id,
      description: '27" 4K UHD Monitor',
      status: 'In Use',
      condition: 'GOOD',
      acquiredDate: new Date('2023-03-01'),
      purchasePrice: 449.99,
      supplierId: cdw.id,
      orderNumber: 'PO-2023-0078',
      assignedTo: 'John Smith',
      locationId: floor1.id,
      warrantyExpiration: new Date('2026-03-01')
    },
    {
      itemNumber: 'AST-006',
      serialNumber: 'CN-0654321',
      manufacturerId: lg.id,
      model: '27UK850-W',
      categoryId: monitor.id,
      description: '27" 4K UHD Monitor with USB-C',
      status: 'In Use',
      condition: 'GOOD',
      acquiredDate: new Date('2023-03-01'),
      purchasePrice: 499.99,
      supplierId: cdw.id,
      orderNumber: 'PO-2023-0078',
      assignedTo: 'Jane Doe',
      locationId: floor1.id,
      warrantyExpiration: new Date('2026-03-01')
    },
    {
      itemNumber: 'SRV-001',
      serialNumber: 'MXQ93812AB',
      manufacturerId: dell.id,
      model: 'PowerEdge R750',
      categoryId: server.id,
      description: '2x Xeon Gold, 256GB RAM, 8x 1.2TB SAS',
      status: 'In Use',
      condition: 'EXCELLENT',
      acquiredDate: new Date('2023-09-01'),
      purchasePrice: 12500.00,
      supplierId: insight.id,
      orderNumber: 'PO-2023-0201',
      hostname: 'SRV-APP01',
      ipAddress: '10.0.0.10',
      lanMacAddress: 'F0:F0:F0:00:00:01',
      locationId: serverRoom.id,
      warrantyExpiration: new Date('2028-09-01'),
      comments: 'Primary application server'
    },
    {
      itemNumber: 'SRV-002',
      serialNumber: 'MXQ93812AC',
      manufacturerId: dell.id,
      model: 'PowerEdge R750',
      categoryId: server.id,
      description: '2x Xeon Gold, 256GB RAM, 8x 1.2TB SAS',
      status: 'In Use',
      condition: 'EXCELLENT',
      acquiredDate: new Date('2023-09-01'),
      purchasePrice: 12500.00,
      supplierId: insight.id,
      orderNumber: 'PO-2023-0201',
      hostname: 'SRV-DB01',
      ipAddress: '10.0.0.11',
      lanMacAddress: 'F0:F0:F0:00:00:02',
      locationId: serverRoom.id,
      warrantyExpiration: new Date('2028-09-01'),
      comments: 'Primary database server'
    },
    {
      itemNumber: 'NET-001',
      serialNumber: 'FCW2345X0AB',
      manufacturerId: cisco.id,
      model: 'Catalyst 9300-48P',
      categoryId: networkSwitch.id,
      description: '48-port PoE+ managed switch',
      status: 'In Use',
      condition: 'GOOD',
      acquiredDate: new Date('2022-06-01'),
      purchasePrice: 8500.00,
      supplierId: cdw.id,
      orderNumber: 'PO-2022-0145',
      hostname: 'SW-CORE-01',
      ipAddress: '10.0.0.1',
      locationId: serverRoom.id,
      warrantyExpiration: new Date('2027-06-01'),
      comments: 'Core network switch'
    },
    {
      itemNumber: 'NET-002',
      serialNumber: 'FCW2345X0AC',
      manufacturerId: cisco.id,
      model: 'Catalyst 9200-24P',
      categoryId: networkSwitch.id,
      description: '24-port PoE+ managed switch',
      status: 'In Use',
      condition: 'GOOD',
      acquiredDate: new Date('2022-06-01'),
      purchasePrice: 4200.00,
      supplierId: cdw.id,
      orderNumber: 'PO-2022-0145',
      hostname: 'SW-FL1-01',
      ipAddress: '10.0.0.2',
      locationId: floor1.id,
      warrantyExpiration: new Date('2027-06-01'),
      comments: 'Floor 1 access switch'
    },
    {
      itemNumber: 'AST-007',
      serialNumber: 'PC0OLD12345',
      manufacturerId: lenovo.id,
      model: 'ThinkPad T480',
      categoryId: laptop.id,
      description: 'Intel i5-8250U, 8GB RAM, 256GB SSD',
      status: 'Decommissioned - In storage',
      condition: 'FAIR',
      acquiredDate: new Date('2019-04-15'),
      purchasePrice: 1199.00,
      hostname: 'WS-SPARE01',
      locationId: itStorage.id,
      warrantyExpiration: new Date('2022-04-15'),
      comments: 'Spare laptop for emergencies'
    },
    {
      itemNumber: 'AST-008',
      serialNumber: 'OLDMON54321',
      manufacturerId: dell.id,
      model: 'P2419H',
      categoryId: monitor.id,
      description: '24" FHD Monitor',
      status: 'Decommissioned - Beyond service age',
      condition: 'POOR',
      acquiredDate: new Date('2017-08-01'),
      purchasePrice: 299.99,
      locationId: itStorage.id,
      decommissionDate: new Date('2024-01-15'),
      comments: 'Screen flickering, replaced'
    }
  ];

  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { itemNumber: asset.itemNumber },
      update: {},
      create: asset
    });
  }
  console.log(`Created ${assets.length} assets`);

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
