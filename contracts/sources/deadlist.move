/// DEADLIST - The Unfarmable Bounty Board for EVE Frontier
///
/// A trustless bounty system that prevents farming through on-chain verification.
/// Key features:
/// - Full bounty payout (100% to killer)
/// - Anti-farming rules enforced by smart contract
/// - No expiration - bounties persist until claimed or cancelled
/// - On-chain escrow for trustless operation
module deadlist::bounty_board {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use sui::event;
    use sui::clock::{Self, Clock};

    // NOTE: In production on EVE Frontier mainnet, this would use EVE tokens:
    // use 0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60::EVE::EVE;
    // For testnet demo, we use SUI as a stand-in for EVE tokens

    // ============ Error Codes ============

    /// Bounty not found
    const EBountyNotFound: u64 = 0;
    /// Not authorized to perform this action
    const ENotAuthorized: u64 = 1;
    /// Bounty is not active
    const EBountyNotActive: u64 = 2;
    /// Anti-farming check failed: Same tribe
    const ESameTribe: u64 = 3;
    /// Anti-farming check failed: Recent mutual kills detected
    const EMutualKillsDetected: u64 = 4;
    /// Anti-farming check failed: Killer is blacklisted
    const EKillerBlacklisted: u64 = 5;
    /// Anti-farming check failed: Kill value below minimum
    const EKillValueTooLow: u64 = 6;
    /// Invalid kill proof
    const EInvalidKillProof: u64 = 7;
    /// Reward amount must be greater than zero
    const EZeroReward: u64 = 8;

    // ============ Status Constants ============

    const STATUS_ACTIVE: u8 = 0;
    const STATUS_CLAIMED: u8 = 1;
    const STATUS_CANCELLED: u8 = 2;

    // ============ Anti-Farming Configuration ============

    /// Time window for mutual kill detection (in milliseconds)
    /// Default: 7 days = 7 * 24 * 60 * 60 * 1000
    const MUTUAL_KILL_WINDOW_MS: u64 = 604800000;

    /// Maximum number of mutual kills allowed within the window
    const MAX_MUTUAL_KILLS: u64 = 2;

    // ============ Data Structures ============

    /// A bounty placed on a player
    public struct Bounty has key, store {
        id: UID,
        /// Address of the player who posted this bounty
        poster: address,
        /// EVE Frontier player ID of the target
        target_player_id: u256,
        /// The reward held in escrow (EVE tokens)
        reward: Coin<SUI>,
        /// Minimum kill value required to claim (prevents cheap ship farming)
        min_kill_value: u64,
        /// List of player IDs excluded from claiming this bounty
        blacklist: vector<u256>,
        /// Timestamp when bounty was created (ms since epoch)
        created_at: u64,
        /// Current status: 0=active, 1=claimed, 2=cancelled
        status: u8,
    }

    /// The main bounty board - a shared object containing all bounties
    public struct BountyBoard has key {
        id: UID,
        /// Counter for total bounties ever created
        total_bounties: u64,
        /// Active bounty count
        active_bounties: u64,
        /// Mapping from target player ID to list of bounty IDs targeting them
        bounties_by_target: Table<u256, vector<ID>>,
        /// Kill history for anti-farming: maps "killer_id:victim_id" hash to timestamps
        kill_history: Table<u256, vector<u64>>,
    }

    /// Record of a successful bounty claim
    public struct ClaimRecord has store, drop, copy {
        /// EVE Frontier player ID of the killer
        killer_id: u256,
        /// EVE Frontier player ID of the victim
        victim_id: u256,
        /// Timestamp of the claim
        timestamp: u64,
        /// ID of the bounty that was claimed
        bounty_id: ID,
        /// Amount paid out
        payout_amount: u64,
    }

    /// Proof of a kill from EVE Frontier's world contract
    /// This is a placeholder structure - will be replaced with actual EVE Frontier interfaces
    public struct KillProof has drop {
        /// EVE Frontier player ID of the killer
        killer_id: u256,
        /// EVE Frontier player ID of the victim
        victim_id: u256,
        /// Value of the ship/assets destroyed
        kill_value: u64,
        /// Solar system where kill occurred
        solar_system_id: u64,
        /// Timestamp of the kill
        timestamp: u64,
        /// Proof signature or verification hash (placeholder)
        proof_hash: vector<u8>,
    }

    // ============ Events ============

    /// Emitted when a new bounty is posted
    public struct BountyPosted has copy, drop {
        bounty_id: ID,
        poster: address,
        target_player_id: u256,
        reward_amount: u64,
        min_kill_value: u64,
    }

    /// Emitted when a bounty is successfully claimed
    public struct BountyClaimed has copy, drop {
        bounty_id: ID,
        target_player_id: u256,
        killer_id: u256,
        killer_address: address,
        reward_amount: u64,
        kill_value: u64,
    }

