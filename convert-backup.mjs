import fs from 'fs';

const sql = fs.readFileSync('data_backup.sql', 'utf8');

let output = '';
let inCopy = false;
let currentTable = '';
let columns = [];

const lines = sql.split('\n');

for (const line of lines) {
  // Skip psql commands
  if (line.startsWith('\\') || line.startsWith('SET ') || line.startsWith('SELECT ') ||
      line.includes('DISABLE TRIGGER') || line.includes('ENABLE TRIGGER') ||
      line.includes('SESSION AUTHORIZATION') || line.startsWith('--')) {
    continue;
  }

  // Detect COPY start
  if (line.startsWith('COPY public.')) {
    const match = line.match(/COPY public\.(\w+) \(([^)]+)\)/);
    if (match) {
      currentTable = match[1];
      columns = match[2].split(', ').map(c => c.trim());
      inCopy = true;
      continue;
    }
  }

  // End of COPY data
  if (line === '\\.') {
    inCopy = false;
    currentTable = '';
    columns = [];
    continue;
  }

  // Convert COPY data to INSERT
  if (inCopy && currentTable && line.trim()) {
    const values = line.split('\t').map(v => {
      if (v === '\\N') return 'NULL';
      // Escape single quotes and wrap in quotes
      const escaped = v.replace(/'/g, "''");
      return `'${escaped}'`;
    });

    output += `INSERT INTO ${currentTable} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
  }
}

fs.writeFileSync('data_inserts.sql', output);
console.log('Created data_inserts.sql');
console.log(`Total lines: ${output.split('\n').length}`);
