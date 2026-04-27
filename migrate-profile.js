import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.VITE_DB_HOST || 'localhost',
    user: process.env.VITE_DB_USER || 'root',
    password: process.env.VITE_DB_PASSWORD || '',
    database: process.env.VITE_DB_NAME || 'lens_workshop',
  });

  console.log('Adding phone and address columns to profiles table...');

  try {
    await connection.execute(`
      ALTER TABLE profiles 
      ADD COLUMN phone VARCHAR(40) DEFAULT NULL AFTER display_name,
      ADD COLUMN address TEXT DEFAULT NULL AFTER phone
    `);
    console.log('✅ Columns added successfully!');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  Columns already exist, skipping.');
    } else {
      throw err;
    }
  }

  await connection.end();
  console.log('Done.');
}

migrate().catch(console.error);
