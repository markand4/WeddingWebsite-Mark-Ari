const { pool, resetSchema } = require('./db');

const guests = [
  { name: 'Jon Talos & Angelina Morales',                       type: 'C' },
  { name: 'Fermin & Margaret Godinez', type: 'C' },
  { name: 'Alex Wolff',                            type: 'N' },
  { name: 'Maggie Kurpiel & Chance',                       type: 'C' },
  { name: 'Camryn Stanton & Kai',                          type: 'C' },
  { name: 'Matt Kurpiel',                          type: 'Y' },
  { name: 'Sebastian Kurpiel',                     type: 'Y' },
  { name: 'Joe & Stenia Kurpiel',                  type: 'C' },
  { name: 'Ewa Rutkowska & John Kurpiel',          type: 'C' },
  { name: 'Isabel Vargas',                         type: 'N' },
  { name: 'Haleigh Hunt',                          type: 'N' },
  { name: 'Saif Jan',                              type: 'N' },
  { name: 'Efthemios Stamoulis',                   type: 'N' },
  { name: 'Matt Rutkowski & Juliet Karolina',                         type: 'C' },
  { name: 'Daniel Sklarzewski',                    type: 'Y' },
  { name: 'Emily & Jake Engler',                   type: 'C' },
  { name: 'Kelli Christopherson',                  type: 'N' },
  { name: 'Nicole Wegrzyniak',                     type: 'Y' },
  { name: 'Tessa & Fabian Godinez',               type: 'C' },
  { name: 'Damian Godinez & Jenny',                type: 'C' },
  { name: 'Fran & Rudy Muñoz',                           type: 'C' },
  { name: 'Brenden Muñoz',                         type: 'N' },
  { name: 'Andrew Godinez',                        type: 'N' },
  { name: 'Cassie Muñoz & Eliceo Mendoza',                       type: 'C' },
  { name: 'Jenelle Muñoz',                         type: 'Y' },
  { name: 'Nick Godinez',                          type: 'N' },
  { name: 'Kiko Godinez',                          type: 'N' },
  { name: 'Steve Brewer',                          type: 'N' },
  { name: 'Jay & Olga Cedillo',                    type: 'C' },
  { name: 'Linda Cedillo',                    type: 'N' },
  { name: 'Mary Jacobs & Chris Zingali',                          type: 'C' },
  { name: 'Ally Schellhase',                                  type: 'N' },
  { name: 'Arrod Mohammadian',                                 type: 'N' },
  { name: 'Mark Shaheen',                          type: 'N' },
  { name: 'Hannah Griffin & Brandon',                        type: 'C' },
  { name: 'Trevor Lampson',                        type: 'N' },
  { name: 'Jackson Rice',                          type: 'N' },
  { name: 'Claire & Armir Lako',                   type: 'C' },
  { name: 'Sarah Christopherson',                  type: 'N' },
  { name: 'Landon Spilsbury',                                type: 'N' },
  { name: 'Arthur Stys & Millie',                  type: 'C' },
  { name: 'Hunter Kahn',                           type: 'N' },
  { name: 'Thaia Garcia',                          type: 'Y' },
  { name: 'Ariel Wegrzyniak',                      type: 'Y' },
  { name: 'John Wegrzyniak',                       type: 'Y' },
  { name: 'Zofia & Stanislaw Kurpiel',             type: 'C' },
  { name: 'Adam Byrdak',                           type: 'Y' },
  { name: 'Natalia Byrdak & Sam',                        type: 'C' },
  { name: 'Lucy & Stanley Byrdak',                 type: 'C' },
  { name: 'Joey Byrdak',                           type: 'N' },
  { name: 'Bogdan & Holly Kaczmarcyk',             type: 'C' },
  { name: 'Maryann Byrdak',                        type: 'N' },
  { name: 'Stasia & Jim Boyle',                    type: 'C' },
  { name: 'Teresa & Glen Dyke',                    type: 'C' },
  { name: 'Joe Byrdak',                            type: 'N' },
  { name: 'Mia Byrdak',                            type: 'N' },
  { name: 'Wladyslawa Byrdak',                        type: 'N' },
  { name: 'Patrick Gadawski',                      type: 'Y' },
  { name: 'Zdzisiek & Barbara Lukaszyk',           type: 'C' },
  { name: 'Marysia & Piotr',                       type: 'C' },
  { name: 'Matthew Godinez',                       type: 'N' },
  { name: 'Aneta Wegrzyniak',                                 type: 'N' },
  { name: 'Sheridan Rogers',                       type: 'N' },
  { name: 'Annie Ortizo',                          type: 'N' },
  { name: 'Kara Garland',                          type: 'N' },
  { name: 'Mr. & Mrs. Gadawski',                        type: 'Y' },
  { name: 'Michael Manson & Anita Feemster',        type: 'C' },
  { name: 'Jake Eshel & Brittany Burns',                       type: 'C' },
  { name: 'Maggie Wyszynski',                      type: 'Y' },
  { name: 'Jack Poppenberger',                     type: 'N' },
  { name: 'Monty Mader',                           type: 'N' },
  { name: 'Abby Rosa',                                  type: 'N' },
  { name: 'Zach Clark & Sara Carrington',                           type: 'C' },
  { name: 'Brad Williams',                         type: 'N' },
  { name: 'Wojtek & Beata Bednarczyk',             type: 'C' },
  { name: 'Monika & Michal Obstoj',                type: 'C' },
  { name: 'Tatiana Vogel & Grant Gattison',                       type: 'C' },
];

async function seed() {
  console.log('Resetting schema and seeding real guest list…');
  await resetSchema();

  for (const g of guests) {
    await pool.query(
      'INSERT INTO guests (name, type) VALUES ($1, $2)',
      [g.name, g.type]
    );
  }

  console.log(`Seeded ${guests.length} guests.`);
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
