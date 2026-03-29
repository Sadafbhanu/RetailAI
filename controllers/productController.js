const asyncHandler = require('../middleware/asyncHandler');
const Product = require('../models/productModel');
const Transaction = require('../models/transactionModel');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

/* ==========================================
   1️⃣ Add Product (Ledger Entry)
========================================== */
const addProduct = asyncHandler(async (req, res) => {
    const product = new Product({
        ...req.body,
        ownerID: req.user._id,
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
});

/* ==========================================
   2️⃣ Get All Products (User Scoped)
========================================== */
const { getExpiryStatus } = require('../utils/expiry');
const getAllProducts = asyncHandler(async (req, res) => {
    const products = await Product.find({
        ownerID: req.user._id,
    });

    const productsWithStatus = products.map(product => {
        const productObj = product.toObject();
        return {
            ...productObj,
            expiryStatus: getExpiryStatus(product.expiryDate),
        };
    });

    res.json(productsWithStatus);
});

/* ==========================================
   3️⃣ Sentinel Alerts (Expiry + Low Stock)
========================================== */

const getAlerts = asyncHandler(async (req, res) => {
    const products = await Product.find({
        ownerID: req.user._id,
    });

    const alerts = products
        .map(product => {
            const expiryStatus = getExpiryStatus(product.expiryDate);

            const lowStock = product.quantity < product.minThreshold;
            const expiryProblem =
                expiryStatus === 'Expired' ||
                expiryStatus === 'Warning';

            if (!lowStock && !expiryProblem) return null;

            return {
                _id: product._id,
                name: product.name,
                quantity: product.quantity,
                expiryStatus,
                reason: lowStock
                    ? `Low stock (${product.quantity} left)`
                    : `Product is ${expiryStatus}`,
            };
        })
        .filter(Boolean);

    res.json(alerts);
});
/* ==========================================
   4️⃣ Quick Sell Product (Flow + Transaction)
========================================== */
const quickSellProduct = asyncHandler(async (req, res) => {
    const { quantity } = req.body;

    const product = await Product.findOne({
        _id: req.params.id,
        ownerID: req.user._id,
    });

    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    if (product.quantity < quantity) {
        res.status(400);
        throw new Error('Not enough stock');
    }

    product.quantity -= quantity;
    await product.save();

    await Transaction.create({
        product: product._id,
        ownerID: req.user._id,
        type: 'Sale',
        quantity: Number(quantity),
    });

    res.json({
        message: 'Product sold successfully',
        remainingStock: product.quantity,
        product,
    });
});

/* ==========================================
   5️⃣ Quick Restock Product
========================================== */
const quickRestockProduct = asyncHandler(async (req, res) => {
    const { quantity } = req.body;

    const product = await Product.findOne({
        _id: req.params.id,
        ownerID: req.user._id,
    });

    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    product.quantity += Number(quantity);
    await product.save();

    await Transaction.create({
        product: product._id,
        ownerID: req.user._id,
        type: 'Restock',
        quantity: Number(quantity),
    });

    res.json({
        message: 'Product restocked successfully',
        updatedStock: product.quantity,
        product,
    });
});

/* ==========================================
   6️⃣ Bulk Upload Products (CSV)
========================================== */
const uploadProducts = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('No file uploaded');
    }

    const results = [];
    const filePath = path.resolve(req.file.path);

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            fs.unlinkSync(filePath);

            if (!results.length) {
                return res.status(400).json({
                    message: 'CSV is empty or invalid',
                });
            }

            const productsToInsert = results.map((product) => ({
                ...product,
                quantity: Number(product.quantity),
                price: Number(product.price),
                minThreshold: Number(product.minThreshold),
                ownerID: req.user._id,
            }));

            await Product.insertMany(productsToInsert);

            res.status(201).json({
                message: 'Products uploaded successfully',
                count: productsToInsert.length,
            });
        });
});

module.exports = {
    addProduct,
    getAllProducts,
    getAlerts,
    quickSellProduct,
    quickRestockProduct,
    uploadProducts,
};