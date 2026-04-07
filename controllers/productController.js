    const asyncHandler = require('../middleware/asyncHandler');
    const Product = require('../models/productModel');
    const Transaction = require('../models/transactionModel');
    const csv = require('csv-parser');
    const fs = require('fs');
    const path = require('path');
    const { getExpiryStatus } = require('../utils/expiry');

    /* ==========================================
    1️⃣ Add Product
    ========================================== */
const addProduct = asyncHandler(async (req, res) => {
    let { name, quantity, price, costPrice, minThreshold, expiryDate } = req.body;

    // ✅ CHECK if product already exists
    let product = await Product.findOne({
        name,
        ownerID: req.user._id
    });

    if (product) {
        // ✅ UPDATE existing product
        product.quantity += Number(quantity);

        if (price) {
            product.price = price;
            product.costPrice = costPrice || price * 0.7;
        }

        if (expiryDate) product.expiryDate = expiryDate;

        await product.save();

        return res.json({
            message: "Product updated",
            product
        });
    }

    // ✅ CREATE new product
    product = new Product({
        name,
        quantity,
        price,
        costPrice: costPrice || price * 0.7,
        minThreshold,
        expiryDate,
        sales: [],
        ownerID: req.user._id,
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
});

    /* ==========================================
    2️⃣ Get All Products
    ========================================== */
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
    3️⃣ Alerts
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
    4️⃣ Sell Product (AI-enabled)
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

        product.quantity -= Number(quantity);

        // ✅ AI: sales history
        if (!product.sales) product.sales = [];

        product.sales.push({
            quantity: Number(quantity),
            date: new Date()
        });

        await product.save();

        // ✅ Transaction
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
    5️⃣ Restock Product (AI-ready)
    ========================================== */
    const quickRestockProduct = asyncHandler(async (req, res) => {
        const { quantity, price, expiryDate } = req.body;

        const product = await Product.findOne({
            _id: req.params.id,
            ownerID: req.user._id,
        });

        if (!product) {
            res.status(404);
            throw new Error('Product not found');
        }

        product.quantity += Number(quantity);

        if (price) {
            product.price = Number(price);
            product.costPrice = price * 0.7; // ✅ cost update
        }

        if (expiryDate) {
            product.expiryDate = expiryDate;
        }

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
    6️⃣ Upload CSV (FIXED + AI SUPPORT)
    ========================================== */
    /* ==========================================
6️⃣ Upload CSV (FIXED + AI SUPPORT)
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

            for (let item of results) {

                let existing = await Product.findOne({
                    name: item.name,
                    ownerID: req.user._id
                });

                if (existing) {
                    existing.quantity += Number(item.quantity);
                    await existing.save();
                } else {
                    await Product.create({
                        name: item.name,
                        quantity: Number(item.quantity),
                        price: Number(item.price),
                        costPrice: item.costPrice 
                            ? Number(item.costPrice)
                            : Number(item.price) * 0.7,
                        minThreshold: Number(item.minThreshold) || 5,
                        expiryDate: item.expiryDate,
                        sales: [],
                        ownerID: req.user._id
                    });
                }
            }

            res.status(201).json({
                message: 'Products uploaded successfully'
            });
        });
});
    /* ==========================================
    7️⃣ Delete Product
    ========================================== */
    const deleteProduct = asyncHandler(async (req, res) => {
        const product = await Product.findOne({
            _id: req.params.id,
            ownerID: req.user._id
        });

        if (!product) {
            res.status(404);
            throw new Error("Product not found");
        }

        await product.deleteOne();

        res.json({ message: "Product deleted successfully" });
    });


    /* ==========================================
    8️⃣ Get Transactions
    ========================================== */
    const getTransactions = asyncHandler(async (req, res) => {
        const transactions = await Transaction.find({
            ownerID: req.user._id
        })
        .populate('product', 'name price costPrice') 
        .sort({ createdAt: -1 });

        res.json(transactions);
    });


    /* ==========================================
    EXPORTS
    ========================================== */
    module.exports = {
        addProduct,
        getAllProducts,
        getAlerts,
        quickSellProduct,
        quickRestockProduct,
        uploadProducts,
        deleteProduct,
        getTransactions
    };