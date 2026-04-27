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

// AUTO-DETECT DATABASE: Use Production if PROD_DB_USER is set, otherwise use Local
const useProd = !!process.env.PROD_DB_USER;

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

// Delete account endpoint - sends confirmation email, deletes files + data
app.post('/api/delete-account', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    // 1. Get user email
    const [users] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userEmail = users[0].email;

    // 2. Get all uploaded files for this user
    const [files] = await pool.execute(`
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

    // 3. Delete physical files
    if (Array.isArray(files)) {
      for (const row of files) {
        const fileUrl = row.file_url;
        if (fileUrl && fileUrl.includes('/uploads/')) {
          const fname = path.basename(fileUrl);
          const fpath = path.join(uploadDir, fname);
          try {
            if (fs.existsSync(fpath)) {
              fs.unlinkSync(fpath);
              console.log(`Account cleanup: Deleted ${fpath}`);
            } else {
              console.warn(`Account cleanup: File not found ${fpath}`);
            }
          } catch (e) {
            console.error(`Account cleanup: Failed to delete ${fpath}`, e.message);
          }
        }
      }
    }

    // 4. Delete user from DB (CASCADE handles related tables)
    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
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
