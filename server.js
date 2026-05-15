const express = require('express');
const path = require('path');
const { pool, initSchema } = require('./database/db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    const { rows } = await pool.query(
      'SELECT id, name, type, rsvp_submitted FROM guests WHERE id = $1',
      [req.params.id]
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

  try {
    const { rows } = await pool.query('SELECT * FROM guests WHERE id = $1', [guest_id]);
    const guest = rows[0];
    if (!guest) return res.status(404).json({ error: 'Guest not found.' });
    if (guest.rsvp_submitted) return res.status(400).json({ error: 'This guest has already RSVPed.' });

    const type = guest.type.trim();

    if (attending) {
      if (!meal1 || !['short_rib', 'chicken'].includes(meal1)) {
        return res.status(400).json({ error: 'Please select a meal choice.' });
      }
      if (type === 'C') {
        if (!meal2 || !['short_rib', 'chicken'].includes(meal2)) {
          return res.status(400).json({ error: 'Please select a meal for both guests.' });
        }
      }
      if (type === 'Y' && bring_plus_one) {
        if (!person2_name || !person2_name.trim()) {
          return res.status(400).json({ error: "Please enter your plus one's name." });
        }
        if (!meal2 || !['short_rib', 'chicken'].includes(meal2)) {
          return res.status(400).json({ error: "Please select a meal for your plus one." });
        }
      }
    }

    const storedPerson2Name =
      type === 'C' ? (person2_name || null) :
      (type === 'Y' && bring_plus_one) ? person2_name.trim() : null;

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
        attending ? storedPerson2Name : null,
        attending && (type === 'C' || (type === 'Y' && bring_plus_one)) ? meal2 : null,
        attending && (type === 'C' || (type === 'Y' && bring_plus_one)) ? (dietary2 || null) : null,
        guest_id,
      ]
    );

    res.json({ success: true, name: guest.name.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

async function start() {
  await initSchema();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Wedding website running on port ${PORT}`));
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
