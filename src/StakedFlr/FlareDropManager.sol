// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "./FlareDropManagerStorage.sol";
import "./StakedFlr.sol";

contract FlareDropManager is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    FlareDropManagerStorage
{
    using SafeMathUpgradeable for uint;

    event FlareDropScheduled(uint indexed day, uint userAmount, uint protocolAmount);
    event DailyDropExecuted(uint userAmount, uint protocolAmount, uint remainingDrops);

    /**
     * @notice Initialize the FlareDropManager contract
     * @param _stakedFlr Address of the StakedFlr contract
     */
    function initialize(
        address payable _stakedFlr
    ) public initializer {
        stakedFlr = StakedFlr(_stakedFlr);

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ROLE_SCHEDULE_DROP, msg.sender);
    }

    /**
     * @notice Method to deposit FLR with flare drop
     */
    function depositFlareDrop() external payable whenNotPaused nonReentrant {
         _handleFlareDrop(msg.value);
    }

    /**
     * @notice Method to submit FLR with flare drop by sending FLR directly to the contract
     */
    function submit() external payable whenNotPaused nonReentrant {
        _handleFlareDrop(msg.value);
    }


    function _handleFlareDrop(uint amount) internal {
        require(hasRole(ROLE_SCHEDULE_DROP, msg.sender), "ROLE_SCHEDULE_DROP");
        require(amount > 0, "ZERO_DEPOSIT");
        // Calculate protocol reward and user deposit amounts
        uint protocolRewardAmount;
        uint userDepositAmount = amount;

        if (stakedFlr.protocolRewardShare() != 0) {
            protocolRewardAmount = amount.mul(stakedFlr.protocolRewardShare()).div(1e18);
            userDepositAmount = amount.sub(protocolRewardAmount);
        }

        // Update total user amount with any remaining amounts and new user deposit amount
        totalUserAmount = totalUserAmount.add(userDepositAmount);

        // Deposit user amount to Flare via StakedFlr contract
        stakedFlr.deposit{value: userDepositAmount}();

        // Send protocol reward amount to protocolRewardRecipient immediately
        if (protocolRewardAmount > 0) {
            (bool success, ) = stakedFlr.protocolRewardShareRecipient().call{value: protocolRewardAmount}("");
            require(success, "FLR_TRANSFER_FAILED");
        }

        // Calculate daily amounts
        dailyUserAmount = totalUserAmount.div(30);
        remainingDrops = 29;

        // Share the first drop immediately
        stakedFlr.shareFlareDrop(dailyUserAmount, protocolRewardAmount);
        totalUserAmount = totalUserAmount.sub(dailyUserAmount);

        // Emit event for scheduling
        emit FlareDropScheduled(0, dailyUserAmount, 0);
    }

    function daily() external whenNotPaused nonReentrant {
        require(hasRole(ROLE_SCHEDULE_DROP, msg.sender), "ROLE_SCHEDULE_DROP");
        require(remainingDrops > 0, "NO_DROPS_REMAINING");

        uint userAmount = dailyUserAmount;
        uint protocolAmount = 0;

        if (remainingDrops == 1) {
            // On the last drop, ensure the remaining amount is used
            userAmount = totalUserAmount;
        }

        stakedFlr.shareFlareDrop(userAmount, protocolAmount);

        // Subtract the daily amounts from the totals
        totalUserAmount = totalUserAmount.sub(userAmount);
        remainingDrops = remainingDrops.sub(1);

        emit DailyDropExecuted(userAmount, protocolAmount, remainingDrops);

    }
        /**
     * @notice Pause the contract
     */
    function pause() external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "DEFAULT_ADMIN_ROLE");
        _pause();
    }

    /**
     * @notice Resume the contract
     */
    function resume() external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "DEFAULT_ADMIN_ROLE");
        _unpause();
    }

}
