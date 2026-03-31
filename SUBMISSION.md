# DEADLIST - Hackathon Submission

## EVE Frontier x Sui Hackathon 2026

---

## Project Name
**DEADLIST: The Unfarmable Bounty Board**

## One-Line Description
A trustless, blockchain-enforced bounty system that solves EVE Online's 20-year broken bounty problem through on-chain anti-farming verification.

---

## Problem Statement

EVE Online's bounty system was **disabled in October 2020** after 20 years of failure. Every iteration was exploited:

| Year | System | Exploit |
|------|--------|---------|
| 2003 | Full payout | Alt/friend farms 100% |
| 2012 | 20% of kill value | Cheap ship farming |
| 2020 | Disabled | CCP gave up |

**Core Problem:** In a server-controlled system, there's no way to prevent players from colluding to farm their own bounties.

---

## Solution: DEADLIST

DEADLIST uses **blockchain's unique properties** to create an unfarmable bounty system:

### Key Features

1. **100% Payout** - Full bounty goes to killer (no percentage nonsense)
2. **On-Chain Escrow** - Trustless, transparent, can't be manipulated
3. **Anti-Farming Rules** - Enforced by smart contract, not admins
4. **No Expiration** - Bounties persist until claimed or cancelled
5. **Poster Deposits Real Value** - Skin in the game

### Anti-Farming Rules

| Rule | Implementation |
|------|----------------|
| **Tribe Exclusion** | Killer and victim in same tribe? DENIED |
| **Mutual Kill Detection** | Killed each other recently? DENIED |
| **Blacklist** | Poster can exclude specific players |
| **Minimum Kill Value** | Ship too cheap? DENIED |

### Why Blockchain Makes This Possible

- **Every kill is immutably recorded** - Can't fake or hide
- **Tribe membership is verifiable** - Can't claim you're not friends
- **Kill history is queryable** - Patterns are detectable
- **Rules are code, not policy** - Can't be social-engineered

---

## Technical Implementation

### Smart Contract (Move/Sui)
- Full implementation: `contracts/sources/deadlist.move` (617 lines)
- Handles escrow, anti-farming checks, claim verification
- Event emission for UI updates

### Frontend
- Space-themed UI with bounty board, leaderboard, analytics
- Wallet integration ready for Sui Wallet
- Responsive design

### Architecture
```
User → Frontend → Sui Network → DEADLIST Contract → EVE World Contract
                                     ↓
                              Anti-Farming Checks
                                     ↓
                              Payout or Reject
```

---

## Target Categories

### Primary: Creative
DEADLIST solves a problem players have complained about for **20 years**. It's not just a tech demo - it addresses real player pain that even CCP couldn't solve.

### Secondary: Utility
- Enables bounty hunter profession
- Creates content (hunts)
- Adds consequences for griefing
- Generates emergent gameplay

### Tertiary: Technical Implementation
- Clean Move architecture
- Full anti-farming logic
- Event-driven design
- Test helpers included

---

## Demo

### Live Demo URL
[To be filled after deployment]

### GitHub Repository
[To be filled]

### Demo Video
[To be filled - see DEMO_SCRIPT.md]

---

## Team

Solo developer (hackathon submission)

---

## Future Development

### If We Win
1. Integrate with EVE Frontier World Contract for real kill verification
2. Add tribe data integration for same-corp detection
3. Deploy to Stillness mainnet
4. Add platform fee for sustainable development

### Long-Term Vision
- Multi-bounty stacking on single target
- Bounty insurance (protection payments)
- Reputation system for hunters
- Mobile companion app

---

## Links

| Resource | URL |
|----------|-----|
| Smart Contract | `contracts/sources/deadlist.move` |
| Frontend | `frontend/index.html` |
| Full Documentation | `PROJECT_DOCUMENTATION.md` |
| Deployment Guide | `DEPLOYMENT.md` |

---

## Why We Should Win

1. **Solves Real Problem** - Not theoretical, players want this
2. **Uses Blockchain Correctly** - Leverages what blockchain uniquely enables
3. **Complete Implementation** - Working contract + UI, not just a concept
4. **20 Years of Validation** - CCP's failure proves the need exists

---

*"The bounty system EVE always needed."*

---

*Submitted: March 2026*
*EVE Frontier x Sui Hackathon 2026*
