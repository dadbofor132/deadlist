# EVE Frontier Hackathon 2026 - Project Documentation

## Table of Contents
1. [Competition Overview](#competition-overview)
2. [Research Findings](#research-findings)
3. [Hackathon Project: DEADLIST](#hackathon-project-deadlist)
4. [Technical Implementation](#technical-implementation)

---

# Competition Overview

## EVE Frontier x Sui Hackathon 2026

- **Dates:** March 11-31, 2026
- **Prize Pool:** $80,000 USD
- **Theme:** "A Toolkit for Civilization"
- **Registration:** https://deepsurge.xyz/evefrontier2026

### Prize Structure

**Overall Winners:**
| Place | Prize |
|-------|-------|
| 1st | $15,000 + FanFest passes + travel + 60k EVE Points + $10k SUI tokens |
| 2nd | $7,500 + similar perks |
| 3rd | $5,000 + similar perks |

**Category Champions ($5,000 each):**
1. **Utility** — Mods that materially change survival, coordination, exploration, or competition
2. **Technical Implementation** — Clean architecture, smart use of Frontier systems, scalability
3. **Creative** — Novel ideas, clever reinterpretations, bold system concepts
4. **Weirdest Idea** — Visually striking, surprising, or meme-worthy creations
5. **Live Frontier Integration** — Mods deployed and functioning in Stillness

---

# Research Findings

## EVE Frontier Technical Stack

### Blockchain Migration (March 11, 2026)
- **Migrated FROM:** Ethereum L2 (Redstone/MUD Framework/Solidity)
- **Migrated TO:** Sui blockchain (Move language)
- **Impact:** All old Solidity documentation/examples are obsolete

### Smart Assemblies
Three types of programmable in-game structures:
1. **Smart Storage Unit** — Storage, vending machines, marketplaces
2. **Smart Turret** — Automated defense, custom targeting logic
3. **Smart Gate** — Player-built stargates, access control

### Key Technical Resources
- **Documentation:** https://docs.evefrontier.com
- **Move Language:** https://move-book.com/
- **Sui Docs:** https://docs.sui.io/
- **New Move Contracts:** https://github.com/evefrontier/world-contracts

### On-Chain Data Available
- Kill events (killer_id, victim_id, solar_system_id, timestamp)
- Tribe/Corp membership
- Character data
- Transaction history

## Investment & Backing
- **$40M raised** led by Andreessen Horowitz (a16z)
- Other investors: Makers Fund, Bitkraft, Kingsway Capital, Hashed, Nexon

## Economy Model
- **LUX Token:** In-game currency (not on blockchain)
- **EVE Token:** Blockchain token, tradeable externally for real money
- **Current State:** Founder Access cycles until full launch
- **Future:** Players can earn EVE tokens through gameplay and cash out

---

# Hackathon Project: DEADLIST

## The Unfarmable Bounty Board

**Tagline:** "The bounty system EVE always needed."

## Problem Statement

### EVE Online's Bounty System Failure (20 Years of Pain)

**History:**
| Era | System | Problem |
|-----|--------|---------|
| Original | Full bounty paid on kill | Alt/friend farms 100% |
| Retribution (2012) | 20% of ship value | Still farmable in cheap ships |
| October 2020 | Disabled entirely | CCP gave up |
| Today | Still gone | No replacement after 4+ years |

**Core Exploits:**

1. **Self-Farming**
   - Friend kills you in cheap ship
   - Collect small payout
   - Repeat hundreds of times
   - Extract full bounty to yourself

2. **Alt Farming**
   - Create alt account
   - Alt kills main in cheap ship
   - Transfer ISK back

3. **Corp Mate Collusion**
   - Corp mate "accidentally" kills you
   - Bounty goes to corp/tribe
   - Everyone benefits except bounty poster

4. **Griefing via Placement**
   - Place bounties on innocent players
   - Used as harassment tool

5. **High-Bounty Target Immunity**
   - If bounty > ship cost, just fly cheap ships forever
   - No hunter will bother

**Why CCP's 20% Fix Failed:**
- Self-farming just takes longer, still works
- Targets fly cheap ships to minimize payouts
- Hunter profession non-viable (payouts too small)

## Our Solution

### Design Principles

1. **Full Payout** — 100% of bounty goes to killer (not %)
2. **On-Chain Escrow** — Trustless, can't be manipulated
3. **Anti-Farming Rules** — Enforced by smart contract
4. **No Expiration** — Bounties persist until claimed
5. **Poster Deposits Real Value** — Skin in the game

### Anti-Farming Rules

| Rule | How It Works |
|------|--------------|
| **Tribe Exclusion** | Killer and victim in same tribe? DENIED |
| **Kill History Check** | Same killer claimed on same victim recently? DENIED |
| **Mutual Kill Detection** | They've killed each other repeatedly? DENIED |
| **Minimum Kill Value** | Ship destroyed worth less than threshold? DENIED |
| **Blacklist** | Poster can exclude specific players from claiming |

### System Flow

```
POSTING A BOUNTY:
├── Deposit: Full bounty amount (locked in escrow)
├── Target: Player ID
├── Min Kill Value: Optional threshold
├── Blacklist: Optional excluded claimers
└── Status: ACTIVE (no expiration)

CLAIMING A BOUNTY:
├── Kill detected on-chain
├── Anti-farming verification:
│   ├── Killer ≠ same tribe as victim? ✓
│   ├── No recent mutual kills? ✓
│   ├── Not on blacklist? ✓
│   └── Kill value ≥ minimum? ✓
├── All checks pass → Bounty released to killer
└── Any check fails → Bounty remains active

CANCELING A BOUNTY:
├── Only poster can cancel
├── Funds return to poster
└── Grace period? (Optional - prevent gaming)
```

### Why Blockchain Solves This

**Traditional servers (EVE Online):**
- CCP controls all data
- Rules can be gamed via edge cases
- Server load from calculations
- No transparency

**On-chain (EVE Frontier):**
- Every kill is immutably recorded
- Tribe membership is verifiable
- Kill history is queryable
- Rules are enforced by code, not admins
- Fully transparent and auditable

## Target Categories

- **Primary:** Creative + Utility
- **Secondary:** Live Frontier Integration (if deployed)
- **Stretch:** Overall Top 3 ($15k)

## Competitive Advantage

1. **Solves real 20-year problem** — Not just a tech demo
2. **Uses blockchain's unique properties** — Not possible in traditional architecture
3. **Actually useful** — Players want this
4. **Memorable pitch** — "The bounty system EVE gave up on"

---

# Technical Implementation

## Architecture

```
┌─────────────────────────────────────────────┐
│              DEADLIST SYSTEM                │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────┐    ┌─────────────────┐    │
│  │   Frontend  │───▶│   Sui Network   │    │
│  │   (Web UI)  │    │                 │    │
│  └─────────────┘    │  ┌───────────┐  │    │
│                     │  │ DEADLIST  │  │    │
│                     │  │ Contract  │  │    │
│                     │  │ (Move)    │  │    │
│                     │  └───────────┘  │    │
│                     │        │        │    │
│                     │        ▼        │    │
│                     │  ┌───────────┐  │    │
│                     │  │ EVE World │  │    │
│                     │  │ Contract  │  │    │
│                     │  │ (Kills,   │  │    │
│                     │  │  Tribes)  │  │    │
│                     │  └───────────┘  │    │
│                     └─────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

## Smart Contract Design (Move)

### Data Structures

```move
module deadlist::bounty_board {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::tx_context::{Self, TxContext};

    /// A bounty on a player
    struct Bounty has key, store {
        id: UID,
        poster: address,
        target_player_id: u256,
        reward: Coin<SUI>, // or EVE token
        min_kill_value: u64,
        blacklist: vector<u256>,
        created_at: u64,
        status: u8, // 0=active, 1=claimed, 2=cancelled
    }

    /// Registry of all bounties
    struct BountyBoard has key {
        id: UID,
        bounties: vector<Bounty>,
        claim_history: Table<u256, vector<ClaimRecord>>,
    }

    /// Record of a bounty claim
    struct ClaimRecord has store, drop {
        killer_id: u256,
        victim_id: u256,
        timestamp: u64,
        bounty_id: ID,
    }
}
```

### Core Functions

```move
/// Post a new bounty
public entry fun post_bounty(
    board: &mut BountyBoard,
    target_player_id: u256,
    reward: Coin<SUI>,
    min_kill_value: u64,
    blacklist: vector<u256>,
    ctx: &mut TxContext
)

/// Claim a bounty after killing target
public entry fun claim_bounty(
    board: &mut BountyBoard,
    bounty_id: ID,
    kill_proof: KillProof, // From EVE World contract
    ctx: &mut TxContext
)

/// Cancel a bounty (poster only)
public entry fun cancel_bounty(
    board: &mut BountyBoard,
    bounty_id: ID,
    ctx: &mut TxContext
)

/// View active bounties on a player
public fun get_bounties_on_player(
    board: &BountyBoard,
    player_id: u256
): vector<&Bounty>
```

### Anti-Farming Verification

```move
/// Check if a claim is valid (not farming)
fun verify_claim(
    board: &BountyBoard,
    bounty: &Bounty,
    kill_proof: &KillProof,
    killer_id: u256,
): bool {
    let victim_id = bounty.target_player_id;

    // Rule 1: Same tribe check
    if (same_tribe(killer_id, victim_id)) {
        return false
    };

    // Rule 2: Recent mutual kills
    if (has_recent_mutual_kills(board, killer_id, victim_id)) {
        return false
    };

    // Rule 3: Blacklist check
    if (vector::contains(&bounty.blacklist, &killer_id)) {
        return false
    };

    // Rule 4: Minimum kill value
    if (kill_proof.value < bounty.min_kill_value) {
        return false
    };

    true
}
```

## Deployment

### Deployed Contract (Sui Testnet - Stillness)
- **Package ID:** `0x5b930f51f93a5dab4dfbe900b93bff29f627c67a1c26ff45bcf993c4ef97f47b`
- **Extension Config:** `0xc7ee1294fb6e5c3e81e3eca7fac9c5c0293c4b2dda1ccf34a663ea2e07e8526a`

---

*Document created: March 29, 2026*
*Project: DEADLIST - The Unfarmable Bounty Board*
*Hackathon: EVE Frontier x Sui 2026*
