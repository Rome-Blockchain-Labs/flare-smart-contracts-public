// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;

interface IWrappedToken {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(
        address from,
        address to,
        uint amount
    ) external returns (bool);
    function transfer(address to, uint amount) external returns (bool);
}
