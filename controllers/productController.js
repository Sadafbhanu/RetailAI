    const asyncHandler = require('../middleware/asyncHandler');
    const Product = require('../models/productModel');
    const Transaction = require('../models/transactionModel');
    const csv = require('csv-parser');
    const fs = require('fs');
    const path = require('path');
    const { getExpiryStatus } = require('../utils/expiry');
    const { estimateDiscountedPrice } = require('../utils/discountEstimator');

    /* ==========================================
    1️⃣ Add Product
    ========================================== */
const addProduct = asyncHandler(async (req, res) => {
    let { name, quantity, price, costPrice, minThreshold, expiryDate, category } = req.body;

    if (!name || !quantity || !price || !expiryDate) {
        res.status(400);
        throw new Error('name, quantity, price and expiryDate are required');
    }

    // ✅ CHECK if product already exists
    let product = await Product.findOne({
        name,
        ownerID: req.user._id,
        expiryDate: new Date(expiryDate)
    });

    if (product) {
        // ✅ UPDATE existing product
        product.quantity += Number(quantity);

        if (price) {
            product.price = price;
            product.costPrice = costPrice || price * 0.7;
        }

        if (expiryDate) product.expiryDate = expiryDate;
        if (category) product.category = category;

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
        category: category || 'General',
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
        const { quantity, price, expiryDate, resetStock } = req.body;

        const product = await Product.findOne({
            _id: req.params.id,
            ownerID: req.user._id,
        });

        if (!product) {
            res.status(404);
            throw new Error('Product not found');
        }

        const currentExpiry = product.expiryDate
            ? new Date(product.expiryDate).toISOString().split('T')[0]
            : null;
        const incomingExpiry = expiryDate
            ? new Date(expiryDate).toISOString().split('T')[0]
            : null;
        const expiryChanged = incomingExpiry && currentExpiry !== incomingExpiry;

        // Keep separate batches for different expiry dates.
        if (expiryChanged) {
            const startOfDay = new Date(expiryDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(expiryDate);
            endOfDay.setHours(23, 59, 59, 999);

            const existingBatch = await Product.findOne({
                name: product.name,
                ownerID: req.user._id,
                expiryDate: { $gte: startOfDay, $lte: endOfDay },
            });

            if (existingBatch) {
                existingBatch.quantity += Number(quantity);
                if (price) {
                    existingBatch.price = Number(price);
                    existingBatch.costPrice = Number(price) * 0.7;
                }
                await existingBatch.save();

                await Transaction.create({
                    product: existingBatch._id,
                    ownerID: req.user._id,
                    type: 'Restock',
                    quantity: Number(quantity),
                });

                return res.json({
                    message: 'Product restocked in existing expiry batch',
                    updatedStock: existingBatch.quantity,
                    product: existingBatch,
                });
            }

            const newBatch = await Product.create({
                name: product.name,
                quantity: Number(quantity),
                price: price ? Number(price) : product.price,
                costPrice: price ? Number(price) * 0.7 : (product.costPrice || product.price * 0.7),
                minThreshold: product.minThreshold,
                expiryDate: new Date(expiryDate),
                ownerID: req.user._id,
            });

            await Transaction.create({
                product: newBatch._id,
                ownerID: req.user._id,
                type: 'Restock',
                quantity: Number(quantity),
            });

            return res.json({
                message: 'Product restocked as a new expiry batch',
                updatedStock: newBatch.quantity,
                product: newBatch,
            });
        }

        if (resetStock) {
            product.quantity = Number(quantity);
        } else {
            product.quantity += Number(quantity);
        }

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
                if (!item.name || !item.quantity || !item.price || !item.expiryDate) continue;

                let existing = await Product.findOne({
                    name: item.name,
                    ownerID: req.user._id,
                    expiryDate: new Date(item.expiryDate),
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
                        category: item.category || 'General',
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
    7️⃣ Update Min Threshold
    ========================================== */
    const updateMinThreshold = asyncHandler(async (req, res) => {
        const { minThreshold } = req.body;

        if (minThreshold === undefined || Number(minThreshold) < 0) {
            res.status(400);
            throw new Error('Invalid minThreshold');
        }

        const product = await Product.findOne({
            _id: req.params.id,
            ownerID: req.user._id
        });

        if (!product) {
            res.status(404);
            throw new Error('Product not found');
        }

        product.minThreshold = Number(minThreshold);
        await product.save();

        res.json({
            message: 'Min threshold updated successfully',
            product
        });
    });
    /* ==========================================
    8️⃣ Delete Product
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
    9️⃣ Get Transactions
    ========================================== */
    const getTransactions = asyncHandler(async (req, res) => {
        const transactions = await Transaction.find({
            ownerID: req.user._id
        })
        .populate('product', 'name price costPrice') 
        .sort({ createdAt: -1 });

        res.json(transactions);
    });

    const LEAST_SOLD_WINDOW_DAYS = 30;
    /** Days to wait after a price change before the product can appear in least-sold again */
    const LEAST_SOLD_PRICE_OBSERVATION_DAYS = 7;

    const getLeastSoldProducts = asyncHandler(async (req, res) => {
        const from = new Date();
        from.setDate(from.getDate() - LEAST_SOLD_WINDOW_DAYS);

        const salesAgg = await Transaction.aggregate([
            {
                $match: {
                    ownerID: req.user._id,
                    type: 'Sale',
                    createdAt: { $gte: from },
                },
            },
            {
                $group: {
                    _id: '$product',
                    soldQty: { $sum: '$quantity' },
                },
            },
        ]);

        const soldByProduct = new Map(
            salesAgg.map((row) => [row._id.toString(), row.soldQty])
        );

        const products = await Product.find({ ownerID: req.user._id });
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const eligible = products.filter((p) => {
            if (!p.quantity || p.quantity <= 0) return false;
            if (p.lastPriceChangeAt) {
                const obsEnd = new Date(p.lastPriceChangeAt);
                obsEnd.setDate(obsEnd.getDate() + LEAST_SOLD_PRICE_OBSERVATION_DAYS);
                if (new Date() < obsEnd) return false;
            }
            if (!p.expiryDate) return true;
            const exp = new Date(p.expiryDate);
            exp.setHours(0, 0, 0, 0);
            return exp >= today;
        });

        const scored = eligible.map((p) => {
            const idStr = p._id.toString();
            const soldQtyInWindow = soldByProduct.get(idStr) || 0;
            const cost =
                typeof p.costPrice === 'number' && p.costPrice > 0
                    ? p.costPrice
                    : (Number(p.price) || 0) * 0.7;

            const estimatedDiscountPrice = estimateDiscountedPrice({
                price: p.price,
                costPrice: cost,
                quantity: p.quantity,
                minThreshold: p.minThreshold,
                expiryDate: p.expiryDate,
                soldQtyInWindow,
                windowDays: LEAST_SOLD_WINDOW_DAYS,
            });

            return {
                _id: p._id,
                name: p.name,
                quantity: p.quantity,
                price: p.price,
                estimatedDiscountPrice,
                soldQtyInWindow,
            };
        });

        scored.sort((a, b) => {
            if (a.soldQtyInWindow !== b.soldQtyInWindow) {
                return a.soldQtyInWindow - b.soldQtyInWindow;
            }
            return (b.quantity || 0) - (a.quantity || 0);
        });

        const top = scored.slice(0, 10);
        res.json(top);
    });

    const updateProductPrice = asyncHandler(async (req, res) => {
        const { price } = req.body;
        const n = Number(price);
        if (!n || n <= 0) {
            res.status(400);
            throw new Error('Invalid price');
        }

        const product = await Product.findOne({
            _id: req.params.id,
            ownerID: req.user._id,
        });

        if (!product) {
            res.status(404);
            throw new Error('Product not found');
        }

        product.price = n;
        product.costPrice = n * 0.7;
        product.lastPriceChangeAt = new Date();
        await product.save();

        res.json({
            message: 'Price updated successfully',
            product,
        });
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
        updateMinThreshold,
        deleteProduct,
        getTransactions,
        getLeastSoldProducts,
        updateProductPrice,
    };