import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.VITE_DB_HOST || 'localhost',
    user: process.env.VITE_DB_USER || 'root',
    password: process.env.VITE_DB_PASSWORD || '',
    database: process.env.VITE_DB_NAME || 'lens_workshop'
  });

  try {
    console.log("Altering join_requests table...");
    await pool.query('ALTER TABLE join_requests ADD COLUMN payment_status_id INT DEFAULT 1;');
    await pool.query('ALTER TABLE join_requests ADD COLUMN amount_paid DECIMAL(10,2) DEFAULT 0;');
    await pool.query('ALTER TABLE join_requests MODIFY COLUMN email VARCHAR(255) NULL;');
    await pool.query('ALTER TABLE join_requests MODIFY COLUMN payment_slip_url VARCHAR(500) NULL;');
    await pool.query('ALTER TABLE join_requests MODIFY COLUMN phone VARCHAR(40) NULL;');
    console.log("Migration successful.");
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log("Columns already exist.");
    } else {
      console.error(e);
    }
  }

  // Optionally drop attendees table if needed, but let's keep it as backup for now or drop it.
  try {
    await pool.query('DROP TABLE IF EXISTS attendees;');
    console.log("attendees table dropped.");
  } catch (e) {
    console.error("Failed to drop attendees:", e);
  }

  process.exit(0);
}
migrate();
