const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// AUTO-DETECT DATABASE: Use Production if NODE_ENV is production OR if running on cPanel (LS_NODE_SERVER_PORT exists)
const useProd = (process.env.NODE_ENV === 'production' || !!process.env.LS_NODE_SERVER_PORT) && !!process.env.PROD_DB_USER;

const dbConfig = useProd ? {
  host: process.env.PROD_DB_HOST || 'localhost',
  user: process.env.PROD_DB_USER,
  password: process.env.PROD_DB_PASS,
  database: process.env.PROD_DB_NAME,
  waitForConnections: true,
  connectionLimit: 5, // Reduced for shared hosting stability
  queueLimit: 0,
  connectTimeout: 10000 // 10 second timeout
} : {
  host: process.env.VITE_DB_HOST || 'localhost',
  user: process.env.VITE_DB_USER || 'root',
  password: process.env.VITE_DB_PASSWORD || '',
  database: process.env.VITE_DB_NAME || 'lens_workshop',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Test Database Connection on Startup
pool.getConnection()
  .then(conn => {
    console.log("Successfully connected to Database!");
    conn.release();
  })
  .catch(err => {
    console.error("DATABASE CONNECTION ERROR:", err.message);
  });

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
  }
});

const upload = multer({ storage: storage });

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// FIXED: File deletion endpoint with logging
app.post('/api/delete-file', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No url provided' });

  // Ensure url is within uploads folder to prevent path traversal
  if (!url.includes('/uploads/')) {
    console.log(`Delete blocked: ${url} is not in uploads folder`);
    return res.status(403).json({ error: 'Invalid file path' });
  }

  const filename = path.basename(url);
  const filePath = path.join(uploadDir, filename);

  console.log(`Attempting to delete file: ${filePath}`);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Successfully deleted: ${filePath}`);
      res.json({ success: true });
    } else {
      console.warn(`File not found for deletion: ${filePath}`);
      res.status(404).json({ error: 'File not found on server' });
    }
  } catch (err) {
    console.error('Error during fs.unlink:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

app.post('/api/query', async (req, res) => {
  const { sql, params } = req.body;
  try {
    const [rows] = await pool.execute(sql, params || []);
    res.json(rows);
  } catch (error) {
    console.error('Query Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete account endpoint - manual wipe of files + all related data
app.post('/api/delete-account', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get all file URLs before deleting records
    const [files] = await connection.execute(`
      SELECT DISTINCT file_url FROM (
        SELECT image_url as file_url FROM events WHERE user_id = ? AND image_url IS NOT NULL AND image_url != ''
        UNION ALL
        SELECT jr.payment_slip_url as file_url FROM join_requests jr
        JOIN events e ON jr.event_id = e.id
        WHERE e.user_id = ? AND jr.payment_slip_url IS NOT NULL AND jr.payment_slip_url != ''
        UNION ALL
        SELECT avatar_url as file_url FROM profiles WHERE user_id = ? AND avatar_url IS NOT NULL AND avatar_url != ''
      ) all_files
    `, [userId, userId, userId]);

    // 2. Delete Physical Files
    if (Array.isArray(files)) {
      for (const row of files) {
        const fileUrl = row.file_url;
        if (fileUrl && fileUrl.includes('/uploads/')) {
          const fname = path.basename(fileUrl);
          const fpath = path.join(uploadDir, fname);
          try {
            if (fs.existsSync(fpath)) {
              fs.unlinkSync(fpath);
              console.log(`Force Wipe: Deleted file ${fpath}`);
            }
          } catch (e) { console.error(`Force Wipe: File fail ${fpath}`, e.message); }
        }
      }
    }

    // 3. Manual Data Purge (In order to satisfy foreign keys)
    console.log(`Force Wipe: Deleting DB data for user ${userId}`);
    
    // Delete Join Requests first (child of events)
    await connection.execute(`
      DELETE jr FROM join_requests jr 
      INNER JOIN events e ON jr.event_id = e.id 
      WHERE e.user_id = ?
    `, [userId]);

    // Delete Events
    await connection.execute('DELETE FROM events WHERE user_id = ?', [userId]);

    // Delete Profile
    await connection.execute('DELETE FROM profiles WHERE user_id = ?', [userId]);

    // Delete Sessions (if any)
    await connection.execute('DELETE FROM sessions WHERE user_id = ?', [userId]).catch(() => {});

    // Finally Delete User
    await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

    await connection.commit();
    console.log(`Force Wipe: Completed successfully for user ${userId}`);
    res.json({ success: true });

  } catch (err) {
    await connection.rollback();
    console.error('Force Wipe Error:', err);
    res.status(500).json({ error: 'Failed to fully delete account' });
  } finally {
    connection.release();
  }
});

// Serve static files from the React app
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  
  // Use '*path' for Express 5 compatibility (named wildcard)
  app.get('*path', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
