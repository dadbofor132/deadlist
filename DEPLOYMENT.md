# DEADLIST Deployment Guide

## Prerequisites

### Required Software

1. **Sui CLI** - Install from https://docs.sui.io/guides/developer/getting-started/sui-install
   ```bash
   # macOS/Linux
   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui

   # Or using Homebrew (macOS)
   brew install sui
   ```

2. **Node.js 18+** - For frontend development
   ```bash
   # Using nvm (recommended)
   nvm install 18
   nvm use 18
   ```

3. **Sui Wallet** - Browser extension for transactions
   - Install from https://chromewebstore.google.com/detail/sui-wallet

---

## Step 1: Set Up Sui Wallet

1. Open Sui Wallet extension
2. Create new wallet or import existing
3. **Switch to Testnet** (for testing) or Mainnet (for Stillness deployment)
4. Get testnet SUI from faucet: https://discord.gg/sui (use #testnet-faucet channel)

---

## Step 2: Configure Sui CLI

```bash
# Check installation
sui --version

# Create new address (if needed)
sui client new-address ed25519

# Switch to testnet
sui client switch --env testnet

# View your address
sui client active-address

# Check balance
sui client gas
```

---

## Step 3: Deploy Smart Contract

### Navigate to Contract Directory
```bash
cd contracts
```

### Build the Contract
```bash
sui move build
```

If successful, you'll see:
```
BUILDING deadlist
Build Successful
```

### Deploy to Testnet
```bash
sui client publish --gas-budget 100000000
```

**Save the output!** You'll need:
- **Package ID**: The deployed contract address
- **BountyBoard Object ID**: The shared object for all bounties

Example output:
```
----- Object changes ----
Published Objects:
  PackageID: 0x1234...
Created Objects:
  ObjectID: 0x5678... (BountyBoard)
```

### Update Frontend with Contract Address
Edit `frontend/app.js` and replace the placeholder:
```javascript
const CONTRACT_CONFIG = {
    packageId: 'YOUR_PACKAGE_ID_HERE',  // Replace with actual
    bountyBoardId: 'YOUR_BOARD_ID_HERE' // Replace with actual
};
```

---

## Step 4: Run Frontend Locally

### Navigate to Frontend Directory
```bash
cd frontend
```

### Option A: Python Simple Server
```bash
python3 -m http.server 8080
```

### Option B: Node.js serve
```bash
npx serve -l 8080
```

### Option C: Live Server (VS Code)
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

### Access the App
Open browser: http://localhost:8080

---

## Step 5: Deploy Frontend (For Submission)

### Option A: Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel

# Follow prompts, get URL like: https://deadlist.vercel.app
```

### Option B: Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
cd frontend
netlify deploy --prod

# Get URL like: https://deadlist.netlify.app
```

### Option C: GitHub Pages
1. Create GitHub repo
2. Push frontend folder
3. Enable Pages in repo settings
4. Access at: https://yourusername.github.io/deadlist

---

## Step 6: Test the Application

### Test Flow (UI Demo)
1. Open frontend in browser
2. Click "Connect Wallet" (simulated in demo)
3. Browse bounties on homepage
4. Click "Post Bounty" to add new bounty
5. View leaderboard
6. Check "My Bounties" section

### Test Flow (On-Chain)
1. Connect Sui Wallet to app
2. Post a bounty with real SUI
3. Have another player kill the target
4. Claim the bounty
5. Verify payout in wallet

---

## Stillness (Live Game) Deployment

### For Live Frontier Integration Category

1. **Get Stillness Access**
   - Purchase EVE Frontier game
   - Join the Stillness server

2. **Update Contract for EVE Integration**
   - Research EVE Frontier's World Contract addresses
   - Update `check_same_tribe()` function with real tribe data
   - Update `verify_kill_proof()` with actual kill verification

3. **Deploy to Sui Mainnet**
   ```bash
   sui client switch --env mainnet
   sui client publish --gas-budget 100000000
   ```

4. **Test with Real Players**
   - Coordinate with other players
   - Place real bounty on volunteer
   - Record kill and claim
   - Capture for demo video

---

## Troubleshooting

### "Insufficient gas" error
```bash
# Get more testnet SUI
# Join Sui Discord and use #testnet-faucet
```

### "Module verification failed"
```bash
# Clean and rebuild
sui move clean
sui move build
```

### "Object not found"
- Ensure you're on the correct network (testnet vs mainnet)
- Verify the object ID is correct

### Frontend not connecting to wallet
- Ensure Sui Wallet extension is installed
- Check browser console for errors
- Try refreshing page

---

## Quick Reference

| Item | Value |
|------|-------|
| Contract Location | `contracts/sources/deadlist.move` |
| Frontend Location | `frontend/` |
| Testnet Faucet | Sui Discord #testnet-faucet |
| Sui Explorer | https://suiexplorer.com |
| Move Docs | https://move-book.com |

---

## File Structure

```
eve hackathon/
├── contracts/
│   ├── Move.toml           # Package config
│   └── sources/
│       └── deadlist.move   # Smart contract
├── frontend/
│   ├── index.html          # Main HTML
│   ├── styles.css          # Styles
│   ├── app.js              # Application logic
│   ├── favicon.svg         # Icon
│   └── README.md           # Frontend docs
├── PROJECT_DOCUMENTATION.md # Full research & design
├── DEPLOYMENT.md           # This file
├── SUBMISSION.md           # Hackathon submission
└── DEMO_SCRIPT.md          # Video script
```

---

*Last updated: March 29, 2026*
