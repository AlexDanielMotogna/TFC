#!/usr/bin/env npx tsx
/**
 * CLI Script to run the Fight System Scanner
 *
 * Usage:
 *   npx tsx apps/jobs/src/scripts/run-fight-scanner.ts
 *   npx tsx apps/jobs/src/scripts/run-fight-scanner.ts --json
 *
 * Options:
 *   --json    Output results as JSON instead of formatted text
 *   --help    Show this help message
 */

import { runFightSystemScan, formatReportForConsole } from '../jobs/fight-system-scanner.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Fight System Scanner
=====================

Scans the fight system for inconsistencies, race conditions, and data integrity issues.

Usage:
  npx tsx apps/jobs/src/scripts/run-fight-scanner.ts [options]

Options:
  --json     Output results as JSON
  --help     Show this help message

Examples:
  # Run scan with formatted output
  npx tsx apps/jobs/src/scripts/run-fight-scanner.ts

  # Run scan with JSON output (for piping to other tools)
  npx tsx apps/jobs/src/scripts/run-fight-scanner.ts --json

  # Save JSON report to file
  npx tsx apps/jobs/src/scripts/run-fight-scanner.ts --json > scan-report.json
`);
    process.exit(0);
  }

  const jsonOutput = args.includes('--json');

  try {
    console.error('Starting Fight System Scan...\n');

    const report = await runFightSystemScan();

    if (jsonOutput) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatReportForConsole(report));
    }

    // Exit with error code if critical issues found
    if (report.criticalCount > 0) {
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('Scan failed:', error);
    process.exit(2);
  }
}

main();
