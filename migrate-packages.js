import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function migratePackages() {
  const pool = mysql.createPool({
    host: process.env.VITE_DB_HOST || 'localhost',
    user: process.env.VITE_DB_USER || 'root',
    password: process.env.VITE_DB_PASSWORD || '',
    database: process.env.VITE_DB_NAME || 'lens_workshop'
  });

  try {
    console.log("Creating packages table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS packages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL UNIQUE,
        max_workshops INT NOT NULL DEFAULT 10,
        max_students_per_workshop INT NOT NULL DEFAULT 50,
        max_slip_size_mb INT NOT NULL DEFAULT 1,
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Inserting default 'Free' package...");
    await pool.query(`
      INSERT IGNORE INTO packages (name, max_workshops, max_students_per_workshop, max_slip_size_mb, price)
      VALUES ('Free', 10, 50, 1, 0.00)
    `);

    console.log("Adding package_id to users table...");
    try {
      await pool.query('ALTER TABLE users ADD COLUMN package_id INT NOT NULL DEFAULT 1');
      await pool.query('ALTER TABLE users ADD FOREIGN KEY (package_id) REFERENCES packages(id)');
      console.log("package_id added and linked successfully.");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log("package_id column already exists.");
      } else {
        throw e;
      }
    }

    console.log("Database migration completed successfully.");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

migratePackages();
