const express = require('express');
const path    = require('path');
const session = require('express-session');
const xlsx    = require('xlsx');
const { pool, initSchema } = require('./database/db');

const app = express();

/* ===== SECURITY HEADERS ===== */
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; img-src 'self' data:; script-src 'self' 'unsafe-inline'");
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

/* ===== SESSION ===== */
app.use(session({
  secret: process.env.SESSION_SECRET || 'wedding-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
  },
}));

/* ===== HELPERS ===== */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin');
}

/* ===== PUBLIC API ===== */
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/guests', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name FROM guests WHERE rsvp_submitted = 0 ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.get('/api/guest/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid guest id.' });
    const { rows } = await pool.query(
      'SELECT id, name, type, rsvp_submitted FROM guests WHERE id = $1',
      [id]
    );
    const guest = rows[0];
    if (!guest) return res.status(404).json({ error: 'Guest not found.' });
    if (guest.rsvp_submitted) return res.status(400).json({ error: 'This guest has already RSVPed.' });
    res.json({ id: guest.id, name: guest.name.trim(), type: guest.type.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.post('/api/rsvp', async (req, res) => {
  const {
    guest_id, attending,
    meal1, dietary1,
    bring_plus_one, person2_name, meal2, dietary2,
  } = req.body;

  if (!guest_id) return res.status(400).json({ error: 'No guest selected.' });
  if (typeof attending !== 'boolean') {
    return res.status(400).json({ error: 'Please indicate whether you will be attending.' });
  }

  const VALID_MEALS = ['short_rib', 'chicken'];

  try {
    const id = parseInt(guest_id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid guest id.' });

    const { rows } = await pool.query('SELECT * FROM guests WHERE id = $1', [id]);
    const guest = rows[0];
    if (!guest) return res.status(404).json({ error: 'Guest not found.' });
    if (guest.rsvp_submitted) return res.status(400).json({ error: 'This guest has already RSVPed.' });

    const type = guest.type.trim();

    if (attending) {
      if (!VALID_MEALS.includes(meal1)) {
        return res.status(400).json({ error: 'Please select a meal choice.' });
      }
      if (type === 'C') {
        if (!VALID_MEALS.includes(meal2)) {
          return res.status(400).json({ error: 'Please select a meal for both guests.' });
        }
      }
      if (type === 'Y' && bring_plus_one) {
        if (!person2_name || !String(person2_name).trim()) {
          return res.status(400).json({ error: "Please enter your plus one's name." });
        }
        if (!VALID_MEALS.includes(meal2)) {
          return res.status(400).json({ error: "Please select a meal for your plus one." });
        }
      }
    }

    const safeP2Name =
      type === 'C' ? (person2_name || null) :
      (type === 'Y' && bring_plus_one) ? String(person2_name).trim() : null;

    await pool.query(
      `UPDATE guests SET
         rsvp_submitted  = 1,
         attending       = $1,
         person1_meal    = $2,
         person1_dietary = $3,
         bring_plus_one  = $4,
         person2_name    = $5,
         person2_meal    = $6,
         person2_dietary = $7
       WHERE id = $8`,
      [
        attending ? 1 : 0,
        attending ? meal1 : null,
        attending ? (dietary1 || null) : null,
        attending && type !== 'N' ? (bring_plus_one ? 1 : 0) : null,
        attending ? safeP2Name : null,
        attending && (type === 'C' || (type === 'Y' && bring_plus_one)) ? meal2 : null,
        attending && (type === 'C' || (type === 'Y' && bring_plus_one)) ? (dietary2 || null) : null,
        id,
      ]
    );

    res.json({ success: true, name: guest.name.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

/* ===== ADMIN ===== */
const adminLoginPage = (error = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login — Mark & Ari</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; background: #f9f6f1; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 12px; padding: 2.5rem 3rem; box-shadow: 0 4px 24px rgba(0,0,0,.1); width: 360px; }
    h1 { font-size: 1.5rem; color: #5a3e2b; margin-bottom: 1.5rem; text-align: center; }
    label { display: block; font-size: .85rem; color: #7a6652; margin-bottom: .3rem; margin-top: 1rem; }
    input { width: 100%; padding: .6rem .9rem; border: 1px solid #d4c4b0; border-radius: 6px; font-size: 1rem; }
    input:focus { outline: 2px solid #c8a97e; outline-offset: 2px; }
    .error { color: #b94a48; font-size: .88rem; margin-top: 1rem; text-align: center; }
    button { margin-top: 1.5rem; width: 100%; padding: .75rem; background: #c8a97e; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; font-family: Georgia, serif; }
    button:hover { background: #b8915e; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Mark &amp; Ari — Admin</h1>
    <form method="POST" action="/admin/login">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" autocomplete="username" required>
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
      <button type="submit">Log In</button>
    </form>
  </div>
</body>
</html>`;

app.get('/admin', (req, res) => {
  if (req.session && req.session.admin) return res.redirect('/admin/dashboard');
  res.send(adminLoginPage());
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.admin = true;
    return res.redirect('/admin/dashboard');
  }
  res.send(adminLoginPage('Invalid username or password.'));
});

app.post('/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => res.redirect('/admin'));
});

app.get('/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM guests ORDER BY name');

    const total       = rows.length;
    const submitted   = rows.filter(r => r.rsvp_submitted).length;
    const attending   = rows.filter(r => r.attending).length;
    const notAttend   = rows.filter(r => r.rsvp_submitted && !r.attending).length;
    const pending     = total - submitted;

    // count total people attending (including plus ones / couple 2nd)
    let totalPeople = 0;
    rows.forEach(r => {
      if (!r.attending) return;
      totalPeople++; // person 1
      if (r.bring_plus_one) totalPeople++; // person 2
    });

    const mealCounts = { short_rib: 0, chicken: 0 };
    rows.forEach(r => {
      if (r.person1_meal) mealCounts[r.person1_meal] = (mealCounts[r.person1_meal] || 0) + 1;
      if (r.person2_meal) mealCounts[r.person2_meal] = (mealCounts[r.person2_meal] || 0) + 1;
    });

    const mealLabel = { short_rib: 'Short Rib', chicken: 'Chicken' };

    const rows_html = rows.map(r => {
      const status = !r.rsvp_submitted ? 'Pending'
        : r.attending ? 'Attending'
        : 'Not Attending';
      const statusColor = !r.rsvp_submitted ? '#8a7a6a'
        : r.attending ? '#2e7d32'
        : '#c62828';

      const p1meal = r.person1_meal ? mealLabel[r.person1_meal] || r.person1_meal : '—';
      const p1diet = r.person1_dietary ? escapeHtml(r.person1_dietary) : '—';
      const p2name = r.person2_name ? escapeHtml(r.person2_name) : '—';
      const p2meal = r.person2_meal ? mealLabel[r.person2_meal] || r.person2_meal : '—';
      const p2diet = r.person2_dietary ? escapeHtml(r.person2_dietary) : '—';

      return `<tr>
        <td>${escapeHtml(r.name)}</td>
        <td style="color:${statusColor};font-weight:600">${status}</td>
        <td>${r.rsvp_submitted && r.attending ? p1meal : '—'}</td>
        <td>${r.rsvp_submitted && r.attending ? p1diet : '—'}</td>
        <td>${r.rsvp_submitted && r.attending && r.bring_plus_one ? p2name : '—'}</td>
        <td>${r.rsvp_submitted && r.attending && r.bring_plus_one ? p2meal : '—'}</td>
        <td>${r.rsvp_submitted && r.attending && r.bring_plus_one ? p2diet : '—'}</td>
      </tr>`;
    }).join('');

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RSVP Dashboard — Mark & Ari</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; background: #f9f6f1; color: #3a2e22; }
    header { background: #5a3e2b; color: #fff; padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; }
    header h1 { font-size: 1.3rem; }
    .actions { display: flex; gap: .75rem; }
    .btn { padding: .45rem 1rem; border-radius: 6px; font-family: Georgia, serif; font-size: .9rem; cursor: pointer; border: none; text-decoration: none; }
    .btn-export { background: #c8a97e; color: #fff; }
    .btn-export:hover { background: #b8915e; }
    .btn-logout { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.5); }
    .btn-logout:hover { background: rgba(255,255,255,.1); }
    main { padding: 2rem; max-width: 1200px; margin: 0 auto; }
    .stats { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem; }
    .stat { background: #fff; border-radius: 10px; padding: 1rem 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,.06); flex: 1 1 140px; text-align: center; }
    .stat-value { font-size: 2rem; font-weight: 700; color: #5a3e2b; }
    .stat-label { font-size: .8rem; color: #8a7a6a; margin-top: .2rem; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.06); font-size: .88rem; }
    th { background: #5a3e2b; color: #fff; padding: .75rem 1rem; text-align: left; font-weight: 600; }
    td { padding: .65rem 1rem; border-bottom: 1px solid #f0e8de; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #fdf8f3; }
  </style>
</head>
<body>
  <header>
    <h1>Mark &amp; Ari — RSVP Dashboard</h1>
    <div class="actions">
      <a href="/admin/export" class="btn btn-export">Download Excel</a>
      <form method="POST" action="/admin/logout" style="display:inline">
        <button type="submit" class="btn btn-logout">Log Out</button>
      </form>
    </div>
  </header>
  <main>
    <div class="stats">
      <div class="stat"><div class="stat-value">${total}</div><div class="stat-label">Total Invites</div></div>
      <div class="stat"><div class="stat-value">${submitted}</div><div class="stat-label">RSVPs Received</div></div>
      <div class="stat"><div class="stat-value">${pending}</div><div class="stat-label">Pending</div></div>
      <div class="stat"><div class="stat-value">${attending}</div><div class="stat-label">Attending</div></div>
      <div class="stat"><div class="stat-value">${notAttend}</div><div class="stat-label">Not Attending</div></div>
      <div class="stat"><div class="stat-value">${totalPeople}</div><div class="stat-label">Total Guests</div></div>
      <div class="stat"><div class="stat-value">${mealCounts.short_rib || 0}</div><div class="stat-label">Short Rib</div></div>
      <div class="stat"><div class="stat-value">${mealCounts.chicken || 0}</div><div class="stat-label">Chicken</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Status</th>
          <th>Person 1 Meal</th>
          <th>Person 1 Dietary</th>
          <th>Person 2 Name</th>
          <th>Person 2 Meal</th>
          <th>Person 2 Dietary</th>
        </tr>
      </thead>
      <tbody>${rows_html}</tbody>
    </table>
  </main>
</body>
</html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error.');
  }
});

app.get('/admin/export', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM guests ORDER BY name');

    const mealLabel = { short_rib: 'Short Rib', chicken: 'Chicken' };
    const data = rows.map(r => ({
      'Name':              r.name,
      'Type':              r.type,
      'RSVP Submitted':   r.rsvp_submitted ? 'Yes' : 'No',
      'Attending':         !r.rsvp_submitted ? '' : r.attending ? 'Yes' : 'No',
      'Person 1 Meal':     r.person1_meal ? (mealLabel[r.person1_meal] || r.person1_meal) : '',
      'Person 1 Dietary':  r.person1_dietary || '',
      'Bringing Plus One': r.bring_plus_one == null ? '' : r.bring_plus_one ? 'Yes' : 'No',
      'Person 2 Name':     r.person2_name || '',
      'Person 2 Meal':     r.person2_meal ? (mealLabel[r.person2_meal] || r.person2_meal) : '',
      'Person 2 Dietary':  r.person2_dietary || '',
    }));

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'RSVPs');

    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, ...data.map(r => String(r[key] || '').length)) + 2,
    }));
    ws['!cols'] = colWidths;

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="rsvps.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error.');
  }
});

/* ===== START ===== */
async function start() {
  await initSchema();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Wedding website running on port ${PORT}`));
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
