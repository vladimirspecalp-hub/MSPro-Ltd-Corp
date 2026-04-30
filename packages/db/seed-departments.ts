import { createDb } from './src/client.js';
import { departments } from './src/schema/departments.js';
import { companies } from './src/schema/companies.js';

const url = 'postgres://mspro-ltd:mspro-ltd@127.0.0.1:54329/mspro-ltd';
const db = createDb(url);

const allCompanies = await db.select({ id: companies.id, name: companies.name }).from(companies);
console.log('Companies:', JSON.stringify(allCompanies));

if (allCompanies.length === 0) {
  console.error('No companies found!');
  process.exit(1);
}

const companyId = '9bdd1254-4b9d-490d-aafa-04e26c81c329'; // MSPro Ltd (production company)
console.log('Using companyId:', companyId);

const inserted = await db
  .insert(departments)
  .values([
    { companyId, name: 'Сайт', color: '#820101', icon: 'globe', position: 1 },
    { companyId, name: 'Юр', color: '#2C3E50', icon: 'scale', position: 2 },
  ])
  .onConflictDoNothing()
  .returning();

console.log('Inserted departments:', JSON.stringify(inserted, null, 2));
process.exit(0);
