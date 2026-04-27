import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const isProduction = process.env.NODE_ENV === 'production';

const dbConfig = isProduction ? {
  host: process.env.PROD_DB_HOST || 'localhost',
  user: process.env.PROD_DB_USER,
  password: process.env.PROD_DB_PASS,
  database: process.env.PROD_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
} : {
  host: process.env.VITE_DB_HOST || 'localhost',
  user: process.env.VITE_DB_USER || 'root',
  password: process.env.VITE_DB_PASSWORD || '',
  database: process.env.VITE_DB_NAME || 'lens_workshop',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

if (isProduction) {
  console.log('Using PRODUCTION database configuration');
} else {
  console.log('Using LOCAL database configuration');
}

const pool = mysql.createPool(dbConfig);

// Configure multer for file uploads
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Sanitize original filename
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, uniqueSuffix + '-' + safeName);
  }
});

const upload = multer({ storage: storage });

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.post('/api/delete-file', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No url provided' });

  // Ensure url is within uploads folder to prevent path traversal
  if (!url.startsWith('/uploads/')) {
    return res.status(403).json({ error: 'Invalid file path' });
  }

  const filename = path.basename(url);
  const filePath = path.join(uploadDir, filename);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: 'Failed to delete file' });
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
        if (fileUrl && fileUrl.startsWith('/uploads/')) {
          const fname = path.basename(fileUrl);
          const fpath = path.join(uploadDir, fname);
          try {
            if (fs.existsSync(fpath)) {
              fs.unlinkSync(fpath);
              console.log(`Deleted file: ${fpath}`);
            }
          } catch (e) {
            console.error(`Failed to delete file ${fpath}:`, e);
          }
        }
      }
    }

    // 4. Delete user from DB (CASCADE handles related tables)
    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

    // 5. Send confirmation email
    try {
      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = parseInt(process.env.SMTP_PORT || '587');
      const smtpUser = process.env.SMTP_USER || '';
      const smtpPass = process.env.SMTP_PASS || '';

      if (smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
          from: `"Workshop Manager" <${smtpUser}>`,
          to: userEmail,
          subject: 'Account Deleted – Workshop Manager',
          html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 30px; background: #111; border-radius: 16px; color: #f5f0e8;">
              <h1 style="color: #d4a843; margin: 0 0 20px;">Account Deleted</h1>
              <p style="line-height: 1.7; color: #bbb;">
                Your Workshop Manager account (<strong style="color: #f5f0e8;">${userEmail}</strong>) has been permanently deleted along with all associated data and uploaded files.
              </p>
              <p style="line-height: 1.7; color: #bbb;">
                If you did not request this action, please contact us immediately.
              </p>
              <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;" />
              <p style="font-size: 12px; color: #666;">
                This is an automated message from Workshop Manager. Please do not reply.
              </p>
            </div>
          `,
        });
        console.log(`Confirmation email sent to ${userEmail}`);
      } else {
        console.log('SMTP not configured – skipping confirmation email');
      }
    } catch (emailErr) {
      console.error('Failed to send confirmation email:', emailErr);
      // Don't fail the request – account is already deleted
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Generic query endpoint
app.post('/api/query', async (req, res) => {
  const { sql, params } = req.body;
  try {
    const [rows] = await pool.execute(sql, params || []);
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});

// Serve static files from the React app in production
if (isProduction) {
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }
}
