import { createDb } from './src/client.js';
import { departments } from './src/schema/departments.js';
import { companies } from './src/schema/companies.js';
import { eq } from 'drizzle-orm';

const url = 'postgres://mspro-ltd:mspro-ltd@127.0.0.1:54329/mspro-ltd';
const db = createDb(url);

const rows = await db.select().from(departments);
console.log('Departments count:', rows.length);
console.log(JSON.stringify(rows, null, 2));

process.exit(0);
