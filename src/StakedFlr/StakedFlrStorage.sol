// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;

contract StakedFlrStorage {
    struct UnlockRequest {
        // The timestamp at which the `shareAmount` was requested to be unlocked
        uint startedAt;
        // The amount of shares to burn
        uint shareAmount;
    }

    bytes32 public constant ROLE_WITHDRAW = keccak256("ROLE_WITHDRAW");
    bytes32 public constant ROLE_PAUSE = keccak256("ROLE_PAUSE");
    bytes32 public constant ROLE_RESUME = keccak256("ROLE_RESUME");
    bytes32 public constant ROLE_ACCRUE_REWARDS =
        keccak256("ROLE_ACCRUE_REWARDS");
    bytes32 public constant ROLE_DEPOSIT = keccak256("ROLE_DEPOSIT");
    bytes32 public constant ROLE_PAUSE_MINTING =
        keccak256("ROLE_PAUSE_MINTING");
    bytes32 public constant ROLE_RESUME_MINTING =
        keccak256("ROLE_RESUME_MINTING");
    bytes32 public constant ROLE_SET_TOTAL_POOLED_FLR_CAP =
        keccak256("ROLE_SET_TOTAL_POOLED_FLR_CAP");

    // The total amount of FLR controlled by the contract
    uint public totalPooledFlr;

    // The total number of sFLR shares
    uint public totalShares;

    /**
     * @dev sFLR balances are dynamic and are calculated based on the accounts' shares
     * and the total amount of FLR controlled by the protocol. Account shares aren't
     * normalized, so the contract also stores the sum of all shares to calculate
     * each account's token balance which equals to:
     *
     * shares[account] * totalPooledFlr / totalShares
     */
    mapping(address => uint256) internal shares;

    // Allowances are nominated in tokens, not token shares.
    mapping(address => mapping(address => uint256)) internal allowances;

    // The time that has to elapse before all sFLR can be converted into FLR
    uint public cooldownPeriod;

    // The time window within which the unlocked FLR has to be redeemed after the cooldown
    uint public redeemPeriod;

    // User-specific details of requested FLR unlocks
    mapping(address => UnlockRequest[]) public userUnlockRequests;

    // Amount of users' sFLR custodied by the contract
    mapping(address => uint) public userSharesInCustody;

    // Exchange rate by timestamp. Updated on delegation reward accrual.
    mapping(uint => uint) public historicalExchangeRatesByTimestamp;

    // An ordered list of `historicalExchangeRates` keys
    uint[] public historicalExchangeRateTimestamps;

    // Set if minting has been paused
    bool public mintingPaused;

    // The maximum amount of FLR that can be held by the protocol
    uint public totalPooledFlrCap;

    // Number of wallets which have sFLR
    uint public stakerCount;

    // The percentage of accrued rewards that are paid to the protocol. 0-1e18 for 0-100 %.
    uint public protocolRewardShare;

    // Recipient address of the protocol rewards
    address payable public protocolRewardShareRecipient;

    // preventTransfer  - not used
    bool internal _preventTransfer;
}
