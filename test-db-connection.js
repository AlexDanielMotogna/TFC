// Quick database connection test
import pg from 'pg';

const connectionString = "postgresql://postgres:R+!CqDG93Ly8Vwd@db.kewjuklpqxpiyojaazip.supabase.co:5432/postgres";

console.log('Testing database connection...');
console.log('Connection string:', connectionString);

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  console.log('✓ Connected successfully!');

  const result = await client.query('SELECT NOW()');
  console.log('✓ Query executed:', result.rows[0]);

  await client.end();
  console.log('✓ Connection test passed');
  process.exit(0);
} catch (error) {
  console.error('✗ Connection failed:', error.message);
  process.exit(1);
}
