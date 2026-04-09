require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');
const User = require('../models/userModel');
const Product = require('../models/productModel');
const Transaction = require('../models/transactionModel');

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function daysAgo(days) {
  return daysFromNow(-days);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function monthStart(offsetFromCurrentMonth) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offsetFromCurrentMonth, 1, 10, 30, 0, 0);
}

const CATALOG = [
  // Fresh / daily essentials
  { name: 'Milk 1L', category: 'Dairy', price: 64, costPrice: 44, minThreshold: 20, quantity: 75, purchaseAgo: 5, expiryIn: 4 },
  { name: 'Bread Whole Wheat', category: 'Bakery', price: 42, costPrice: 28, minThreshold: 18, quantity: 55, purchaseAgo: 4, expiryIn: 3 },
  { name: 'Curd 500g', category: 'Dairy', price: 38, costPrice: 24, minThreshold: 14, quantity: 40, purchaseAgo: 6, expiryIn: 5 },
  { name: 'Eggs 12 Pack', category: 'Poultry', price: 88, costPrice: 66, minThreshold: 15, quantity: 62, purchaseAgo: 8, expiryIn: 10 },

  // Packaged fast movers
  { name: 'Rice 5kg', category: 'Staples', price: 340, costPrice: 255, minThreshold: 8, quantity: 30, purchaseAgo: 35, expiryIn: 170 },
  { name: 'Sunflower Oil 1L', category: 'Staples', price: 170, costPrice: 132, minThreshold: 10, quantity: 34, purchaseAgo: 28, expiryIn: 150 },
  { name: 'Tea 500g', category: 'Beverages', price: 220, costPrice: 168, minThreshold: 8, quantity: 27, purchaseAgo: 55, expiryIn: 220 },
  { name: 'Sugar 1kg', category: 'Staples', price: 52, costPrice: 37, minThreshold: 14, quantity: 12, purchaseAgo: 42, expiryIn: 240 }, // low stock

  // Slow / dead stock candidates
  { name: 'Organic Quinoa 1kg', category: 'Premium', price: 460, costPrice: 340, minThreshold: 6, quantity: 28, purchaseAgo: 78, expiryIn: 70 }, // >75% shelf-life consumed soon
  { name: 'Gluten Free Cookies', category: 'Snacks', price: 185, costPrice: 130, minThreshold: 5, quantity: 22, purchaseAgo: 64, expiryIn: 55 },
  { name: 'Avocado Dip Jar', category: 'Premium', price: 299, costPrice: 225, minThreshold: 4, quantity: 16, purchaseAgo: 40, expiryIn: 6 }, // near expiry
  { name: 'Imported Jam 250g', category: 'Premium', price: 275, costPrice: 205, minThreshold: 4, quantity: 11, purchaseAgo: 90, expiryIn: -7 }, // expired

  // Zero qty should be hidden in inventory list but still test logic
  { name: 'Corn Flakes 500g', category: 'Breakfast', price: 160, costPrice: 118, minThreshold: 7, quantity: 0, purchaseAgo: 30, expiryIn: 120 },
];

