/**
 * Seed Script — Categories + Products
 * Run: node utils/seedProducts.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');
const Product = require('../models/Product');

const placeholder = (name) =>
  `https://placehold.co/600x400/0b1f3b/f5b400?text=${encodeURIComponent(name)}`;

const categories = [
  { name: 'Switches & Sockets', slug: 'switches-sockets', icon: '🔌', description: 'Modular switches, sockets and plates' },
  { name: 'Wires & Cables', slug: 'wires-cables', icon: '🔋', description: 'Copper wires, PVC cables and multi-core cables' },
  { name: 'Fans', slug: 'fans', icon: '🌀', description: 'Ceiling fans, exhaust fans and wall fans' },
  { name: 'Lighting', slug: 'lighting', icon: '💡', description: 'LED bulbs, tube lights and battens' },
  { name: 'MCB & Distribution', slug: 'mcb-distribution', icon: '⚡', description: 'MCBs, distribution boards and RCCBs' },
  { name: 'Tools & Accessories', slug: 'tools-accessories', icon: '🔧', description: 'Electrical tools, testers and accessories' },
];

const buildProducts = (cats) => {
  const byCat = {};
  cats.forEach((c) => { byCat[c.slug] = c._id; });

  return [
    {
      name: 'Havells 6A Standard Switch',
      description: 'Premium 6A modular switch from Havells with superior click feel and long operational life of over 100,000 cycles. Fire-retardant polycarbonate body ensures safety.',
      price: 95,
      category: byCat['switches-sockets'],
      stock: 120,
      brand: 'Havells',
      ratings: 4.5,
      numReviews: 38,
      featured: true,
      isActive: true,
      images: [{ url: placeholder('Havells Switch'), public_id: 'seed-1' }],
      specifications: new Map([['Type', 'Modular'], ['Rating', '6A / 240V'], ['Color', 'White'], ['Mounting', 'Surface / Flush']]),
    },
    {
      name: 'Anchor Roma 6-Module Plate',
      description: 'Anchor Roma 6-module cover plates in classic white finish. Compatible with all Roma accessories. Available in multiple colors.',
      price: 180,
      category: byCat['switches-sockets'],
      stock: 85,
      brand: 'Anchor',
      ratings: 4.3,
      numReviews: 21,
      featured: false,
      isActive: true,
      images: [{ url: placeholder('Anchor Plate'), public_id: 'seed-2' }],
      specifications: new Map([['Modules', '6'], ['Material', 'Polycarbonate'], ['Color', 'White'], ['Standard', 'IS 3854']]),
    },
    {
      name: 'Polycab Copper Wire 1.5 sq.mm (90m)',
      description: 'Polycab 1.5 sq.mm FR PVC insulated single-core copper wire. Ideal for domestic electrical wiring with excellent conductivity and heat resistance.',
      price: 820,
      category: byCat['wires-cables'],
      stock: 60,
      brand: 'Polycab',
      ratings: 4.7,
      numReviews: 54,
      featured: true,
      isActive: true,
      images: [{ url: placeholder('Polycab Wire'), public_id: 'seed-3' }],
      specifications: new Map([['Cross Section', '1.5 sq.mm'], ['Length', '90 metres'], ['Insulation', 'FR PVC'], ['Conductor', 'Multi-strand copper']]),
    },
    {
      name: 'Finolex 4 sq.mm 3-Core Flat Cable (100m)',
      description: 'Finolex heavy-duty 4 sq.mm 3-core flat cable for sub-main wiring and power connections. Flame-retardant and RoHS compliant.',
      price: 3400,
      category: byCat['wires-cables'],
      stock: 25,
      brand: 'Finolex',
      ratings: 4.6,
      numReviews: 29,
      featured: false,
      isActive: true,
      images: [{ url: placeholder('Finolex Cable'), public_id: 'seed-4' }],
      specifications: new Map([['Cross Section', '4 sq.mm'], ['Cores', '3'], ['Length', '100 metres'], ['Voltage Rating', '1100V']]),
    },
    {
      name: 'Crompton HS Plus 1200mm Ceiling Fan',
      description: 'Energy-efficient Crompton HS Plus 1200mm ceiling fan with BLDC motor. Consumes only 28W and delivers superior air delivery with silent operation.',
      price: 3999,
      category: byCat['fans'],
      stock: 30,
      brand: 'Crompton',
      ratings: 4.4,
      numReviews: 67,
      featured: true,
      isActive: true,
      images: [{ url: placeholder('Crompton Fan'), public_id: 'seed-5' }],
      specifications: new Map([['Sweep', '1200mm'], ['Power', '28W (BLDC)'], ['Speed', '340 RPM'], ['Air Delivery', '210 CMM']]),
    },
    {
      name: 'Bajaj Midea 250mm Exhaust Fan',
      description: 'Bajaj Midea 250mm exhaust fan ideal for kitchens, bathrooms and small rooms. High air suction with low noise operation and dust-resistant shutter.',
      price: 1099,
      category: byCat['fans'],
      stock: 45,
      brand: 'Bajaj',
      ratings: 4.1,
      numReviews: 33,
      featured: false,
      isActive: true,
      images: [{ url: placeholder('Bajaj Exhaust'), public_id: 'seed-6' }],
      specifications: new Map([['Blade Size', '250mm'], ['Power', '30W'], ['Voltage', '230V / 50Hz'], ['Speed', '1350 RPM']]),
    },
    {
      name: 'Philips Stellar Bright 9W LED Bulb (Pack of 4)',
      description: 'Philips 9W LED bulb with 950 lumens output. Energy saving replacement for 60W incandescent bulb. 2 year warranty included.',
      price: 399,
      category: byCat['lighting'],
      stock: 200,
      brand: 'Philips',
      ratings: 4.6,
      numReviews: 112,
      featured: true,
      isActive: true,
      images: [{ url: placeholder('Philips LED'), public_id: 'seed-7' }],
      specifications: new Map([['Wattage', '9W'], ['Lumens', '950 lm'], ['Color Temp', '6500K Cool Day Light'], ['Life', '15,000 hours']]),
    },
    {
      name: 'Syska T5 18W LED Tube Light',
      description: 'Syska T5 18W integrated LED tube light with aluminium body and milky diffuser. Instant start, flicker-free, ideal for offices and showrooms.',
      price: 485,
      category: byCat['lighting'],
      stock: 95,
      brand: 'Syska',
      ratings: 4.3,
      numReviews: 44,
      featured: false,
      isActive: true,
      images: [{ url: placeholder('Syska Tube'), public_id: 'seed-8' }],
      specifications: new Map([['Wattage', '18W'], ['Length', '1200mm (4 ft)'], ['Lumens', '1800 lm'], ['IP Rating', 'IP20']]),
    },
    {
      name: 'Legrand 16A Single-Pole MCB C-Curve',
      description: 'Legrand 16A single-pole MCB C-Curve for residential and light commercial applications. IEC 60898 compliant with 6kA breaking capacity.',
      price: 320,
      category: byCat['mcb-distribution'],
      stock: 70,
      brand: 'Legrand',
      ratings: 4.7,
      numReviews: 58,
      featured: true,
      isActive: true,
      images: [{ url: placeholder('Legrand MCB'), public_id: 'seed-9' }],
      specifications: new Map([['Rating', '16A'], ['Poles', 'Single'], ['Curve', 'C-Curve'], ['Breaking Capacity', '6kA']]),
    },
    {
      name: 'Schneider Acti9 8-Way Distribution Board',
      description: 'Schneider Acti9 8-way single-phase distribution board with Double Door. IP30 protection with DIN rail for MCB mounting. Pre-wired neutral bar.',
      price: 2850,
      category: byCat['mcb-distribution'],
      stock: 18,
      brand: 'Schneider Electric',
      ratings: 4.8,
      numReviews: 23,
      featured: true,
      isActive: true,
      images: [{ url: placeholder('Schneider DB'), public_id: 'seed-10' }],
      specifications: new Map([['Ways', '8'], ['Phase', 'Single Phase'], ['IP Rating', 'IP30'], ['Standard', 'IEC 61439-3']]),
    },
    {
      name: 'Havells 32A DP RCCB 30mA',
      description: 'Havells Crabtree 32A Double Pole RCCB with 30mA sensitivity. Protects against earth leakage and electrocution. High immunity to nuisance tripping.',
      price: 980,
      category: byCat['mcb-distribution'],
      stock: 40,
      brand: 'Havells',
      ratings: 4.5,
      numReviews: 31,
      featured: false,
      isActive: true,
      images: [{ url: placeholder('Havells RCCB'), public_id: 'seed-11' }],
      specifications: new Map([['Rating', '32A'], ['Poles', 'Double Pole'], ['Sensitivity', '30mA'], ['Standard', 'IS 12640']]),
    },
    {
      name: 'Stanley FatMax Electrical Tester Screwdriver Set (6-Piece)',
      description: 'Stanley 6-piece electrical tester and screwdriver set with VDE-rated insulation up to 1000V AC. Includes a neon voltage tester for quick circuit checks.',
      price: 649,
      category: byCat['tools-accessories'],
      stock: 55,
      brand: 'Stanley',
      ratings: 4.4,
      numReviews: 76,
      featured: true,
      isActive: true,
      images: [{ url: placeholder('Stanley Tools'), public_id: 'seed-12' }],
      specifications: new Map([['Pieces', '6'], ['Insulation', 'VDE 1000V AC'], ['Handle', 'Bi-material CushionGrip'], ['Includes', 'Voltage Tester']]),
    },
    {
      name: 'Anchor Casing-Capping 1" x 100ft White',
      description: 'Anchor PVC casing-capping for neat surface wiring installations. 1 inch width, 100 ft roll in white. Flame-retardant and UV-stabilized.',
      price: 280,
      category: byCat['tools-accessories'],
      stock: 110,
      brand: 'Anchor',
      ratings: 4.0,
      numReviews: 18,
      featured: false,
      isActive: true,
      images: [{ url: placeholder('Casing Capping'), public_id: 'seed-13' }],
      specifications: new Map([['Width', '1 inch'], ['Length', '100 ft'], ['Material', 'PVC'], ['Color', 'White']]),
    },
    {
      name: 'Polycab 2.5 sq.mm Copper Wire FR 90m — Red',
      description: 'Polycab 2.5 sq.mm single-core copper conductor FR-PVC wire in Red. Ideal for power circuits, sub-main wiring and appliance connections.',
      price: 1260,
      category: byCat['wires-cables'],
      stock: 50,
      brand: 'Polycab',
      ratings: 4.6,
      numReviews: 41,
      featured: false,
      isActive: true,
      images: [{ url: placeholder('Polycab 2.5mm'), public_id: 'seed-14' }],
      specifications: new Map([['Cross Section', '2.5 sq.mm'], ['Length', '90 metres'], ['Color', 'Red'], ['Insulation', 'FR PVC']]),
    },
    {
      name: 'Orient Electric Apex-FX 1200mm BLDC Ceiling Fan',
      description: 'Orient Electric Apex-FX 1200mm BLDC ceiling fan with IoT-ready remote. Saves up to 65% energy vs conventional fans with whisper-quiet motor.',
      price: 4999,
      category: byCat['fans'],
      stock: 20,
      brand: 'Orient Electric',
      ratings: 4.7,
      numReviews: 52,
      featured: true,
      isActive: true,
      images: [{ url: placeholder('Orient Fan'), public_id: 'seed-15' }],
      specifications: new Map([['Sweep', '1200mm'], ['Power', '25W (BLDC)'], ['Speed', '360 RPM'], ['Remote', 'Included']]),
    },
  ];
};

const seed = async () => {
  try {
    await connectDB();
    console.log('\n🌱 Starting seed...');

    // Clear existing seed data (keep user-created data)
    await Category.deleteMany({});
    console.log('✔ Cleared categories');

    const createdCats = await Category.insertMany(categories);
    console.log(`✔ Created ${createdCats.length} categories`);

    // Remove products with seed public_ids to avoid duplicates
    await Product.deleteMany({ 'images.public_id': { $regex: /^seed-/ } });

    const products = buildProducts(createdCats);
    await Product.insertMany(products);
    console.log(`✔ Inserted ${products.length} products`);

    console.log('\n✅ Seed complete!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

seed();
