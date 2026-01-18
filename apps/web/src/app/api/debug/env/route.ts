/**
 * Debug endpoint to check environment variables
 * GET /api/debug/env
 */
import { NextResponse } from 'next/server';

export async function GET() {
  const envVars = Object.keys(process.env).sort();

  // Check for database-related vars
  const dbVars = envVars.filter(k =>
    k.includes('DATABASE') ||
    k.includes('POSTGRES') ||
    k.includes('DIRECT') ||
    k.includes('PRISMA')
  );

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    databaseUrlExists: !!process.env.DATABASE_URL,
    databaseUrlLength: process.env.DATABASE_URL?.length || 0,
    databaseUrlStart: process.env.DATABASE_URL?.substring(0, 30) || 'NOT SET',
    directUrlExists: !!process.env.DIRECT_URL,
    dbRelatedVars: dbVars,
    totalEnvVars: envVars.length,
    // Show all env var names (not values) for debugging
    allEnvVarNames: envVars,
  });
}
