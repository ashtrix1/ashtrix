const express = require('express');
const Razorpay = require('razorpay');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// 1. Create Order (Generates a specific QR Code for the amount)
app.post('/create-order', async (req, res) => {
    try {
        const { amount, note } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'A valid amount is required.' });
        }

        // Create a Fixed Amount QR Code
        // Math.round is crucial to prevent floating point errors
        const qrCode = await razorpay.qrCode.create({
            type: 'upi_qr',
            name: 'Ashtrix Store',
            usage: 'single_use',
            fixed_amount: true,
            payment_amount: Math.round(amount * 100), // Amount in paise
            description: note || 'Order Payment',
            notes: {
                purpose: 'e-commerce-order'
            }
        });

        res.json({
            success: true,
            qr_id: qrCode.id,
            payload: qrCode.payload, // The UPI string to generate QR
            image_url: qrCode.image_url
        });

    } catch (error) {
        // Log the full error for detailed debugging
        console.error('Error creating Razorpay QR Code:', JSON.stringify(error, null, 2));
        // Send a more structured error to the frontend
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.error ? error.error.description : 'An internal server error occurred.'
        });
    }
});

// 2. Verify Payment (Polls Razorpay to find a 'captured' payment)
app.get('/check-status/:qrId', async (req, res) => {
    try {
        const qrId = req.params.qrId;
        
        // Fetch all payments associated with the QR code ID
        const payments = await razorpay.qrCode.allPayments(qrId);

        // Find if there is a payment with status 'captured'
        const capturedPayment = payments.items.find(p => p.status === 'captured');

        if (capturedPayment) {
            // Payment is successful
            res.json({ status: 'captured', payment_id: capturedPayment.id });
        } else {
            // Payment is still pending or failed
            res.json({ status: 'pending' });
        }

    } catch (error) {
        // Log the full error for detailed debugging on the server
        console.error('Error verifying payment:', JSON.stringify(error, null, 2));
        // Send a structured error to the frontend
        res.status(error.statusCode || 500).json({
            status: 'error',
            error: error.error ? error.error.description : 'An internal server error occurred.'
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});