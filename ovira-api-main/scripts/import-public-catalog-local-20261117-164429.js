'use strict';

const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Review = require('../models/Review');

const inputFile = process.argv[2];
const LOCAL_URI = 'mongodb://127.0.0.1:27018/ovira_play_dev?directConnection=true';

function chunks(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  if (!inputFile || !fs.existsSync(inputFile)) {
    throw new Error('Local import JSON file was not found.');
  }

  const payload = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  if (!Array.isArray(payload.products) || payload.products.length === 0) {
    throw new Error('The public catalog is empty; refusing to import.');
  }
  if (!Array.isArray(payload.reviews)) {
    throw new Error('The reviews collection is missing from the import file.');
  }

  const productOps = payload.products.map((p) => {
    const plans = (Array.isArray(p.pl) ? p.pl : []).map((x) => ({
      months: Number(x[0]),
      price: Number(x[1]),
      best: x[2] === 1 || x[2] === true,
      label: String(x[3] || '')
    }));

    if (!p.id || !p.n || !p.t || !p.cat || plans.length === 0) {
      throw new Error(`Invalid public product record: ${p.id || '(missing ID)'}`);
    }
    if (plans.some((x) => !Number.isInteger(x.months) || x.months < 1 || !Number.isFinite(x.price) || x.price < 0)) {
      throw new Error(`Invalid plan data in product: ${p.id}`);
    }

    const doc = {
      productId: String(p.id).toLowerCase(),
      brandName: String(p.n),
      title: String(p.t),
      subtitle: String(p.sub || ''),
      category: String(p.cat),
      primaryColor: String(p.c || '#2447C9'),
      secondaryColor: String(p.c2 || '#12286E'),
      iconText: String(p.l || ''),
      imageUrl: String(p.img || ''),
      badgeText: String(p.badge || ''),
      features: Array.isArray(p.f) ? p.f.map(String) : [],
      steps: Array.isArray(p.steps) ? p.steps.map((x) => ({ title: String(x.title || ''), desc: String(x.desc || '') })) : [],
      plans,
      audience: Array.isArray(p.aud) ? p.aud.map(String) : undefined,
      limits: Array.isArray(p.lim) ? p.lim.map(String) : undefined,
      faqs: Array.isArray(p.faq) ? p.faq.map((x) => ({ q: String(x.q || ''), a: String(x.a || '') })) : undefined,
      guaranteeText: String(p.guar || ''),
      deliveryText: String(p.dlv || ''),
      seoTitle: String(p.seoT || ''),
      seoDescription: String(p.seoD || ''),
      active: p.active !== false,
      sortOrder: Number.isFinite(Number(p.sortOrder)) ? Number(p.sortOrder) : 10
    };

    return {
      updateOne: {
        filter: { productId: doc.productId },
        update: { $set: doc },
        upsert: true
      }
    };
  });

  const reviewOps = [];
  const occurrences = new Map();

  for (const r of payload.reviews) {
    const productId = String(r.productId || '').toLowerCase();
    const displayName = String(r.displayName || '').trim().slice(0, 50);
    const comment = String(r.comment || '').trim().slice(0, 800);
    const stars = Number(r.stars);
    const createdAt = new Date(r.createdAt);

    if (!productId || !displayName || !comment || !Number.isInteger(stars) || stars < 1 || stars > 5 || Number.isNaN(createdAt.getTime())) {
      throw new Error(`Invalid public review record for product ${productId || '(unknown)'}`);
    }

    const signature = [productId, createdAt.toISOString(), displayName, stars, comment].join('|');
    const occurrence = occurrences.get(signature) || 0;
    occurrences.set(signature, occurrence + 1);

    // Synthetic customerId exists only to satisfy the local Review schema.
    // No customer account, phone, email, or order data is copied.
    const syntheticId = crypto
      .createHash('sha256')
      .update(`${signature}|${occurrence}`)
      .digest('hex')
      .slice(0, 24);
    const customerId = new mongoose.Types.ObjectId(syntheticId);

    reviewOps.push({
      updateOne: {
        filter: { productId, customerId },
        update: {
          $set: {
            displayName,
            stars,
            comment,
            approved: true,
            createdAt
          }
        },
        upsert: true
      }
    });
  }

  await mongoose.connect(LOCAL_URI, { serverSelectionTimeoutMS: 7000 });
  await Product.init();
  await Review.init();

  const beforeProducts = await Product.countDocuments();
  const beforeReviews = await Review.countDocuments();

  for (const batch of chunks(productOps, 300)) {
    await Product.bulkWrite(batch, { ordered: true });
  }
  for (const batch of chunks(reviewOps, 300)) {
    await Review.bulkWrite(batch, { ordered: false });
  }

  const afterProducts = await Product.countDocuments();
  const afterReviews = await Review.countDocuments();

  console.log('LOCAL IMPORT SUCCESS');
  console.log(`Products in local DB before: ${beforeProducts}`);
  console.log(`Products in local DB after:  ${afterProducts}`);
  console.log(`Public products imported:    ${productOps.length}`);
  console.log(`Reviews in local DB before:  ${beforeReviews}`);
  console.log(`Reviews in local DB after:   ${afterReviews}`);
  console.log(`Public approved reviews:     ${reviewOps.length}`);
  console.log('Only Product and Review collections were written locally.');
}

main()
  .catch((err) => {
    console.error('LOCAL IMPORT FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
  });