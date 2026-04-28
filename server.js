const express = require('express');
const path = require('path');
const { pool, initSchema } = require('./database/db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/guests', async (req, res) => {
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
      'SELECT id, name, has_plus_one, rsvp_submitted FROM guests WHERE id = $1',
      [req.params.id]
    );
    const guest = rows[0];
    if (!guest) return res.status(404).json({ error: 'Guest not found.' });
    if (guest.rsvp_submitted) return res.status(400).json({ error: 'This guest has already RSVPed.' });
    res.json({ id: guest.id, name: guest.name, has_plus_one: guest.has_plus_one === 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.post('/api/rsvp', async (req, res) => {
  const { guest_id, attending, meal_choice, bring_plus_one, plus_one_name, plus_one_meal } = req.body;

  if (!guest_id) return res.status(400).json({ error: 'No guest selected.' });
  if (typeof attending !== 'boolean') {
    return res.status(400).json({ error: 'Please indicate whether you will be attending.' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM guests WHERE id = $1', [guest_id]);
    const guest = rows[0];
    if (!guest) return res.status(404).json({ error: 'Guest not found.' });
    if (guest.rsvp_submitted) return res.status(400).json({ error: 'This guest has already RSVPed.' });

    if (attending) {
      if (!meal_choice || !['short_rib', 'chicken'].includes(meal_choice)) {
        return res.status(400).json({ error: 'Please select a meal choice.' });
      }
      if (guest.has_plus_one && bring_plus_one === true) {
        if (!plus_one_name || !plus_one_name.trim()) {
          return res.status(400).json({ error: "Please enter your plus one's name." });
        }
        if (!plus_one_meal || !['short_rib', 'chicken'].includes(plus_one_meal)) {
          return res.status(400).json({ error: 'Please select a meal for your plus one.' });
        }
      }
    }

    await pool.query(
      `UPDATE guests SET
         rsvp_submitted = 1,
         attending      = $1,
         meal_choice    = $2,
         bring_plus_one = $3,
         plus_one_name  = $4,
         plus_one_meal  = $5
       WHERE id = $6`,
      [
        attending ? 1 : 0,
        attending ? meal_choice : null,
        attending && guest.has_plus_one ? (bring_plus_one ? 1 : 0) : null,
        attending && guest.has_plus_one && bring_plus_one ? plus_one_name.trim() : null,
        attending && guest.has_plus_one && bring_plus_one ? plus_one_meal : null,
        guest_id,
      ]
    );

    res.json({ success: true, name: guest.name });
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
