#!/usr/bin/env node
/**
 * Create GitHub Issues from Test Tickets
 *
 * Usage:
 *   node scripts/create-test-tickets.js              # Create all tickets
 *   node scripts/create-test-tickets.js --dry-run    # Preview without creating
 *   node scripts/create-test-tickets.js --filter critical  # Only critical tickets
 *   node scripts/create-test-tickets.js --filter pre-fight # Only pre-fight tickets
 *
 * Prerequisites:
 *   - GitHub CLI installed: https://cli.github.com/
 *   - Authenticated: gh auth login
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load tickets
const ticketsPath = path.join(__dirname, '../docs/test-tickets.json');
const { tickets } = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filterIndex = args.indexOf('--filter');
const filter = filterIndex !== -1 ? args[filterIndex + 1] : null;

// Filter tickets if specified
let ticketsToCreate = tickets;
if (filter) {
  ticketsToCreate = tickets.filter(t =>
    t.labels.includes(filter) ||
    t.id.toLowerCase().includes(filter.toLowerCase()) ||
    t.title.toLowerCase().includes(filter.toLowerCase())
  );
  console.log(`Filtered to ${ticketsToCreate.length} tickets matching "${filter}"`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`GitHub Issue Creator - ${ticketsToCreate.length} tickets`);
console.log(`${'='.repeat(60)}\n`);

if (dryRun) {
  console.log('DRY RUN MODE - No issues will be created\n');
}

// Create issues
let created = 0;
let failed = 0;

for (const ticket of ticketsToCreate) {
  console.log(`[${ticket.id}] ${ticket.title}`);

  if (dryRun) {
    console.log(`  Labels: ${ticket.labels.join(', ')}`);
    console.log(`  Body preview: ${ticket.body.substring(0, 100)}...`);
    console.log('  -> Would create issue\n');
    created++;
    continue;
  }

  try {
    // Build gh command
    const labels = ticket.labels.join(',');

    // Write body to temp file to handle special characters
    const tempFile = path.join(__dirname, '.temp-body.md');
    fs.writeFileSync(tempFile, ticket.body);

    const cmd = `gh issue create --title "${ticket.title.replace(/"/g, '\\"')}" --label "${labels}" --body-file "${tempFile}"`;

    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`  -> Created: ${result.trim()}\n`);
    created++;

    // Clean up temp file
    fs.unlinkSync(tempFile);

    // Rate limit protection
    await new Promise(resolve => setTimeout(resolve, 500));

  } catch (error) {
    console.log(`  -> FAILED: ${error.message}\n`);
    failed++;
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Summary: ${created} created, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

// Helper for async sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
