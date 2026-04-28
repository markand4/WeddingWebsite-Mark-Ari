const express = require('express');
const path = require('path');
const db = require('./database/db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/guests', (req, res) => {
  const guests = db
    .prepare('SELECT id, name FROM guests WHERE rsvp_submitted = 0 ORDER BY name')
    .all();
  res.json(guests);
});

app.get('/api/guest/:id', (req, res) => {
  const guest = db
    .prepare('SELECT id, name, has_plus_one, rsvp_submitted FROM guests WHERE id = ?')
    .get(req.params.id);

  if (!guest) return res.status(404).json({ error: 'Guest not found.' });
  if (guest.rsvp_submitted) return res.status(400).json({ error: 'This guest has already RSVPed.' });

  res.json({ id: guest.id, name: guest.name, has_plus_one: guest.has_plus_one === 1 });
});

app.post('/api/rsvp', (req, res) => {
  const { guest_id, attending, meal_choice, bring_plus_one, plus_one_name, plus_one_meal } = req.body;

  if (!guest_id) return res.status(400).json({ error: 'No guest selected.' });

  const guest = db.prepare('SELECT * FROM guests WHERE id = ?').get(guest_id);
  if (!guest) return res.status(404).json({ error: 'Guest not found.' });
  if (guest.rsvp_submitted) return res.status(400).json({ error: 'This guest has already RSVPed.' });

  if (typeof attending !== 'boolean') {
    return res.status(400).json({ error: 'Please indicate whether you will be attending.' });
  }

  if (attending) {
    if (!meal_choice || !['short_rib', 'chicken'].includes(meal_choice)) {
      return res.status(400).json({ error: 'Please select a meal choice.' });
    }
    if (guest.has_plus_one && bring_plus_one === true) {
      if (!plus_one_name || !plus_one_name.trim()) {
        return res.status(400).json({ error: 'Please enter your plus one\'s name.' });
      }
      if (!plus_one_meal || !['short_rib', 'chicken'].includes(plus_one_meal)) {
        return res.status(400).json({ error: 'Please select a meal for your plus one.' });
      }
    }
  }

  db.prepare(`
    UPDATE guests SET
      rsvp_submitted = 1,
      attending = ?,
      meal_choice = ?,
      bring_plus_one = ?,
      plus_one_name = ?,
      plus_one_meal = ?
    WHERE id = ?
  `).run(
    attending ? 1 : 0,
    attending ? meal_choice : null,
    attending && guest.has_plus_one ? (bring_plus_one ? 1 : 0) : null,
    attending && guest.has_plus_one && bring_plus_one ? plus_one_name.trim() : null,
    attending && guest.has_plus_one && bring_plus_one ? plus_one_meal : null,
    guest_id
  );

  res.json({ success: true, name: guest.name });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Wedding website running at http://localhost:${PORT}`));
