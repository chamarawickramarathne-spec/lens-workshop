import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const pool = mysql.createPool({
    host: process.env.VITE_DB_HOST || 'localhost',
    user: process.env.VITE_DB_USER || 'root',
    password: process.env.VITE_DB_PASSWORD || '',
    database: process.env.VITE_DB_NAME || 'lens_workshop'
  });

  const [rows] = await pool.query('SELECT id, student_name, payment_slip_url, created_at FROM join_requests ORDER BY created_at DESC LIMIT 5');
  console.log(rows);
  process.exit(0);
}
check();