    /// Emitted when a bounty is cancelled
    public struct BountyCancelled has copy, drop {
        bounty_id: ID,
        poster: address,
        target_player_id: u256,
        refund_amount: u64,
    }

    /// Emitted when a claim is rejected due to anti-farming rules
    public struct ClaimRejected has copy, drop {
        bounty_id: ID,
        killer_id: u256,
        reason: u8, // Maps to error codes
    }

    // ============ Initialization ============

    /// Create and share the bounty board (called once on module publish)
    fun init(ctx: &mut TxContext) {
        let board = BountyBoard {
            id: object::new(ctx),
            total_bounties: 0,
            active_bounties: 0,
            bounties_by_target: table::new(ctx),
            kill_history: table::new(ctx),
        };
        transfer::share_object(board);
    }

    // ============ Core Functions ============

    /// Post a new bounty on a target player
    ///
    /// Arguments:
    /// - board: The shared BountyBoard object
    /// - target_player_id: EVE Frontier player ID of the target
    /// - reward: SUI tokens to be held in escrow as the bounty reward
    /// - min_kill_value: Minimum value of the kill required to claim (0 for no minimum)
    /// - blacklist: List of player IDs who cannot claim this bounty
    /// - clock: Sui Clock for timestamp
    /// - ctx: Transaction context
    public entry fun post_bounty(
        board: &mut BountyBoard,
        target_player_id: u256,
        reward: Coin<SUI>,
        min_kill_value: u64,
        blacklist: vector<u256>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let reward_amount = coin::value(&reward);
        assert!(reward_amount > 0, EZeroReward);

        let bounty_uid = object::new(ctx);
        let bounty_id = object::uid_to_inner(&bounty_uid);
        let poster = tx_context::sender(ctx);
        let created_at = clock::timestamp_ms(clock);

        let bounty = Bounty {
            id: bounty_uid,
            poster,
            target_player_id,
            reward,
            min_kill_value,
            blacklist,
            created_at,
            status: STATUS_ACTIVE,
        };

        // Add to target's bounty list
        if (!table::contains(&board.bounties_by_target, target_player_id)) {
            table::add(&mut board.bounties_by_target, target_player_id, vector::empty<ID>());
        };
        let target_bounties = table::borrow_mut(&mut board.bounties_by_target, target_player_id);
        vector::push_back(target_bounties, bounty_id);

        // Update counters
        board.total_bounties = board.total_bounties + 1;
        board.active_bounties = board.active_bounties + 1;

        // Emit event
        event::emit(BountyPosted {
            bounty_id,
            poster,
            target_player_id,
            reward_amount,
            min_kill_value,
        });

        // Transfer bounty object to shared board (store in dynamic field or similar pattern)
        // For this implementation, we transfer the bounty as a shared object
        transfer::share_object(bounty);
    }

    /// Claim a bounty after killing the target
    ///
    /// Arguments:
    /// - board: The shared BountyBoard object
    /// - bounty: The bounty being claimed
    /// - killer_id: EVE Frontier player ID of the claimer
    /// - kill_value: Value of the kill
    /// - kill_timestamp: When the kill occurred
    /// - proof_hash: Verification hash from EVE Frontier (placeholder)
    /// - clock: Sui Clock for timestamp
    /// - ctx: Transaction context
    public entry fun claim_bounty(
        board: &mut BountyBoard,
        bounty: &mut Bounty,
        killer_id: u256,
        kill_value: u64,
        kill_timestamp: u64,
        proof_hash: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Verify bounty is active
        assert!(bounty.status == STATUS_ACTIVE, EBountyNotActive);

        let bounty_id = object::uid_to_inner(&bounty.id);
        let victim_id = bounty.target_player_id;

        // Create kill proof (in production, this would come from EVE Frontier)
        let kill_proof = KillProof {
            killer_id,
            victim_id,
            kill_value,
            solar_system_id: 0, // Placeholder
            timestamp: kill_timestamp,
            proof_hash,
        };

        // Verify the kill proof (placeholder - will integrate with EVE Frontier)
        assert!(verify_kill_proof(&kill_proof), EInvalidKillProof);

        // Run all anti-farming checks
        let (valid, rejection_reason) = verify_claim_internal(
            board,
            bounty,
            &kill_proof,
            killer_id,
            clock
        );

        if (!valid) {
            // Emit rejection event
            event::emit(ClaimRejected {
                bounty_id,
                killer_id,
                reason: rejection_reason,
            });

            // Abort with specific error
            if (rejection_reason == 3) {
                abort ESameTribe
            } else if (rejection_reason == 4) {
                abort EMutualKillsDetected
            } else if (rejection_reason == 5) {
                abort EKillerBlacklisted
            } else {
                abort EKillValueTooLow
            };
        };

        // All checks passed - pay out the bounty
        let reward_amount = coin::value(&bounty.reward);
        let payout = coin::split(&mut bounty.reward, reward_amount, ctx);

        // Update bounty status
        bounty.status = STATUS_CLAIMED;
        board.active_bounties = board.active_bounties - 1;

        // Record the kill in history for future anti-farming checks
        record_kill(board, killer_id, victim_id, clock::timestamp_ms(clock));

        // Emit claim event
        event::emit(BountyClaimed {
            bounty_id,
            target_player_id: victim_id,
            killer_id,
            killer_address: tx_context::sender(ctx),
            reward_amount,
            kill_value,
        });

        // Transfer reward to claimer
        transfer::public_transfer(payout, tx_context::sender(ctx));
    }

