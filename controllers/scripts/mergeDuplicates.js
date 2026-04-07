const mongoose = require('mongoose');
const Product = require('../../models/productModel');

// ✅ CONNECT FIRST, THEN RUN
async function run() {
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/retailai");
        console.log("✅ MongoDB connected");

        await mergeDuplicates();

        console.log("✅ Done");
        process.exit();

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

async function mergeDuplicates() {
    const products = await Product.find();

    let map = {};

    for (let p of products) {
        let key = p.name.trim().toLowerCase() + "_" + p.ownerID;

        if (!map[key]) {
            map[key] = p;
        } else {
            map[key].quantity += p.quantity;

            // ✅ optional: keep latest price
            map[key].price = p.price || map[key].price;
            map[key].costPrice = p.costPrice || map[key].costPrice;

            await map[key].save();
            await p.deleteOne();
        }
    }

    console.log("✅ Duplicates merged successfully");
}

run();