// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../StakedFlr/StakedFlr.sol";

contract MockStakedFlr is StakedFlr {
    function getExchangeRateByUnlockTimestamp(
        uint unlockTimestamp
    ) external view returns (bool, uint) {
        return _getExchangeRateByUnlockTimestamp(unlockTimestamp);
    }

    function dropExpiredExchangeRateEntries() external {
        _dropExpiredExchangeRateEntries();
    }

    function setTotalPooledFlr(uint value) external {
        totalPooledFlr = value;
    }
}