    /// Cancel a bounty and refund the poster
    ///
    /// Only the original poster can cancel their bounty.
    ///
    /// Arguments:
    /// - board: The shared BountyBoard object
    /// - bounty: The bounty to cancel
    /// - ctx: Transaction context
    public entry fun cancel_bounty(
        board: &mut BountyBoard,
        bounty: &mut Bounty,
        ctx: &mut TxContext
    ) {
        // Verify caller is the poster
        assert!(bounty.poster == tx_context::sender(ctx), ENotAuthorized);

        // Verify bounty is active
        assert!(bounty.status == STATUS_ACTIVE, EBountyNotActive);

        let bounty_id = object::uid_to_inner(&bounty.id);
        let refund_amount = coin::value(&bounty.reward);

        // Extract and refund the reward
        let refund = coin::split(&mut bounty.reward, refund_amount, ctx);

        // Update status
        bounty.status = STATUS_CANCELLED;
        board.active_bounties = board.active_bounties - 1;

        // Emit cancellation event
        event::emit(BountyCancelled {
            bounty_id,
            poster: bounty.poster,
            target_player_id: bounty.target_player_id,
            refund_amount,
        });

        // Transfer refund to poster
        transfer::public_transfer(refund, bounty.poster);
    }

    // ============ View Functions ============

    /// Get all bounty IDs targeting a specific player
    public fun get_bounty_ids_on_player(
        board: &BountyBoard,
        player_id: u256
    ): vector<ID> {
        if (table::contains(&board.bounties_by_target, player_id)) {
            *table::borrow(&board.bounties_by_target, player_id)
        } else {
            vector::empty<ID>()
        }
    }

    /// Get bounty details
    public fun get_bounty_info(bounty: &Bounty): (address, u256, u64, u64, u64, u8) {
        (
            bounty.poster,
            bounty.target_player_id,
            coin::value(&bounty.reward),
            bounty.min_kill_value,
            bounty.created_at,
            bounty.status
        )
    }

    /// Check if a player is on a bounty's blacklist
    public fun is_blacklisted(bounty: &Bounty, player_id: u256): bool {
        vector::contains(&bounty.blacklist, &player_id)
    }

    /// Get total bounty count
    public fun get_total_bounties(board: &BountyBoard): u64 {
        board.total_bounties
    }

    /// Get active bounty count
    public fun get_active_bounties(board: &BountyBoard): u64 {
        board.active_bounties
    }

    /// Check if bounty is active
    public fun is_bounty_active(bounty: &Bounty): bool {
        bounty.status == STATUS_ACTIVE
    }

    // ============ Anti-Farming Verification ============

    /// Internal verification of a bounty claim
    /// Returns (is_valid, rejection_reason)
    fun verify_claim_internal(
        board: &BountyBoard,
        bounty: &Bounty,
        kill_proof: &KillProof,
        killer_id: u256,
        clock: &Clock
    ): (bool, u8) {
        let victim_id = bounty.target_player_id;

        // Rule 1: Same tribe check
        if (check_same_tribe(killer_id, victim_id)) {
            return (false, 3) // ESameTribe
        };

        // Rule 2: Recent mutual kills
        if (has_recent_mutual_kills(board, killer_id, victim_id, clock)) {
            return (false, 4) // EMutualKillsDetected
        };

        // Rule 3: Blacklist check
        if (vector::contains(&bounty.blacklist, &killer_id)) {
            return (false, 5) // EKillerBlacklisted
        };

        // Rule 4: Minimum kill value
        if (kill_proof.kill_value < bounty.min_kill_value) {
            return (false, 6) // EKillValueTooLow
        };

        (true, 0)
    }

