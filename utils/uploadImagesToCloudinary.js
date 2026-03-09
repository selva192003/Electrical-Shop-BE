/**
 * Upload all local product images to Cloudinary and update MongoDB URLs.
 * Run: node utils/uploadImagesToCloudinary.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const connectDB = require('../config/db');
const Product = require('../models/Product');

// Path to the local images folder (frontend/public/shop-images)
const IMAGES_DIR = path.join(__dirname, '../../frontend/public/shop-images');

const uploadAll = async () => {
  await connectDB();

  const files = fs.readdirSync(IMAGES_DIR).filter((f) =>
    /\.(jpg|jpeg|png|webp)$/i.test(f)
  );

  console.log(`\n🖼  Found ${files.length} images in shop-images folder.\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const filename of files) {
    // Product name = filename without extension
    const productName = path.parse(filename).name;
    const filePath = path.join(IMAGES_DIR, filename);

    // Find matching product in DB (case-insensitive)
    const product = await Product.findOne({
      name: { $regex: new RegExp(`^${productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });

    if (!product) {
      console.log(`  ⚠  No DB match for: "${productName}"`);
      notFound++;
      continue;
    }

    // Skip if already uploaded to Cloudinary (URL contains res.cloudinary.com)
    const currentUrl = product.images?.[0]?.url || '';
    if (currentUrl.includes('res.cloudinary.com')) {
      console.log(`  ✓  Already on Cloudinary: ${productName}`);
      skipped++;
      continue;
    }

    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'electrical-shop/products',
        public_id: `seed-${product._id}`,
        overwrite: true,
        resource_type: 'image',
        transformation: [{ width: 800, height: 600, crop: 'limit', quality: 'auto' }],
      });

      product.images = [{ url: result.secure_url, public_id: result.public_id }];
      await product.save();

      console.log(`  ✅  Uploaded & updated: ${productName}`);
      updated++;
    } catch (err) {
      console.error(`  ❌  Failed: ${productName} — ${err.message}`);
    }
  }

  console.log(`\n────────────────────────────────`);
  console.log(`  Uploaded & updated : ${updated}`);
  console.log(`  Already on Cloudinary: ${skipped}`);
  console.log(`  No DB match found  : ${notFound}`);
  console.log(`────────────────────────────────`);
  console.log(`\n✅ Done!\n`);
  process.exit(0);
};

uploadAll().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