async function seedForUser(user, resetExisting) {
  if (resetExisting) {
    await Transaction.deleteMany({ ownerID: user._id });
    await Product.deleteMany({ ownerID: user._id });
  }

  const createdProducts = [];

  for (const item of CATALOG) {
    const product = await Product.create({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      price: item.price,
      costPrice: item.costPrice,
      minThreshold: item.minThreshold,
      purchaseDate: daysAgo(item.purchaseAgo),
      expiryDate: daysFromNow(item.expiryIn),
      ownerID: user._id,
      sales: [],
    });
    createdProducts.push(product);
  }

  // Build 6 months of transaction history to power dashboard + insights.
  // Pattern: some fast-growing, some declining, some dead stock.
  const txDocs = [];
  const productByName = new Map(createdProducts.map((p) => [p.name, p]));

  function pushSale(name, qty, when) {
    const p = productByName.get(name);
    if (!p) return;
    txDocs.push({
      product: p._id,
      ownerID: user._id,
      type: 'Sale',
      quantity: qty,
      createdAt: when,
      updatedAt: when,
    });
  }

  function pushRestock(name, qty, when) {
    const p = productByName.get(name);
    if (!p) return;
    txDocs.push({
      product: p._id,
      ownerID: user._id,
      type: 'Restock',
      quantity: qty,
      createdAt: when,
      updatedAt: when,
    });
  }

  const monthOffsets = [-5, -4, -3, -2, -1, 0];

  monthOffsets.forEach((offset) => {
    const base = monthStart(offset);

    // Fast-growing
    pushSale('Milk 1L', randomInt(22 + offset + 5, 30 + offset + 8), new Date(base.getTime() + 3 * 86400000));
    pushSale('Bread Whole Wheat', randomInt(18 + offset + 4, 26 + offset + 6), new Date(base.getTime() + 8 * 86400000));

    // Stable
    pushSale('Rice 5kg', randomInt(7, 11), new Date(base.getTime() + 11 * 86400000));
    pushSale('Sunflower Oil 1L', randomInt(8, 12), new Date(base.getTime() + 14 * 86400000));

    // Declining
    pushSale('Tea 500g', Math.max(2, 12 - (offset + 5) * 2), new Date(base.getTime() + 17 * 86400000));
    pushSale('Sugar 1kg', Math.max(1, 10 - (offset + 5) * 2), new Date(base.getTime() + 20 * 86400000));

    // Slow / near-dead stock (small or no sales)
    if (offset <= -2) {
      pushSale('Organic Quinoa 1kg', randomInt(1, 2), new Date(base.getTime() + 9 * 86400000));
      pushSale('Gluten Free Cookies', 1, new Date(base.getTime() + 22 * 86400000));
    }
    if (offset === -1) {
      pushSale('Avocado Dip Jar', 1, new Date(base.getTime() + 10 * 86400000));
    }

    // Monthly restocks
    pushRestock('Milk 1L', randomInt(35, 52), new Date(base.getTime() + 2 * 86400000));
    pushRestock('Bread Whole Wheat', randomInt(28, 42), new Date(base.getTime() + 4 * 86400000));
    pushRestock('Rice 5kg', randomInt(9, 16), new Date(base.getTime() + 6 * 86400000));
    pushRestock('Tea 500g', randomInt(5, 10), new Date(base.getTime() + 13 * 86400000));
  });

  // Unusual spike / drop days for trend anomaly checks.
  pushSale('Milk 1L', 85, daysAgo(11)); // spike
  pushSale('Bread Whole Wheat', 62, daysAgo(11));
  pushSale('Rice 5kg', 1, daysAgo(3));

  // Dead stock with zero sale history: Imported Jam + Corn Flakes.
  // Keep only a restock for Corn Flakes to indicate shelf presence.
  pushRestock('Corn Flakes 500g', 14, daysAgo(45));

  if (txDocs.length) {
    await Transaction.insertMany(txDocs);
  }

  return {
    products: createdProducts.length,
    transactions: txDocs.length,
  };
}

async function run() {
  const email = process.argv[2];
  const reset = process.argv.includes('--reset');

  if (!email) {
    console.error('Usage: node scripts/seedTestDataset.js <user-email> [--reset]');
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.error(`User not found for email: ${email}`);
    process.exit(1);
  }

  const result = await seedForUser(user, reset);

  console.log('Seed complete');
  console.log(`User: ${user.email}`);
  console.log(`Products inserted: ${result.products}`);
  console.log(`Transactions inserted: ${result.transactions}`);
  console.log(`Mode: ${reset ? 'reset existing user data first' : 'append mode'}`);

  await mongoose.connection.close();
}

run().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await mongoose.connection.close();
  process.exit(1);
});
