/**
 * Check which wallets from a list are in the beta whitelist
 * Usage: npx tsx scripts/check-beta-wallets.ts
 */

const WALLETS_RAW = `
6uR61eZqRbANqjukEDJRpKD2vRa3zrQRL3be9B8bn5e5
6dg2A7TC2Ruab4k4KB16Dd2Gn7NXApVCntyt1ArDLSiH
7DUThrxQfLJadwYseJ6dUsdY2neHcM2wrnEreqnQy2j2
E5gNhSTJomJT4eiU2mRAdW3ngtF8Xn1Xtque8cMThB6d
goazmjVHq68SkfZRfxaYK4ywMyqgAA16BAzncmivUYW
3dZoGjUUjqzz97pAwjMT98MMrUc9rUkUXJPpm44eVrsr
FeWihRSJyWANMCu1JAhjcVMvxbzZAfXAiHToQGJP6yFy
CfEo6ZJsUNWXTa3J5UjtAo3DUtcHrDxFpcPmBYPqSWmn
CopP9h9R5BCyFG2tXrDQjbxe6i1TkSRHkyRmF5Worunt
9W158NXeZtx2YfPubmsdYdiafwMJcQQW6hrYo61BfscW
HtN8U2uhkoce5yPnZCt6vw4NtaPp5c51C8pZqnNZNhuP
RSNs5jCBfVG89hwdEY6BPhv7ye3pDSqxHqfDcgK82W3
2K1mLFxEa7jGvinMtQrhmFTLnK5isnUMz9Yb7RRHyKha
3gN1dH9j9Z1zR1hWS9JC3aZXUWzBbE1KXQrvHiTCGqJ9
9uH1m5yWGFrCx1SnRYqjnaHyw32oE5tHM5svxLPj58ti
JALbSMohHjHym7q1dGRhxn1WiDupQ2xHEeSH849qMMJf
A9HknYu2gfK2vQhqPHYEpkkKR82ujdq1RNX7vBgg6zz4
4xnaeXerLKCcDHVQEkuEeiQKHouXNGwYEMmPM7Rjm4S7
87sUoiU7JZSkT9yH2JZ8eq2iNTu5RMLXSj5TL2nZHpjh
7W9We8dvr5Gz859AwzarCoZQ2WVW98uuBoj1sQ6QJC3E
DJGeVsM9HFczxQBsFpbyzc1YiLfXHkNNTiXVYhHBrhK5
93BDiBH8e9SmnWtedSC5cJg6LJQYnorFDZD37xDPHB9N
9jmTBhc7vUs9UPQ2eJDEQWYW61pq4WNVazwFh8MjiNTS
3D7TYFmdG6WXhj8EnJJzj4kjxXXBn88QBhL9apUhCTtq
2TEH429HiHBU3pGXZDng9AzToYqwZ3Gyvke29gLssmFC
DwC521h5sBw34mmeJQN7rGB5oetq376RL3rbz1K5oWpj
4EB46pAjUWRo6fPX5XRA3m4G5pYimodpX3MbRAMhjzHF
CuSvWwzMTfpC1JLEuAD3SMAbx3eTgXJT9fscxeSwhtav
8R6pKHLNTMvprPKssT8Nr7w2v9yWCbiBSwfGp4KRHV3n
67ACUxSzo5H8h51G9tJFbdgXxdSTci14ahmJ9Ze8PkTR
2saxCrhRLgvMzgwENAxfFaWZ8R5bD7P5YeWqsc61o9zG
4c6uat2tQuuL75Mqbn3kEsTKfuJ9itYo6PkX5DZLDLq8
63UASSeMsMjrM1nYTtyjdaNFxdkKgCqam7vqzXA9GWj8
7MKWQZiByT3DLnmMpnPestSZkudxsHru9CgN8hF11dx6
ATQChUEjNvUfrgKjrbGHPVucH9vtTreYDLzMsUFBrVEc
8npcZZnDs4fGrdzFZJnfCb7UhoRjvs5TxUEoTgVBw4V7
DCdKi3cwMYmamfSWVQvbbYK1X9V8Dbfb4HWC1kKrRR9G
D5pPEAi5dPN4zDRQrKyBcdKEAVXbkqX6iozrMDerqvYB
CYDC7csKXmgo5bYMoJyUGC9MHFoftJBFa2jCeTgs9BYa
2xqWStHsbTxSQXXvyhCWQ1zUHrkxoCKBxfSp5RJsjCju
KSv4CgrEgt6qsCu7JP1ZTAYEx5w6yLqjc8x6qirv7dh
CSoW9MRR2oiSP9cS6g5CXY7QJDMD5iarr1HMQdhJHaDW
BV8oybpQfcYbCR3ed3dXJ5QKim85xQK2vVRj43LMZzhf
CB8SMi29Zam9aSMhp2vorXbg3e4YqAbX2wD78ZpsihUV
3JYgz3b4WnpTJkz7xTPefzmRcMxmtXP2k4h8SxC4qPyK
4221kP87LSjf9298j5qXrKCjmYQKtokVUoxGgosC8VMA
6J6oaE3sxeez6f27fvQ9uJpPmgkZHHdQWLxYFoqpfCUJ
`;

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function main() {
  // Deduplicate wallets, filter out empty lines and "No"
  const wallets = [...new Set(
    WALLETS_RAW
      .split('\n')
      .map(w => w.trim())
      .filter(w => w.length > 20) // valid solana addresses are 32-44 chars
  )];

  console.log(`\nChecking ${wallets.length} unique wallets against beta whitelist...\n`);

  const inWhitelist: { wallet: string; status: string; isAlpha: boolean }[] = [];
  const notInWhitelist: string[] = [];
  const errors: { wallet: string; error: string }[] = [];

  for (const wallet of wallets) {
    try {
      const res = await fetch(`${BASE_URL}/api/beta/check?wallet=${wallet}`);
      const data = await res.json();

      if (data.success && data.applied) {
        inWhitelist.push({
          wallet,
          status: data.status || 'unknown',
          isAlpha: data.isAlphaTester || false,
        });
      } else {
        notInWhitelist.push(wallet);
      }
    } catch (err) {
      errors.push({ wallet, error: String(err) });
    }
  }

  // Results
  console.log('='.repeat(80));
  console.log(`IN BETA WHITELIST (${inWhitelist.length})`);
  console.log('='.repeat(80));
  for (const entry of inWhitelist) {
    const alpha = entry.isAlpha ? ' [ALPHA]' : '';
    console.log(`  ✓ ${entry.wallet}  →  ${entry.status.toUpperCase()}${alpha}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log(`NOT IN BETA WHITELIST (${notInWhitelist.length})`);
  console.log('='.repeat(80));
  for (const wallet of notInWhitelist) {
    console.log(`  ✗ ${wallet}`);
  }

  if (errors.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log(`ERRORS (${errors.length})`);
    console.log('='.repeat(80));
    for (const { wallet, error } of errors) {
      console.log(`  ! ${wallet}  →  ${error}`);
    }
  }

  console.log('\n' + '-'.repeat(80));
  console.log(`Summary: ${inWhitelist.length} in whitelist, ${notInWhitelist.length} not found, ${errors.length} errors`);
  console.log(`Total unique wallets checked: ${wallets.length}`);
}

main();
