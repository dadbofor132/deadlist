# DEADLIST - The Unfarmable Bounty Board

**EVE Frontier x Sui Hackathon 2026**

A decentralized bounty hunting system for EVE Frontier, built on Sui blockchain.

## Overview

DEADLIST lets players post bounties on other players with real SUI tokens held in escrow. When a hunter eliminates the target and deposits proof at a Bounty Terminal (SSU), they claim the reward automatically.

## Features

- **Post Bounties** - Lock SUI in escrow, target any EVE Frontier character by name
- **View Active Bounties** - Real-time bounty board loaded from blockchain
- **Cancel Bounties** - Get your SUI back if you change your mind
- **Claim Bounties** - Deposit corpse proof at Bounty Terminal to collect rewards

## Tech Stack

- **Blockchain**: Sui (Move smart contracts)
- **Frontend**: Vanilla JS with Sui Wallet Standard
- **Integration**: EVE Frontier World Contracts (Characters, SSUs)

## Smart Contract

Deployed on Sui Testnet (Stillness):
- Package ID: `0x5b930f51f93a5dab4dfbe900b93bff29f627c67a1c26ff45bcf993c4ef97f47b`
- Extension Config: `0xc7ee1294fb6e5c3e81e3eca7fac9c5c0293c4b2dda1ccf34a663ea2e07e8526a`

## How It Works

1. **Poster** searches for a target character and posts a bounty with SUI
2. **SUI** is locked in the smart contract's escrow
3. **Hunter** kills the target in EVE Frontier
4. **Hunter** deposits corpse at the Bounty Terminal SSU
5. **Contract** verifies proof and releases SUI to the hunter

## Running Locally

```bash
cd frontend
python -m http.server 8000
```

Then open http://localhost:8000 in your browser or EVE Frontier's in-game dApp browser.

## In-Game Integration

The dApp works inside EVE Frontier's in-game browser:
1. Open the dApp browser in-game
2. Navigate to your hosted URL
3. Connect your EVE Vault wallet
4. Post, view, and manage bounties directly in-game

## License

MIT
