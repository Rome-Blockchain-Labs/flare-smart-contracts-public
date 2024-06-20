// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;
import "./StakedFlr.sol";

contract FlareDropManagerStorage {


    StakedFlr public stakedFlr;

    uint public dailyUserAmount;
    uint public dailyProtocolAmount;
    uint public remainingDrops;
    uint public totalUserAmount;

    bytes32 public constant ROLE_SCHEDULE_DROP = keccak256("ROLE_SCHEDULE_DROP");


}