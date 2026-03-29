const jwt = require('jsonwebtoken');
const asyncHandler = require('./asyncHandler');
const User = require('../models/userModel');

const protect = asyncHandler(async (req, res, next) => {
    console.log("==== PROTECT MIDDLEWARE RUNNING ====");

    console.log("Headers:", req.headers);

    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    console.log("Extracted token:", token);

    if (!token) {
        console.log("NO TOKEN FOUND");
        res.status(401);
        throw new Error('Not authorized, no token');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded:", decoded);

    const user = await User.findById(decoded.id);

    console.log("User from DB:", user);

    if (!user) {
        res.status(401);
        throw new Error('User not found');
    }

    req.user = user;
    next();
});

module.exports = { protect };
// const jwt = require('jsonwebtoken');
// const asyncHandler = require('../controllers/asyncHandler');
// const User = require('../models/userModel');

// const protect = asyncHandler(async (req, res, next) => {
//     let token;

//      if (
//         req.headers.authorization &&
//         req.headers.authorization.startsWith('Bearer')
//     ) {
//         token = req.headers.authorization.split(' ')[1];
//     }

//     if (!token) {
//         res.status(401);
//         throw new Error('Not authorized, no token');
//     }

//     try {
//         console.log('Verifying token...');
//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         console.log('Decoded token:', decoded);
//         req.user = await User.findById(decoded.id).select('-password');
//         console.log('req.user set:', req.user);
//         next();
//     } catch (error) {
//         res.status(401);
//         throw new Error('Not authorized, token failed');
//     }
// });

// module.exports = { protect };