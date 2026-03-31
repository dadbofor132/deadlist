# DEADLIST Demo Video Script

## Video Length Target: 3-5 minutes

---

## INTRO (0:00 - 0:30)

### Visual
- Start with EVE Online logo fading to EVE Frontier logo
- Text overlay: "20 Years of Broken Bounties"

### Script
> "For 20 years, EVE Online players wanted one thing: a bounty system that actually works. CCP tried. They failed. In 2020, they gave up entirely and disabled bounties."
>
> "Today, we're showing you DEADLIST - the unfarmable bounty board built for EVE Frontier."

---

## THE PROBLEM (0:30 - 1:30)

### Visual
- Show old EVE Online bounty UI screenshots
- Animated diagram of farming exploit
- Timeline: 2003 → 2012 → 2020

### Script
> "The problem was always simple: friends kill friends to steal the bounty."
>
> [Show diagram]
> "Step 1: Someone places a bounty on you. Step 2: Your friend kills you in a cheap ship. Step 3: You split the payout. Congratulations, you just robbed the bounty poster."
>
> "CCP tried fixing it - they changed payouts to 20% of ship value. But players just used cheaper ships. The exploit never stopped."
>
> "The real problem? In a centralized system, you can't prove two players aren't friends. You can't verify relationships at scale. You can't enforce rules that players can't social-engineer around."

---

## THE SOLUTION (1:30 - 2:30)

### Visual
- DEADLIST logo animation
- Architecture diagram
- UI walkthrough

### Script
> "DEADLIST changes everything by using blockchain's unique properties."
>
> [Show architecture]
> "Every kill in EVE Frontier is recorded on-chain. Tribe membership is verifiable. Kill history is queryable. This gives us something CCP never had: proof."
>
> [Show anti-farming rules]
> "DEADLIST enforces four anti-farming rules:"
> "One: Same tribe? Denied."
> "Two: Killed each other recently? Denied."
> "Three: On the poster's blacklist? Denied."
> "Four: Ship worth less than minimum? Denied."
>
> "These rules are enforced by smart contract code - not game masters. You can't sweet-talk your way around them."

---

## THE DEMO (2:30 - 4:00)

### Visual
- Screen recording of DEADLIST UI
- Wallet connection
- Posting a bounty
- Viewing bounties
- Claiming flow

### Script
> "Let me show you how it works."
>
> [Show homepage]
> "This is the DEADLIST board. Every active bounty in the game, transparent and verifiable."
>
> [Click Post Bounty]
> "To post a bounty, you deposit real tokens into escrow. This goes into a smart contract - not a database we control. You pick your target, set a minimum ship value, and optionally blacklist anyone you don't want claiming."
>
> [Show bounty details]
> "Hunters can see everything: the target, the reward, the requirements. No hidden catches."
>
> [Show claim flow]
> "When a hunter makes a kill, the contract automatically checks: Are you in the same tribe? Have you killed each other before? Are you blacklisted? Is the kill valuable enough?"
>
> "All checks pass? The bounty is released instantly to the hunter's wallet. No middleman. No delay. No appeals."
>
> [Show leaderboard]
> "We track the most wanted targets and top hunters. This creates a real bounty hunter profession - something EVE players have wanted forever."

---

## THE TECH (4:00 - 4:30)

### Visual
- Code snippets
- Move logo
- Sui logo

### Script
> "Under the hood, DEADLIST is built on Sui using Move - the same blockchain EVE Frontier migrated to in March 2026."
>
> [Show code snippet]
> "The entire anti-farming logic is on-chain. The contract handles escrow, verification, and payout in a single atomic transaction."
>
> "No off-chain components that can be manipulated. No admin keys. Pure code."

---

## CLOSING (4:30 - 5:00)

### Visual
- DEADLIST logo
- EVE Frontier + Sui logos
- Hackathon branding

### Script
> "For 20 years, players asked for a bounty system that works. CCP said it was impossible."
>
> "Blockchain makes it possible. DEADLIST makes it real."
>
> "Thank you for watching. DEADLIST - the bounty system EVE always needed."

---

## RECORDING CHECKLIST

### Before Recording
- [ ] Frontend deployed and accessible
- [ ] Wallet connected with test SUI
- [ ] Sample bounties loaded
- [ ] Screen recording software ready (OBS, Loom, etc.)
- [ ] Microphone tested

### Shots to Capture
- [ ] Homepage with bounty list
- [ ] Post Bounty modal
- [ ] Bounty details view
- [ ] Wallet connection flow
- [ ] Leaderboard page
- [ ] My Bounties section
- [ ] Mobile responsive view (optional)

### Optional Shots (If Time)
- [ ] Contract code in IDE
- [ ] Terminal showing deployment
- [ ] Sui Explorer showing transaction
- [ ] In-game footage (if playing EVE Frontier)

---

## TIPS

1. **Keep it moving** - Don't linger on any screen too long
2. **Show, don't just tell** - Every claim should have visual proof
3. **Lead with the problem** - Make viewers feel the pain first
4. **End strong** - The closing line should be memorable
5. **Background music** - Subtle space/EVE-style ambient

---

## OPTIONAL B-ROLL

- EVE Frontier gameplay footage
- Space visuals / nebulae
- Blockchain visualization (nodes, transactions)
- Old EVE Online bounty hunting videos

---

*Script prepared: March 29, 2026*
