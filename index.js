const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 1848;


app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(bodyParser.json());


const dbPath = path.join(__dirname, 'barcode_data.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});


db.run(`
  CREATE TABLE IF NOT EXISTS scanned_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product TEXT,
    weight REAL,
    batch_id TEXT,
    result TEXT,
    product_id TEXT,
    time_scanned TEXT
  )
`);

let latestWeight = null;


app.post('/receive-qr', (req, res) => {
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
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.run(insertQuery, [productName, weightValue, batchId, result, productId, timeScanned], (err) => {
      if (err) {
        console.error('Failed to insert into DB:', err.message);
        return res.status(500).json({ status: 'error', message: 'Database insert failed' });
      }

      res.json({
        status: 'success',
        product_id: productId,
        weight: weightValue,
        batch_id: batchId,
        time_scanned: timeScanned,
        result: result,
      });
    });
  } catch (err) {
    console.error('Failed to parse QR:', err.message);
    res.status(400).json({
      status: 'error',
      message: 'Invalid JSON format in QR data',
    });
  }
});


app.get('/latest-weight', (req, res) => {
  res.json({ weight: latestWeight });
});


app.get('/scanned-data', (req, res) => {
  const query = 'SELECT * FROM scanned_data ORDER BY id DESC';
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Failed to fetch data:', err.message);
      return res.status(500).json({ status: 'error', message: 'Database fetch failed' });
    }
    res.json({ status: 'success', data: rows });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