    /// Check if two players are in the same tribe
    /// PLACEHOLDER: This will integrate with EVE Frontier's tribe system
    fun check_same_tribe(player_a: u256, player_b: u256): bool {
        // TODO: Integrate with EVE Frontier World Contract
        // This should query the on-chain tribe membership data
        // For now, return false (no tribal check)

        // Placeholder implementation - will be replaced with actual EVE Frontier API call
        // Example of what this might look like:
        // let tribe_a = eve_world::get_player_tribe(player_a);
        // let tribe_b = eve_world::get_player_tribe(player_b);
        // tribe_a == tribe_b && tribe_a != 0

        let _ = player_a;
        let _ = player_b;
        false
    }

    /// Check for recent mutual kills between two players
    /// This detects potential farming patterns where two players repeatedly kill each other
    fun has_recent_mutual_kills(
        board: &BountyBoard,
        killer_id: u256,
        victim_id: u256,
        clock: &Clock
    ): bool {
        let current_time = clock::timestamp_ms(clock);
        let window_start = if (current_time > MUTUAL_KILL_WINDOW_MS) {
            current_time - MUTUAL_KILL_WINDOW_MS
        } else {
            0
        };

        // Check kills from killer -> victim
        let forward_key = compute_kill_pair_key(killer_id, victim_id);
        let forward_count = count_recent_kills(board, forward_key, window_start);

        // Check kills from victim -> killer (reverse direction)
        let reverse_key = compute_kill_pair_key(victim_id, killer_id);
        let reverse_count = count_recent_kills(board, reverse_key, window_start);

        // If there are kills in both directions recently, it's suspicious
        // Or if the same pair has too many kills in one direction
        (forward_count > 0 && reverse_count > 0) ||
        (forward_count >= MAX_MUTUAL_KILLS) ||
        (reverse_count >= MAX_MUTUAL_KILLS)
    }

    /// Count recent kills for a specific killer-victim pair
    fun count_recent_kills(
        board: &BountyBoard,
        pair_key: u256,
        window_start: u64
    ): u64 {
        if (!table::contains(&board.kill_history, pair_key)) {
            return 0
        };

        let timestamps = table::borrow(&board.kill_history, pair_key);
        let mut count = 0u64;
        let mut i = 0u64;
        let len = vector::length(timestamps);

        while (i < len) {
            let ts = *vector::borrow(timestamps, i);
            if (ts >= window_start) {
                count = count + 1;
            };
            i = i + 1;
        };

        count
    }

    /// Record a kill in the history for anti-farming detection
    fun record_kill(
        board: &mut BountyBoard,
        killer_id: u256,
        victim_id: u256,
        timestamp: u64
    ) {
        let pair_key = compute_kill_pair_key(killer_id, victim_id);

        if (!table::contains(&board.kill_history, pair_key)) {
            table::add(&mut board.kill_history, pair_key, vector::empty<u64>());
        };

        let timestamps = table::borrow_mut(&mut board.kill_history, pair_key);
        vector::push_back(timestamps, timestamp);

        // Optional: Prune old entries to prevent unbounded growth
        // This could be done periodically or when the vector gets too large
    }

    /// Compute a unique key for a killer-victim pair
    /// Uses simple combination to create unique identifier
    fun compute_kill_pair_key(killer_id: u256, victim_id: u256): u256 {
        // XOR with shift to ensure (A,B) != (B,A)
        (killer_id << 128) ^ victim_id
    }

    /// Verify kill proof from EVE Frontier
    /// PLACEHOLDER: This will integrate with EVE Frontier's kill verification system
    fun verify_kill_proof(kill_proof: &KillProof): bool {
        // TODO: Integrate with EVE Frontier World Contract
        // This should verify:
        // 1. The kill actually occurred on-chain
        // 2. The proof_hash matches expected value
        // 3. The kill is not already claimed for another bounty

        // Placeholder implementation - will be replaced with actual verification
        // Example of what this might look like:
        // eve_world::verify_kill(
        //     kill_proof.killer_id,
        //     kill_proof.victim_id,
        //     kill_proof.timestamp,
        //     kill_proof.proof_hash
        // )

        // For now, basic sanity checks
        kill_proof.killer_id != kill_proof.victim_id &&
        kill_proof.kill_value > 0 &&
        vector::length(&kill_proof.proof_hash) > 0
    }

    // ============ Admin Functions ============

    /// Admin capability for contract management
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Create admin capability (called during init)
    fun create_admin_cap(ctx: &mut TxContext): AdminCap {
        AdminCap {
            id: object::new(ctx),
        }
    }

    // ============ Test Helpers ============

    #[test_only]
    /// Initialize for testing
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    /// Create a test kill proof
    public fun create_test_kill_proof(
        killer_id: u256,
        victim_id: u256,
        kill_value: u64,
        timestamp: u64
    ): KillProof {
        KillProof {
            killer_id,
            victim_id,
            kill_value,
            solar_system_id: 1,
            timestamp,
            proof_hash: b"test_proof",
        }
    }
}
