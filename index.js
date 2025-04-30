const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = 1848;

// CORS setup
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(bodyParser.json());

// PostgreSQL DB connection
const pool = new Pool({
  user: 'default',
  host: 'ep-odd-water-a4hfiyxz-pooler.us-east-1.aws.neon.tech',
  database: 'verceldb',
  password: 'jle3AwCJPF2a',
  port: 5432,
  ssl: {
    rejectUnauthorized: false, // Allow insecure SSL (self-signed certificates)
  },
});

pool.connect((err) => {
  if (err) {
    console.error('Failed to connect to PostgreSQL database:', err.message);
  } else {
    console.log('Connected to PostgreSQL database.');
  }
});

// Create table if not exists
// const createTableQuery = `
//   CREATE TABLE IF NOT EXISTS scanned_data (
//     id SERIAL PRIMARY KEY,
//     product TEXT,
//     weight REAL,
//     batch_id TEXT,
//     result TEXT,
//     product_id TEXT,
//     time_scanned TEXT
//   )
// `;

// pool.query(createTableQuery)
//   .then(() => console.log('Table is ready.'))
//   .catch(err => console.error('Error creating table:', err));

let latestWeight = null;

// Receive QR Data
app.post('/receive-qr', async (req, res) => {
  const rawData = req.body.qr_data;

  const validWeights = [50, 100, 200, 250, 500]; // Example valid weights

  try {
    const parsed = JSON.parse(rawData);
    const weightValue = parsed?.weight?.value || null;
    const productName = parsed?.product || null;
    const productId = parsed?.product_id || null;
    const batchId = parsed?.batch_id || null;
    const timeScanned = new Date().toISOString();

    latestWeight = weightValue;

    const result = validWeights.includes(weightValue) ? 'pass' : 'fail';

    const insertQuery = `
      INSERT INTO scanned_data (product, weight, batch_id, result, product_id, time_scanned)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(insertQuery, [productName, weightValue, batchId, result, productId, timeScanned]);

    res.json({
      status: 'success',
      product_id: productId,
      weight: weightValue,
      batch_id: batchId,
      time_scanned: timeScanned,
      result: result,
    });
  } catch (err) {
    console.error('Failed to process QR data:', err.message);
    res.status(400).json({
      status: 'error',
      message: 'Invalid JSON format in QR data',
    });
  }
});

// Latest weight endpoint
app.get('/latest-weight', (req, res) => {
  res.json({ weight: latestWeight });
});

// Get all scanned data
app.get('/scanned-data', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM scanned_data ORDER BY id DESC');
    res.json({ status: 'success', data: result.rows });
  } catch (err) {
    console.error('Failed to fetch data:', err.message);
    res.status(500).json({ status: 'error', message: 'Database fetch failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
