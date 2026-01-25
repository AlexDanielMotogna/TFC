# Anti-Cheat System - User Guide

## What is the Anti-Cheat System?

Trade Fight Club uses an automated cheat detection system to ensure all fights are fair and competitive. This system analyzes each fight upon completion and determines whether it should count toward rankings or be excluded.

---

## Why Does It Exist?

The system protects platform integrity by detecting:

- **Point farming** - Fake fights between accounts owned by the same user
- **Ranking manipulation** - Attempts to inflate stats without actually competing
- **Multi-accounting** - Using multiple accounts to self-match
- **Collusion** - Agreements between users not to compete

---

## System Rules

### 1. Zero-Zero Rule

**What does it detect?**
Fights where both players end with PnL close to $0.

**Why is this suspicious?**
If two traders "compete" but neither wins nor loses money, they probably weren't actually trading.

**Threshold:** Both players' PnL < $0.01

**Result:** Fight is marked as **NO CONTEST** and doesn't count toward rankings.

---

### 2. Minimum Volume Rule

**What does it detect?**
Fights where a player trades with very low volume.

**Why is this suspicious?**
Opening $1 positions doesn't represent real trading. It's a way to "simulate" competing.

**Threshold:** Total volume < $10 per player

**Result:** Fight is marked as **NO CONTEST**.

---

### 3. Repeated Matchup Rule

**What does it detect?**
The same pair of users fighting too many times in a short period.

**Why is this suspicious?**
If you always fight the same person, they could be coordinating results or be the same person with two accounts.

**Threshold:** 3 or more fights between the same users in 24 hours

**Result:**
- Current fight is marked as **NO CONTEST**
- Matchmaking between that pair is temporarily blocked

---

### 4. Same IP Rule

**What does it detect?**
Both players connecting from the same IP address repeatedly.

**Why is this suspicious?**
If two "opponents" always connect from the same location, they're probably the same person.

**Threshold:** 2 or more fights from the same IP between the same pair

**Result:** Fight is marked as **NO CONTEST**.

> **Note:** A single IP match won't penalize you (you could be at the same cafe or university). The system only acts when there's a repeated pattern.

---

## What Does "NO CONTEST" Mean?

When a fight is marked as **NO CONTEST**:

| Aspect | Effect |
|--------|--------|
| **Ranking/Leaderboard** | Doesn't count |
| **Win Rate** | Not affected |
| **Total PnL** | Not added |
| **History** | Still appears (marked as NO CONTEST) |
| **Weekly Prizes** | Doesn't qualify |

Basically, it's as if the fight never existed for competitive purposes.

---

## Frequently Asked Questions

### Can I get banned for this?

**No.** The system doesn't ban users. It simply excludes suspicious fights from rankings. You can continue using the platform normally.

### What if I fight against a friend?

Fighting friends is allowed, but:
- Maximum 2 fights per day against the same person
- You must trade for real (volume > $10)
- Both players can't end at $0

### How do I know if my fight was flagged?

In your fight history, you'll see the status:
- **FINISHED** - Valid fight, counts toward ranking
- **NO CONTEST** - Fight excluded by anti-cheat

### Can I appeal a decision?

There's currently no automatic appeal system. If you believe there was an error, contact support on Twitter [@tradefightclub](https://twitter.com/tradefightclub).

### Can the system make mistakes?

The system is designed to minimize false positives:
- Uses conservative thresholds
- Requires repeated patterns (doesn't penalize isolated incidents)
- Only excludes clearly suspicious fights

---

## Tips to Avoid Problems

1. **Trade for real** - Open significant positions (> $10)
2. **Vary your opponents** - Don't always fight the same person
3. **Compete to win** - The system detects when nobody tries to win
4. **One account per person** - Don't use multiple accounts

---

## Transparency

The anti-cheat system is fully automatic and applies the same rules to all users without exceptions. There's no manual intervention or favoritism.

All detected violations are logged internally for analysis and system improvement.

---

## Rules Summary

| Rule | Threshold | Action |
|------|-----------|--------|
| Zero-Zero | Both PnL < $0.01 | NO CONTEST |
| Minimum Volume | Notional < $10 | NO CONTEST |
| Repeated Matchups | 3+ fights in 24h | NO CONTEST + Block |
| Same IP | 2+ fights same IP | NO CONTEST |

---

*Last updated: January 2026*
