import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function updateDb() {
  const pool = mysql.createPool({
    host: process.env.VITE_DB_HOST || 'localhost',
    user: process.env.VITE_DB_USER || 'root',
    password: process.env.VITE_DB_PASSWORD || '',
    database: process.env.VITE_DB_NAME || 'lens_workshop'
  });

  try {
    await pool.query('ALTER TABLE attendees ADD COLUMN payment_slip_url VARCHAR(500) NULL DEFAULT NULL;');
    console.log("Column added successfully.");
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log("Column already exists.");
    } else {
      console.error(e);
    }
  }
  process.exit(0);
}
updateDb();
