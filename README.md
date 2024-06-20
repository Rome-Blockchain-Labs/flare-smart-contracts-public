# Sceptre Liquid Staking Smart Contracts

This repository contains the smart contracts for the Sceptre Liquid Staking system.

Users can stake ("deposit") their Flare by locking it for a minimum duration determined
by the `cooldownPeriod` variable. In doing so, they receive a variable amount of sFLR
tokens which are representative of their share of the whole pool. As delegation rewards
are accrued to the contract, the amount of pooled Flare is increased, and thus the exchange
rate of sFlare to Flare changes to make burning sFlare more valuable.

To unstake ("redeem") their initial stake, the user must start the cooldown period for the
release of their Flare tokens. This triggers an action by the staking bot to incrementally
decrease the amount of delegated Flare to cover the requested redemption amount after the
cooldown period has elapsed. After the cooldown period, the user has a time window,
determined by the `redeemPeriod` variable, within which they have to redeem their Flare
by burning the initially set amount of sFlare tokens. If they fail to do so, the window is
closed and the process has to be started again.


## Tests

To run the tests, execute

```
npx hardhat clean   # only after contract changes
npx hardhat compile # only the first time and after contract changes
npx hardhat test
```

in the `contracts` folder. For the tests to run, you must specify a `MNEMONIC`
environment variable.

To enable gas reports, define a `REPORT_GAS=1` environment variable.
