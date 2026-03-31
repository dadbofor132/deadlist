# DEADLIST Frontend

The Unfarmable Bounty Board for EVE Frontier.

## Quick Start

Simply open `index.html` in a browser. No build step required.

```bash
# Option 1: Direct file
open index.html

# Option 2: Simple HTTP server (recommended for development)
npx serve .

# Option 3: Python server
python -m http.server 8000
```

## Features

- **Browse Bounties**: View all active bounties with search and filters
- **Post Bounty**: Create new bounties with anti-farming protection
- **Leaderboard**: Top hunters and most wanted targets
- **My Bounties**: Manage bounties you've posted (requires wallet)
- **Wallet Integration**: Connect Sui wallet (simulated for demo)

## Tech Stack

- Vanilla HTML/CSS/JavaScript (no build step)
- Tailwind CSS via CDN
- Custom fonts: Orbitron, Rajdhani, Share Tech Mono

## Files

```
frontend/
├── index.html     # Main HTML structure
├── styles.css     # Custom CSS animations and theming
├── app.js         # JavaScript application logic
├── favicon.svg    # Site favicon
└── README.md      # This file
```

## Design System

### Colors
- `eve-accent`: #ff4444 (Red - danger/bounty)
- `eve-accent-orange`: #ff6a00 (Orange - rewards)
- `eve-accent-gold`: #ffd700 (Gold - high value)
- `eve-cyan`: #00d4ff (Cyan - UI accents)
- `eve-green`: #00ff88 (Green - success)
- `eve-purple`: #8b5cf6 (Purple - special)

### Typography
- **Orbitron**: Headers, numbers, emphasis
- **Rajdhani**: Body text, UI elements
- **Share Tech Mono**: Code, addresses, IDs

## Demo Notes

The frontend uses mock data for demonstration. In production:
- Connect to Sui blockchain via wallet adapter
- Read bounty data from smart contract
- Submit transactions for posting/claiming/cancelling

## Hackathon

EVE Frontier x Sui Hackathon 2026
Theme: "A Toolkit for Civilization"
