const wallets = [
  '7DUThrxQfLJadwYseJ6dUsdY2neHcM2wrnEreqnQy2j2',
  'E5gNhSTJomJT4eiU2mRAdW3ngtF8Xn1Xtque8cMThB6d',
  'goazmjVHq68SkfZRfxaYK4ywMyqgAA16BAzncmivUYW',
  'FeWihRSJyWANMCu1JAhjcVMvxbzZAfXAiHToQGJP6yFy',
  'CfEo6ZJsUNWXTa3J5UjtAo3DUtcHrDxFpcPmBYPqSWmn',
  'HtN8U2uhkoce5yPnZCt6vw4NtaPp5c51C8pZqnNZNhuP',
  '2K1mLFxEa7jGvinMtQrhmFTLnK5isnUMz9Yb7RRHyKha',
  '3gN1dH9j9Z1zR1hWS9JC3aZXUWzBbE1KXQrvHiTCGqJ9',
  '9uH1m5yWGFrCx1SnRYqjnaHyw32oE5tHM5svxLPj58ti',
  'A9HknYu2gfK2vQhqPHYEpkkKR82ujdq1RNX7vBgg6zz4',
  '4xnaeXerLKCcDHVQEkuEeiQKHouXNGwYEMmPM7Rjm4S7',
  '87sUoiU7JZSkT9yH2JZ8eq2iNTu5RMLXSj5TL2nZHpjh',
  'CuSvWwzMTfpC1JLEuAD3SMAbx3eTgXJT9fscxeSwhtav',
  'CYDC7csKXmgo5bYMoJyUGC9MHFoftJBFa2jCeTgs9BYa',
  '2xqWStHsbTxSQXXvyhCWQ1zUHrkxoCKBxfSp5RJsjCju',
  '4221kP87LSjf9298j5qXrKCjmYQKtokVUoxGgosC8VMA',
  '6J6oaE3sxeez6f27fvQ9uJpPmgkZHHdQWLxYFoqpfCUJ',
];

async function main() {
  // beta/check gives us isAlphaTester but not the note.
  // We need the admin API for notes. Let's try to get auth token from env or use direct DB query.
  // First try beta/check to see which are alpha testers
  const results: { wallet: string; isAlpha: boolean; referralCode: string }[] = [];

  for (const w of wallets) {
    const r = await fetch(`http://localhost:3001/api/beta/check?wallet=${w}`);
    const d = await r.json();
    results.push({
      wallet: w,
      isAlpha: d.success && d.isAlphaTester,
      referralCode: d.referralCode || '-',
    });
  }

  const alphaWallets = results.filter(r => r.isAlpha);
  const notAlpha = results.filter(r => !r.isAlpha);

  console.log(`\nIN ALPHA TESTERS (${alphaWallets.length}):`);
  for (const r of alphaWallets) {
    console.log(`  ✓ ${r.wallet}  | referral: ${r.referralCode}`);
  }

  console.log(`\nNOT IN ALPHA TESTERS (${notAlpha.length}):`);
  for (const r of notAlpha) {
    console.log(`  ✗ ${r.wallet}`);
  }

  // Now try to get notes via Prisma directly
  console.log('\n--- Fetching notes from DB directly ---\n');
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const alphaAddresses = alphaWallets.map(a => a.wallet);
    const testers = await prisma.alphaTester.findMany({
      where: { walletAddress: { in: wallets } },
      select: { walletAddress: true, note: true, accessEnabled: true, createdAt: true },
    });

    if (testers.length > 0) {
      console.log(`Found ${testers.length} in alpha_tester table:\n`);
      for (const t of testers) {
        console.log(`  ${t.walletAddress}`);
        console.log(`    Note: ${t.note || '(none)'}`);
        console.log(`    Access: ${t.accessEnabled ? 'ENABLED' : 'DISABLED'}`);
        console.log(`    Added: ${t.createdAt.toLocaleString()}`);
        console.log('');
      }
    } else {
      console.log('No entries found in alpha_tester table for these wallets.');
    }

    // Check which wallets are NOT in alpha table at all
    const inTable = new Set(testers.map(t => t.walletAddress));
    const missing = wallets.filter(w => !inTable.has(w));
    if (missing.length > 0) {
      console.log(`\nNot in alpha_tester table (${missing.length}):`);
      for (const w of missing) {
        console.log(`  ✗ ${w}`);
      }
    }

    await prisma.$disconnect();
  } catch (err) {
    console.log('Could not query DB directly:', err);
  }
}

main();
