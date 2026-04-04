require('dotenv').config();
const path = require('path');
const express = require('express');
const connectDB = require('./db.js');
const multer = require('multer');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const insightsRoutes = require('./routes/insightsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes.js');



const app = express();
const PORT = process.env.PORT || 5000;
// Middleware to parse JSON bodies
app.use(express.json());
const cookieParser = require('cookie-parser');
app.use(cookieParser());
// Serve static files from the 'public' directory
app.use(express.static('public'));


// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });


const cors = require('cors');
app.use(cors());

// --- API Routes ---
app.use('/api/products', productRoutes);
app.use('/api/users', authRoutes);
app.use('/api/insights', insightsRoutes);

app.use('/api/dashboard', dashboardRoutes);

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server is listening on port ${PORT}`);
        });
    } catch (err) {
        console.error('Connection error', err);
    }
};

app.use((err, req, res, next) => {
    if (req.originalUrl.startsWith('/api')) { // Check if it's an API request
        console.error(err.stack);
        res.status(err.statusCode || 500).json({
            message: err.message || 'An unexpected API error occurred.'
        });
    } else {
        // For non-API requests, render an HTML error page
        res.status(err.statusCode || 500).send('<h1>Error</h1><p>Something went wrong!</p>');
    }
});


startServer();