const db = require('./db');

const existing = db.prepare('SELECT COUNT(*) as count FROM guests').get();
if (existing.count > 0) {
  console.log('Database already seeded. Delete wedding.db to reseed.');
  process.exit(0);
}

const guests = [
  { name: 'Sarah Johnson', has_plus_one: 1 },
  { name: 'Michael Thompson', has_plus_one: 0 },
  { name: 'Emily Davis', has_plus_one: 1 },
  { name: 'James Wilson', has_plus_one: 1 },
  { name: 'Jennifer Martinez', has_plus_one: 0 },
  { name: 'Robert Anderson', has_plus_one: 1 },
  { name: 'Lisa Taylor', has_plus_one: 0 },
  { name: 'David Brown', has_plus_one: 1 },
  { name: 'Ashley Garcia', has_plus_one: 1 },
  { name: 'Christopher Lee', has_plus_one: 0 },
  { name: 'Amanda White', has_plus_one: 1 },
  { name: 'Matthew Harris', has_plus_one: 0 },
  { name: 'Stephanie Clark', has_plus_one: 1 },
  { name: 'Daniel Lewis', has_plus_one: 1 },
  { name: 'Michelle Robinson', has_plus_one: 0 },
  { name: 'Kevin Walker', has_plus_one: 1 },
  { name: 'Jessica Hall', has_plus_one: 0 },
  { name: 'Brian Young', has_plus_one: 1 },
  { name: 'Megan King', has_plus_one: 1 },
  { name: 'Tyler Scott', has_plus_one: 0 },
  { name: 'Rachel Green', has_plus_one: 1 },
  { name: 'Nathan Brooks', has_plus_one: 0 },
  { name: 'Olivia Turner', has_plus_one: 1 },
  { name: 'Brandon Mitchell', has_plus_one: 1 },
  { name: 'Samantha Reed', has_plus_one: 0 },
  { name: 'Patrick Murphy', has_plus_one: 1 },
  { name: 'Lauren Cooper', has_plus_one: 0 },
  { name: 'Andrew Rivera', has_plus_one: 1 },
  { name: 'Heather Cox', has_plus_one: 1 },
  { name: 'Jonathan Ward', has_plus_one: 0 },
];

const insert = db.prepare('INSERT INTO guests (name, has_plus_one) VALUES (?, ?)');
const insertMany = db.transaction((guests) => {
  for (const g of guests) insert.run(g.name, g.has_plus_one);
});

insertMany(guests);
console.log(`Seeded ${guests.length} guests.`);
