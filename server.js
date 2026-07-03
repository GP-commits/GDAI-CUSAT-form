require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const path = require('path');
const { getDb } = require('./database/init');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Security ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// --- Body Parsing ---
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Sessions ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 4, // 4 hours
    sameSite: 'lax',
  },
}));

// --- Rate Limiting ---
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  message: { error: 'Too many submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' },
});

// --- Static Files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Initialize Database ---
const db = getDb();

// Hash admin password on startup
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(
  process.env.ADMIN_PASSWORD || 'gdai2026admin',
  10
);

// ============================================
// PUBLIC API ROUTES
// ============================================

// Submit form
app.post('/api/submit', submitLimiter, (req, res) => {
  try {
    const data = req.body;

    // Validate required fields
    const requiredFields = ['full_name', 'email', 'phone', 'year_of_study', 'branch', 'role_applied', 'available_for_interview'];
    for (const field of requiredFields) {
      if (!data[field] || String(data[field]).trim() === '') {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    // Check for duplicate email
    const existing = db.prepare('SELECT id FROM submissions WHERE email = ?').get(data.email);
    if (existing) {
      return res.status(409).json({ error: 'An application with this email already exists. Each person may only submit once.' });
    }

    // Sanitize strings
    const sanitize = (val) => val ? String(val).trim() : null;

    const stmt = db.prepare(`
      INSERT INTO submissions (
        full_name, email, phone, year_of_study, branch,
        previous_club_experience, portfolio_link, role_applied, role_answers,
        second_role_choice, anything_else, available_for_interview,
        ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      sanitize(data.full_name),
      sanitize(data.email),
      sanitize(data.phone),
      sanitize(data.year_of_study),
      sanitize(data.branch),
      sanitize(data.previous_club_experience),
      sanitize(data.portfolio_link),
      sanitize(data.role_applied),
      JSON.stringify(data.role_answers || {}),
      sanitize(data.second_role_choice),
      sanitize(data.anything_else),
      sanitize(data.available_for_interview),
      req.ip,
      req.get('User-Agent')
    );

    res.status(201).json({ success: true, message: 'Application submitted successfully!' });
  } catch (err) {
    console.error('Submission error:', err);
    res.status(500).json({ error: 'Failed to submit application. Please try again.' });
  }
});

// ============================================
// ADMIN AUTH ROUTES
// ============================================

app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }

  return res.status(401).json({ error: 'Invalid credentials.' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Failed to logout.' });
    res.json({ success: true });
  });
});

app.get('/api/admin/check', requireAuth, (req, res) => {
  res.json({ authenticated: true });
});

// ============================================
// ADMIN DATA ROUTES (Protected)
// ============================================

// Serve admin pages (protected)
app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});

app.get('/admin/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});

// Serve admin static assets (css/js) — these are fine to serve without auth
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Get all submissions
app.get('/api/admin/submissions', requireAuth, (req, res) => {
  try {
    const { role, search, sort } = req.query;
    let query = 'SELECT * FROM submissions WHERE 1=1';
    const params = [];

    if (role && role !== 'all') {
      query += ' AND role_applied = ?';
      params.push(role);
    }

    if (search) {
      query += ' AND (full_name LIKE ? OR email LIKE ? OR branch LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY created_at ' + (sort === 'oldest' ? 'ASC' : 'DESC');

    const submissions = db.prepare(query).all(...params);

    // Parse role_answers JSON
    submissions.forEach(s => {
      try { s.role_answers = JSON.parse(s.role_answers); }
      catch { s.role_answers = {}; }
    });

    res.json(submissions);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch submissions.' });
  }
});

// Get single submission
app.get('/api/admin/submissions/:id', requireAuth, (req, res) => {
  try {
    const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found.' });

    try { submission.role_answers = JSON.parse(submission.role_answers); }
    catch { submission.role_answers = {}; }

    res.json(submission);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submission.' });
  }
});

// Delete submission
app.delete('/api/admin/submissions/:id', requireAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM submissions WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Submission not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete submission.' });
  }
});

// Stats
app.get('/api/admin/stats', requireAuth, (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM submissions').get().count;
    const byRole = db.prepare('SELECT role_applied, COUNT(*) as count FROM submissions GROUP BY role_applied ORDER BY count DESC').all();
    const byYear = db.prepare('SELECT year_of_study, COUNT(*) as count FROM submissions GROUP BY year_of_study ORDER BY count DESC').all();
    const latest = db.prepare('SELECT created_at FROM submissions ORDER BY created_at DESC LIMIT 1').get();

    res.json({
      total,
      byRole,
      byYear,
      latestSubmission: latest ? latest.created_at : null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// CSV Export
app.get('/api/admin/export/csv', requireAuth, (req, res) => {
  try {
    const submissions = db.prepare('SELECT * FROM submissions ORDER BY created_at DESC').all();

    // CSV Header
    const headers = [
      'ID', 'Submitted At', 'Full Name', 'Email', 'Phone',
      'Year', 'Branch', 'Previous Experience', 'Portfolio Link',
      'Role Applied', 'Role-Specific Answers',
      'Second Choice', 'Additional Notes', 'Available for Interview'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    let csv = headers.join(',') + '\n';
    for (const s of submissions) {
      const row = [
        s.id, s.created_at, s.full_name, s.email, s.phone,
        s.year_of_study, s.branch, s.previous_club_experience, s.portfolio_link,
        s.role_applied, s.role_answers,
        s.second_role_choice, s.anything_else, s.available_for_interview
      ];
      csv += row.map(escapeCSV).join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=gdai-submissions.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export CSV.' });
  }
});

// --- Admin login page (public) ---
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`\n🎮 GDAI CUSAT Recruitment Server`);
  console.log(`   Form:      http://localhost:${PORT}`);
  console.log(`   Admin:     http://localhost:${PORT}/admin/login`);
  console.log(`   Port:      ${PORT}\n`);
});
