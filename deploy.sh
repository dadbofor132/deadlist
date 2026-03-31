#!/bin/bash

# DEADLIST Deployment Script
# EVE Frontier x Sui Hackathon 2026

set -e

echo "=========================================="
echo "DEADLIST - Deployment Script"
echo "=========================================="

# Check for Sui CLI
if ! command -v sui &> /dev/null; then
    echo "ERROR: Sui CLI not found"
    echo "Install with: cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui"
    exit 1
fi

echo "Sui CLI version: $(sui --version)"

# Navigate to contracts directory
cd "$(dirname "$0")/contracts"

echo ""
echo "Step 1: Building Move contract..."
echo "------------------------------------------"
sui move build

if [ $? -ne 0 ]; then
    echo "ERROR: Build failed"
    exit 1
fi

echo ""
echo "Build successful!"

echo ""
echo "Step 2: Deploying to network..."
echo "------------------------------------------"
echo "Network: $(sui client active-env)"
echo "Address: $(sui client active-address)"
echo ""

read -p "Deploy to this network? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "Deploying contract..."
DEPLOY_OUTPUT=$(sui client publish --gas-budget 100000000 --json 2>&1)

# Extract package ID and object IDs
PACKAGE_ID=$(echo "$DEPLOY_OUTPUT" | grep -o '"packageId": "[^"]*"' | head -1 | cut -d'"' -f4)
BOARD_ID=$(echo "$DEPLOY_OUTPUT" | grep -o '"objectId": "[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PACKAGE_ID" ]; then
    echo "ERROR: Could not extract Package ID"
    echo "Full output:"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo ""
echo "=========================================="
echo "DEPLOYMENT SUCCESSFUL!"
echo "=========================================="
echo ""
echo "Package ID:      $PACKAGE_ID"
echo "BountyBoard ID:  $BOARD_ID"
echo ""
echo "Update frontend/app.js CONFIG section:"
echo ""
echo "  PACKAGE_ID: '$PACKAGE_ID',"
echo "  BOUNTY_BOARD_ID: '$BOARD_ID',"
echo ""
echo "=========================================="

# Optionally update the config file
read -p "Automatically update frontend config? (y/n): " update_config
if [ "$update_config" == "y" ]; then
    cd ../frontend
    sed -i "s/PACKAGE_ID: '0x[^']*'/PACKAGE_ID: '$PACKAGE_ID'/" app.js
    sed -i "s/BOUNTY_BOARD_ID: '0x[^']*'/BOUNTY_BOARD_ID: '$BOARD_ID'/" app.js
    echo "Frontend config updated!"
fi

echo ""
echo "Done! Run the frontend with:"
echo "  cd frontend && python3 -m http.server 8080"
echo ""
