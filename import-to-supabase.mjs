import { PrismaClient } from '@prisma/client';
import fs from 'fs';

// Use Supabase direct connection
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:R%2B%21CqDG93Ly8Vwd@db.kewjuklpqxpiyojaazip.supabase.co:5432/postgres'
    }
  }
});

async function importData() {
  console.log('Connecting to Supabase...');

  try {
    // Read backup file
    const sql = fs.readFileSync('data_backup.sql', 'utf8');

    // Execute raw SQL
    await prisma.$executeRawUnsafe(sql);

    console.log('Data imported successfully!');
  } catch (error) {
    console.error('Error importing data:', error.message);

    // If COPY doesn't work, we need a different approach
    if (error.message.includes('COPY')) {
      console.log('\nCOPY command not supported. Use Supabase SQL Editor instead.');
      console.log('1. Go to https://supabase.com/dashboard/project/kewjuklpqxpiyojaazip/sql');
      console.log('2. Paste the contents of data_backup.sql');
      console.log('3. Run the query');
    }
  } finally {
    await prisma.$disconnect();
  }
}

importData();
