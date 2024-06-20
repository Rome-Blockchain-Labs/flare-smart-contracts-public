// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IStakedFlr is IERC20Upgradeable {
    function getSharesByPooledFlr(uint flrAmount) external view returns (uint);
    function getPooledFlrByShares(
        uint shareAmount
    ) external view returns (uint);
    function submit() external payable returns (uint);
}
