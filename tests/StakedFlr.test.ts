import hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockStakedFlr } from "../typechain";
import { WrappedToken } from "../typechain/WrappedToken";
import { ethers } from "ethers";
import { increaseTime } from "./utils";
import { isAddress } from "ethers/lib/utils";


const {
  BigNumber,
  utils: {
    keccak256,
    toUtf8Bytes,
    parseEther,
    formatBytes32String,
  },
} = ethers;

const COOLDOWN_PERIOD = BigNumber.from(60 * 60 * 24 * 15);
const REDEMPTION_PERIOD = BigNumber.from(60 * 60 * 24 * 2);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const REWARD_ADDRESS = "0xF7ad326D291c6505894760145A2c35945323d709"
const ROLES = [
  "ROLE_WITHDRAW",
  "ROLE_PAUSE",
  "ROLE_RESUME",
  "ROLE_ACCRUE_REWARDS",
  "ROLE_DEPOSIT",
  "ROLE_PAUSE_MINTING",
  "ROLE_RESUME_MINTING",
  "ROLE_SET_TOTAL_POOLED_FLR_CAP",
]

describe("StakedFlr", function () {
  let deployer: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let stakedFlr: MockStakedFlr
  let wrappedToken: WrappedToken

  const deployStakedFlr = async () => {
    [deployer, user1, user2] = await hre.ethers.getSigners();

    const WrappedToken = await hre.ethers.getContractFactory("WrappedToken");
    wrappedToken = await WrappedToken.deploy();
    await wrappedToken.deployed();

    const StakedFlr = await hre.ethers.getContractFactory("MockStakedFlr");
    stakedFlr = (await StakedFlr.deploy()) as MockStakedFlr;
    await stakedFlr.deployed();

    await stakedFlr.initialize(COOLDOWN_PERIOD, REDEMPTION_PERIOD, wrappedToken.address);

    for (const role of ROLES) {
      await stakedFlr.grantRole(keccak256(toUtf8Bytes(role)), deployer.address);
    }

    await stakedFlr.setProtocolRewardData(REWARD_ADDRESS,BigNumber.from("100000000000000000"));
  };

  before(deployStakedFlr);

  it("prevents re-initialization", async () => {
    await expect(stakedFlr.initialize(COOLDOWN_PERIOD, REDEMPTION_PERIOD, wrappedToken.address))
      .to.be.revertedWith("Initializable: contract is already initialized");
  });

  describe("ERC-20", function () {
    before(deployStakedFlr);

    it("has correct token information", async function () {
      expect(await stakedFlr.name()).to.equal("Staked FLR");
      expect(await stakedFlr.symbol()).to.equal("sFLR");
      expect(await stakedFlr.decimals()).to.equal(18);
    });

    describe("zero supply", function () {
      it("has correct total supply", async function () {
        expect(await stakedFlr.totalSupply()).to.equal(0);
      });

      it("has correct balances", async function () {
        expect(await stakedFlr.balanceOf(deployer.address)).to.equal(0);
        expect(await stakedFlr.balanceOf(user1.address)).to.equal(0);
        expect(await stakedFlr.balanceOf(user2.address)).to.equal(0);
      });

      it("has correct allowances", async function () {
        const users = [deployer, user1, user2];

        for (const userA of users) {
          for (const userB of users) {
            expect(await stakedFlr.allowance(userA.address, userB.address)).to.equal(0);
          }
        }
      });

      it("increasing total pooled FLR doesn't affect balances", async function () {
        await stakedFlr.setTotalPooledFlr(parseEther("100"));

        for (const user of [deployer, user1, user2]) {
          expect(await stakedFlr.balanceOf(user.address)).to.equal(0);
        }
      });
    });

    describe("non-zero supply", function () {
      before(deployStakedFlr);

      before(async function () {
        await stakedFlr.connect(user1).submit({ value: parseEther("100") });
      });

      it("has correct total supply", async function () {
        expect(await stakedFlr.totalSupply()).to.equal(parseEther("100"));
      });

      it("has correct allowances", async function () {
        const users = [deployer, user1, user2];

        for (const userA of users) {
          for (const userB of users) {
            expect(await stakedFlr.allowance(userA.address, userB.address)).to.equal(0);
          }
        }
      });

      it("has correct balances", async function () {
        expect(await stakedFlr.balanceOf(deployer.address)).to.equal(0);
        expect(await stakedFlr.balanceOf(user1.address)).to.equal(parseEther("100"));
        expect(await stakedFlr.balanceOf(user2.address)).to.equal(0);
      });

      describe("#transfer", function () {
        before(deployStakedFlr);

        before(async function () {
          await stakedFlr.connect(user1).submit({ value: parseEther("100") });
        });

        it("reverts if recipient is the zero address", async function () {
          await expect(
            stakedFlr.connect(user1).transfer(ZERO_ADDRESS, parseEther("1")),
          ).to.be.revertedWith("TRANSFER_TO_THE_ZERO_ADDRESS");
        });

        it("reverts if sender has insufficient balance", async function () {
          await expect(
            stakedFlr.connect(user1).transfer(user2.address, parseEther("1000")),
          ).to.be.revertedWith("TRANSFER_AMOUNT_EXCEEDS_BALANCE");

          await expect(
            stakedFlr.connect(user2).transfer(user1.address, parseEther("1000")),
          ).to.be.revertedWith("TRANSFER_AMOUNT_EXCEEDS_BALANCE");
        });

        it("transfers whole balance and emits a Transfer event", async function () {
          const amount = await stakedFlr.balanceOf(user1.address);
          const receipt = await stakedFlr.connect(user1).transfer(user2.address, amount);

          expect(await stakedFlr.balanceOf(user1.address)).to.equal(0);
          expect(await stakedFlr.balanceOf(user2.address)).to.equal(amount);

          expect(receipt)
            .to.emit(stakedFlr, "Transfer")
            .withArgs(user1.address, user2.address, amount);
        });
      });

      describe("#approve", function () {
        before(deployStakedFlr);

        before(async function () {
          await stakedFlr.connect(user1).submit({ value: parseEther("100") });
        });

        it("reverts if spender is the zero address", async function () {
          await expect(
            stakedFlr.connect(user1).approve(ZERO_ADDRESS, parseEther("1")),
          ).to.be.revertedWith("APPROVE_TO_ZERO_ADDRESS");
        });

        it("works with zero token balance", async function () {
          const allowance = parseEther("1000");

          const receipt = await stakedFlr.connect(user2).approve(user1.address, allowance);

          expect(await stakedFlr.allowance(user2.address, user1.address)).to.equal(allowance);
          expect(receipt)
            .to.emit(stakedFlr, "Approval")
            .withArgs(user2.address, user1.address, allowance);
        });

        it("works with non-zero token balance", async function () {
          const allowance = parseEther("1");

          const receipt = await stakedFlr.connect(user1).approve(user2.address, allowance);

          expect(await stakedFlr.allowance(user1.address, user2.address))
            .to.equal(allowance);
          expect(receipt)
            .to.emit(stakedFlr, "Approval")
            .withArgs(user1.address, user2.address, allowance);
        });

        it("new allowance replaces old allowance", async function () {
          await stakedFlr.connect(user1)
            .approve(user2.address, parseEther("100"));

          const newAllowance = parseEther("123");

          const receipt = await stakedFlr.connect(user1)
            .approve(user2.address, newAllowance);

          expect(await stakedFlr.allowance(user1.address, user2.address))
            .to.equal(newAllowance);
          expect(receipt)
            .to.emit(stakedFlr, "Approval")
            .withArgs(user1.address, user2.address, newAllowance);
        });
      });

      describe("#transferFrom", function () {
        before(deployStakedFlr);

        before(async function () {
          await stakedFlr.connect(user1).submit({ value: parseEther("100") });
        });

        beforeEach(async function () {
          await stakedFlr.connect(user1).approve(user2.address, parseEther("1000"));
          await stakedFlr.connect(user2).approve(user1.address, parseEther("1000"));
        });

        it("reverts if recipient is the zero address", async function () {
          await expect(
            stakedFlr.connect(user1)
              .transferFrom(user2.address, ZERO_ADDRESS, parseEther("10")),
          ).to.be.revertedWith("TRANSFER_TO_THE_ZERO_ADDRESS");
        });

        it("reverts if sender is the zero address", async function () {
          await expect(
            stakedFlr.connect(user1)
              .transferFrom(ZERO_ADDRESS, user2.address, parseEther("10")),
          ).to.be.revertedWith("TRANSFER_AMOUNT_EXCEEDS_ALLOWANCE");
        });

        it("reverts if amount exceeds allowance", async function () {
          await expect(
            stakedFlr.connect(user2)
              .transferFrom(user1.address, user2.address, parseEther("1234")),
          ).to.be.revertedWith("TRANSFER_AMOUNT_EXCEEDS_ALLOWANCE");
        });

        it("reverts if amount exceeds owner balance", async function () {
          await expect(
            stakedFlr.connect(user2)
              .transferFrom(user1.address, user2.address, parseEther("150")),
          ).to.be.revertedWith("TRANSFER_AMOUNT_EXCEEDS_BALANCE");
        });

        it("transfers tokens, reduces allowance, and emits an event", async function () {
          const receipt = await stakedFlr.connect(user2)
            .transferFrom(user1.address, user2.address, parseEther("75"));

          expect(await stakedFlr.balanceOf(user2.address)).to.equal(parseEther("75"));
          expect(await stakedFlr.balanceOf(user1.address)).to.equal(parseEther("25"));
          expect(await stakedFlr.allowance(user1.address, user2.address)).to.equal(parseEther("925"));
          expect(receipt)
            .to.emit(stakedFlr, "Transfer")
            .withArgs(user1.address, user2.address, parseEther("75"));
          expect(receipt)
            .to.emit(stakedFlr, "Approval")
            .withArgs(user1.address, user2.address, parseEther("925"));
        });
      });
    });
  });

  describe("#initialize", function () {
    before(deployStakedFlr);

    it("saves the initializer function arguments", async function () {
      expect(await stakedFlr.cooldownPeriod()).to.equal(COOLDOWN_PERIOD);
      expect(await stakedFlr.redeemPeriod()).to.equal(REDEMPTION_PERIOD);
    });

    it("sets up the admin roles", async function () {
      expect(
        await stakedFlr.hasRole(
          formatBytes32String(""),
          deployer.address,
        ),
        "Admin is missing the DEFAULT_ADMIN_ROLE",
      ).to.be.true;

      for (const role of ROLES) {
        expect(
          await stakedFlr.hasRole(
            keccak256(toUtf8Bytes(role)),
            deployer.address,
          ),
          `Admin is missing the role ${role}`,
        ).to.be.true;
      }
    });

    it("sets unlimited deposit cap", async function () {
      expect(await stakedFlr.totalPooledFlrCap())
        .to.equal(BigNumber.from(2).pow(256).sub(1));
    });
  });

  describe("#submit", function () {
    before(deployStakedFlr);

    const value = parseEther("10");

    it("reverts with zero Flr value", async function () {
      await expect(stakedFlr.connect(user1).submit({ value: BigNumber.from(0) }))
        .to.be.revertedWith("ZERO_DEPOSIT");
    });

    it("emits Transfer and Submitted events", async function () {
      const receipt = await stakedFlr.connect(user1).submit({ value });

      expect(receipt)
        .to.emit(stakedFlr, "Transfer")
        .withArgs(ZERO_ADDRESS, user1.address, value);

      expect(receipt)
        .to.emit(stakedFlr, "Submitted")
        .withArgs(user1.address, value, value);
    });

    it("transfers shares to user", async function () {
      expect(await stakedFlr.balanceOf(user1.address)).to.equal(value);
    })
  });

  describe("#submitWrapped", function () {
    before(deployStakedFlr);

    const value = parseEther("10")

    it("wrapped token balance", async function () {
      await wrappedToken.connect(user1).deposit({ value })
      expect(await wrappedToken.balanceOf(user1.address)).to.equal(value)
    });

    it("has correct allowances", async function () {
      const users = [deployer, user1, user2];

      for (const userA of users) {
        for (const userB of users) {
          const allowance = await wrappedToken.allowance(userA.address, userB.address);
          expect(allowance).to.equal(0)
        }
      }

      await wrappedToken.connect(user1).approve(deployer.address, value)

      const updatedAllowance = await wrappedToken.allowance(user1.address, deployer.address)
      expect(updatedAllowance).to.equal(value)

    });


    it("reverts with zero deposit", async function () {
      await expect(stakedFlr.connect(user1).submitWrapped(BigNumber.from(0))).to.be.revertedWith("ZERO_DEPOSIT");

    });

    it("emits Transfer and Submitted events", async function () {
       await wrappedToken.connect(user1).approve(stakedFlr.address, value)
      
      const receipt = await stakedFlr.connect(user1).submitWrapped(value);

      expect(receipt)
        .to.emit(stakedFlr, "Transfer")
        .withArgs(ZERO_ADDRESS, user1.address, value);

      expect(receipt)
        .to.emit(stakedFlr, "Submitted")
        .withArgs(user1.address, value, value)
    });

    it("transfers shares to user", async function() {
      expect(await stakedFlr.balanceOf(user1.address)).to.equal(value)
    })
  });

  describe("#requestUnlock", function () {
    before(deployStakedFlr);

    before(async function () {
      await stakedFlr.connect(user1).submit({ value: parseEther("100") });
    });

    it("validates share amount", async function () {
      await expect(stakedFlr.connect(user1).requestUnlock(parseEther("0")))
        .to.be.revertedWith("Invalid unlock amount");
      await expect(stakedFlr.connect(user1).requestUnlock(parseEther("1000")))
        .to.be.revertedWith("Unlock amount too large");
    });

    let receipt: ethers.ContractTransaction;
    let shareAmount: ethers.BigNumber;

    it("transfers shares", async function () {
      shareAmount = await stakedFlr.balanceOf(user1.address);
      receipt = await stakedFlr.connect(user1).requestUnlock(shareAmount);

      expect(await stakedFlr.balanceOf(user1.address)).to.equal(0);
    });

    it("updates user shares in custody", async function () {
      expect(await stakedFlr.userSharesInCustody(user1.address)).to.equal(shareAmount);
    });

    it("emits UnlockRequested event", async function () {
      expect(receipt)
        .to.emit(stakedFlr, "UnlockRequested")
        .withArgs(user1.address, shareAmount);
    });

    it("saves unlock details", async function () {
      const userUnlockCount = await stakedFlr.getUnlockRequestCount(user1.address);
      expect(userUnlockCount).to.equal(1);

      const unlockRequest = await stakedFlr.userUnlockRequests(user1.address, 0);
      expect(unlockRequest.shareAmount).to.equal(shareAmount);
    });
  });

  describe("#cancelUnlockRequest", function () {
    before(deployStakedFlr);

    let unlockRequest: ethers.BigNumber[];

    before(async function () {
      await stakedFlr.connect(user1).submit({ value: parseEther("100") });
      await stakedFlr.connect(user1).requestUnlock(parseEther("100"));

      unlockRequest = await stakedFlr.userUnlockRequests(user1.address, BigNumber.from(0));
    });

    it("validates unlock request index", async function () {
      await expect(
        stakedFlr.connect(user2).cancelUnlockRequest(BigNumber.from(1)),
      ).to.be.revertedWith("Invalid index");
    });

    let receipt: ethers.ContractTransaction;

    it("removes unlock request", async function () {
      receipt = await stakedFlr.connect(user1).cancelUnlockRequest(BigNumber.from(0));

      expect(await stakedFlr.getUnlockRequestCount(user1.address)).to.equal(0);
    });

    it("updates user shares in custody", async function () {
      expect(await stakedFlr.userSharesInCustody(user1.address)).to.equal(0);
    });

    it("transfers shares back to the user", async function () {
      expect(await stakedFlr.balanceOf(user1.address)).to.equal(parseEther("100"));
    });

    it("emits an UnlockCancelled event", async function () {
      expect(receipt)
        .to.emit(stakedFlr, "UnlockCancelled")
        .withArgs(user1.address, unlockRequest[0], parseEther("100"));
    });

    it("prevents cancellation of overdue unlock requests", async function () {
      await stakedFlr.connect(user2).submit({ value: parseEther("100") });
      await stakedFlr.connect(user2).requestUnlock(parseEther("10"));

      await increaseTime(COOLDOWN_PERIOD.add(REDEMPTION_PERIOD).toNumber());

      await expect(stakedFlr.connect(user2).cancelUnlockRequest(BigNumber.from(0)))
        .to.be.revertedWith("Unlock request is expired");
    });

    it("removes unlock request when there are multiple", async function () {
      await increaseTime(42);
      await stakedFlr.connect(user2).requestUnlock(parseEther("20"));
      await increaseTime(42);
      await stakedFlr.connect(user2).requestUnlock(parseEther("30"));
      await increaseTime(42);
      await stakedFlr.connect(user2).requestUnlock(parseEther("40"));

      expect(await stakedFlr.getUnlockRequestCount(user2.address)).to.equal(4);

      const unlockRequests = await Promise.all(
        Array.apply(null, Array(4))
          .map((_, index) => stakedFlr.userUnlockRequests(user2.address, BigNumber.from(index))),
      );

      const removedUnlockRequest = await stakedFlr.userUnlockRequests(user2.address, BigNumber.from(1));

      const receipt = await stakedFlr.connect(user2).cancelUnlockRequest(BigNumber.from(1));
      expect(receipt)
        .to.emit(stakedFlr, "UnlockCancelled")
        .withArgs(user2.address, removedUnlockRequest[0], parseEther("20"));

      expect(await stakedFlr.getUnlockRequestCount(user2.address)).to.equal(3);

      const remainingUnlockRequests = await Promise.all(
        Array.apply(null, Array(3))
          .map((_, index) => stakedFlr.userUnlockRequests(user2.address, BigNumber.from(index))),
      );

      expect(unlockRequests[0]).to.deep.equal(remainingUnlockRequests[0]);
      expect(unlockRequests[2]).to.deep.equal(remainingUnlockRequests[2]);
      expect(unlockRequests[3]).to.deep.equal(remainingUnlockRequests[1]);
    });
  });

  describe("#redeem", function () {
    before(deployStakedFlr);

    before(async function () {
      await stakedFlr.connect(user1).submit({ value: parseEther("100") });
      await stakedFlr.connect(user1).requestUnlock(parseEther("50"));

      // DONT DEPOSIT HERE:await stakedFlr.connect(deployer).deposit({ value: parseEther("100") });
    });

    describe("when called with an unlock index number", function () {
      it("validates unlock request index", async function () {
        await expect(stakedFlr.connect(user1)["redeem(uint256)"](BigNumber.from(42)))
          .to.be.revertedWith("Invalid unlock request index");
      });

      it("enforces cooldown period", async function () {
        await expect(stakedFlr.connect(user1)["redeem(uint256)"](BigNumber.from(0)))
          .to.be.revertedWith("Unlock request is not redeemable");

        await increaseTime(COOLDOWN_PERIOD.toNumber());
      });

      it("enforces redemption window");

      it("burns shares");

      it("updates user shares in custody");

      it("transfers FLR to the user");

      it("removes old unlock requests");

      it("emits a Redeem event");
    });

    describe("when called without an unlock index number", function () {
      it("enforces redemption window");

      it("burns shares");

      it("updates user shares in custody");

      it("transfers FLR to the user");

      it("removes old unlock requests");

      it("emits a Redeem event");
    });
  });

  describe("#redeemOverdueShares", function () {
    describe("when called with an unlock index number", function () {
      before(deployStakedFlr);

      before(async function () {

      });

      it("validates the unlock request index");

      it("makes sures the unlock is overdue");

      it("removes the unlock request entry");

      it("transfers shares to the user");

      it("updates the user shares in custody");

      it("emits a RedeemOverdueShares event");
    });

    describe("when called without an unlock index number", function () {
      before(deployStakedFlr);

      before(async function () {

      });

      it("validates the unlock request index");

      it("makes sures the unlock is overdue");

      it("removes the unlock request entry");

      it("transfers shares to the user");

      it("updates the user shares in custody");

      it("emits a RedeemOverdueShares event");
    });
  });

  describe("#accrueRewards", function () {
    before(deployStakedFlr);

    const amount = parseEther("10");
    const expectedIncreaseAmount = parseEther("9")
    const protocolRewardAmount = parseEther("1")

    let receipt: ethers.ContractTransaction;

    it("increases total pooled FLR", async function () {
      expect(await stakedFlr.protocolRewardShareRecipient()).to.be.equal(REWARD_ADDRESS);
      const priorTotalPooledFlr = await stakedFlr.totalPooledFlr();
      receipt = await stakedFlr.accrueRewards({ value: BigNumber.from(amount) });
      const posteriorTotalPooledFlr = await stakedFlr.totalPooledFlr();

      const flrDifference = posteriorTotalPooledFlr.sub(priorTotalPooledFlr);

      expect(flrDifference).to.be.equal(expectedIncreaseAmount);
    });

    it("cleans up expired exchange rate entries");

    it("adds a new exchange rate entry");

    it("emits an AccrueReward event", async function () {
      expect(receipt)
        .to.emit(stakedFlr, "AccrueRewards")
        .withArgs(expectedIncreaseAmount, protocolRewardAmount);
    });
  });

  describe("#deposit", function () {
    before(deployStakedFlr);

    before(async function () {
      await stakedFlr.connect(user1).submit({ value: parseEther("100") });
      await stakedFlr.connect(user2).submit({ value: parseEther("50") });
      expect(await stakedFlr.totalPooledFlr()).to.equal(parseEther("150"));
    });

    it("requires ROLE_DEPOSIT role", async function () {
      await expect(
        stakedFlr
          .connect(user1)
          .deposit({ value: parseEther("10") }),
      ).to.be.revertedWith("ROLE_DEPOSIT");
    });

    it("validates transfer amount", async function () {
      await expect(stakedFlr.connect(deployer).deposit({ value: parseEther("0") }))
        .to.be.revertedWith("Zero value");
    });

    let receipt: ethers.ContractTransaction;

    it("increases contract (W)FLR balance", async function () {
      // Amount of FLR in Wrapped Flare contract 
      const priorBalanceInFLR = await hre.ethers.provider.getBalance(stakedFlr.address);
      // Amount of WFLR in Wrapped Flare contract 
      const priorBalanceInWFLR = await hre.ethers.provider.getBalance(wrappedToken.address);
      receipt = await stakedFlr.connect(deployer).deposit({ value: parseEther("10") });
      // Amount of FLR in WFLR contract
      // Amount of FLR in Wrapped Flare contract 
      const posteriorBalanceInFLR = await hre.ethers.provider.getBalance(stakedFlr.address);
      // Amount of WFLR in Wrapped Flare contract 
      const posteriorBalanceInWFLR = await hre.ethers.provider.getBalance(wrappedToken.address);

      // now wrappedToken has 10 FLR more
      expect(posteriorBalanceInWFLR.add(posteriorBalanceInFLR).sub(priorBalanceInWFLR.add(priorBalanceInFLR))).to.equal(parseEther("10"));
      // we expect 160 FLR in the wrapped flare contract 150 staked and 10 deposit
      expect(await wrappedToken.balanceOf(stakedFlr.address)).to.equal(parseEther("160"));
    });

    it("emits a Deposit event", async function () {
      expect(receipt)
        .to.emit(stakedFlr, "Deposit")
        .withArgs(deployer.address, parseEther("10"));
    });

    it("doesn't affect account balances", async function () {
      expect(await stakedFlr.balanceOf(user1.address)).to.equal(parseEther("100"));
      expect(await stakedFlr.balanceOf(user2.address)).to.equal(parseEther("50"));
    });

    it("doesn't increase pooled FLR amount", async function () {
      const priorPooledFlr = await stakedFlr.totalPooledFlr();
      await stakedFlr.connect(deployer).deposit({ value: parseEther("100") });
      const posteriorPooledFlr = await stakedFlr.totalPooledFlr();

      expect(posteriorPooledFlr.sub(priorPooledFlr)).to.equal(0);
    });
  });


  describe("#withdraw", async function () {
    before(deployStakedFlr);
    before(async function () {
      expect(await stakedFlr.totalPooledFlr()).to.equal(parseEther("0"), "no pooled flare as only deposited safety");
      await stakedFlr.connect(user1).submit({ value: parseEther("50") });
      await stakedFlr.connect(user2).submit({ value: parseEther("50") });
      expect(await stakedFlr.totalPooledFlr()).to.equal(parseEther("100"),"After 100 submit");
      // NO GAS FOR SC :await stakedFlr.connect(deployer).deposit({ value: parseEther("10") });
      // this 10 is always kept in contract and not wrapped
      expect(await wrappedToken.balanceOf(stakedFlr.address)).to.equal(parseEther("100"), "wrappedToken balance should still be 100 as first 10 FLR is kept unwrapped");
      expect(await stakedFlr.totalPooledFlr()).to.equal(parseEther("100"), "totalPooled Flare is still 100");
    });


    it("requires ROLE_WITHDRAW role", async function () {
      await expect(stakedFlr.connect(user1).withdraw(parseEther("10")))
        .to.be.revertedWith("ROLE_WITHDRAW");
    });
    it("should be active when withdrawing", async function () {
      expect(await stakedFlr.paused()).to.be.false;
    });
    it("updates contract balance", async function () {
      expect(await wrappedToken.balanceOf(stakedFlr.address)).to.equal(parseEther("100"));
    });


    it("reverts if contract balance is insufficient", async function () {
      await expect(stakedFlr.connect(deployer).withdraw(parseEther("1000")))
        .to.be.revertedWith("Insufficient balance");
    });

    let receipt: ethers.ContractTransaction;

    it("transfers (W)FLR to the caller", async function () {

      const wFLRbalance = await wrappedToken.balanceOf(stakedFlr.address);
      const deployerBalance = await hre.ethers.provider.getBalance(deployer.address);

      expect(wFLRbalance).to.be.at.least(parseEther("10"));

      receipt = await stakedFlr.connect(deployer).withdraw(parseEther("2"));

      await expect(receipt).to.changeEtherBalance(deployer, parseEther("2"));
      expect(await wrappedToken.balanceOf(stakedFlr.address)).to.equal(parseEther("98"));
      expect(await stakedFlr.totalPooledFlr()).to.equal(parseEther("100"), "totalPooled Flare is still 99");
      const wFLRbalance2 = await wrappedToken.balanceOf(stakedFlr.address);
      await expect(wFLRbalance2.sub(wFLRbalance)).to.be.equal(parseEther("-2"));
      //deployer balance should be 2
      const deployerBalance2 = await hre.ethers.provider.getBalance(deployer.address);
      // gas has been taken
      expect(deployerBalance2.sub(deployerBalance)).to.be.lt(parseEther("2"));
      expect(deployerBalance2.sub(deployerBalance)).to.be.gte(parseEther("1.9999"));
    });

    it("emits a Withdraw event", async function () {
      expect(receipt)
        .to.emit(stakedFlr, "Withdraw")
        .withArgs(deployer.address, parseEther("2"));
    });

  });


  describe("#setCooldownPeriod", function () {
    before(deployStakedFlr);

    it("requires DEFAULT_ADMIN_ROLE role", async function () {
      await expect(
        stakedFlr
          .connect(user1)
          .setCooldownPeriod(BigNumber.from("0")),
      ).to.be.revertedWith("DEFAULT_ADMIN_ROLE");
    });

    let receipt: ethers.ContractTransaction;
    const newCooldownPeriod = BigNumber.from("42");

    it("updates the cooldown period", async function () {
      receipt = await stakedFlr.connect(deployer).setCooldownPeriod(newCooldownPeriod);

      expect(await stakedFlr.cooldownPeriod()).to.equal(newCooldownPeriod);
    });

    it("emits a CooldownPeriodUpdated event", async function () {
      expect(receipt)
        .to.emit(stakedFlr, "CooldownPeriodUpdated")
        .withArgs(COOLDOWN_PERIOD, newCooldownPeriod);
    });
  });

  describe("#setRedeemPeriod", function () {
    before(deployStakedFlr);

    it("requires DEFAULT_ADMIN_ROLE role", async function () {
      await expect(
        stakedFlr
          .connect(user1)
          .setRedeemPeriod(BigNumber.from("0")),
      ).to.be.revertedWith("DEFAULT_ADMIN_ROLE");
    });

    let receipt: ethers.ContractTransaction;
    const newRedemptionPeriod = BigNumber.from("42");

    it("updates the redemption period", async function () {
      receipt = await stakedFlr.connect(deployer).setRedeemPeriod(newRedemptionPeriod);

      expect(await stakedFlr.redeemPeriod()).to.equal(newRedemptionPeriod);
    });

    it("emits a RedeemPeriodUpdated event", async function () {
      expect(receipt)
        .to.emit(stakedFlr, "RedeemPeriodUpdated")
        .withArgs(REDEMPTION_PERIOD, newRedemptionPeriod);
    });
  });

  describe("#setTotalPooledFlrCap", function () {
    before(deployStakedFlr);

    it("requires ROLE_SET_TOTAL_POOLED_FLR_CAP role", async function () {
      await expect(
        stakedFlr
          .connect(user1)
          .setTotalPooledFlrCap(BigNumber.from("0")),
      ).to.be.revertedWith("ROLE_SET_TOTAL_POOLED_FLR_CAP");
    });

    let receipt: ethers.ContractTransaction;

    it("updates the pooled FLR cap", async function () {
      receipt = await stakedFlr.connect(deployer).setTotalPooledFlrCap(parseEther("10"));

      expect(await stakedFlr.totalPooledFlrCap()).to.equal(parseEther("10"));
    });

    it("emits a TotalPooledFlrCapUpdated event", async function () {
      expect(receipt)
        .to.emit(stakedFlr, "TotalPooledFlrCapUpdated")
        .withArgs(BigNumber.from(2).pow(256).sub(1), parseEther("10"));
    });
  });

  describe("Pausing", function () {
    before(deployStakedFlr);

    describe("#pause", function () {
      it("requires ROLE_PAUSE", async function () {
        await expect(stakedFlr.connect(user1).pause())
          .to.be.revertedWith("ROLE_PAUSE");
      });

      it("emits a Paused event", async function () {
        const receipt = await stakedFlr.connect(deployer).pause();

        expect(receipt)
          .to.emit(stakedFlr, "Paused")
          .withArgs(deployer.address);
      });

      it("paused() returns true", async function () {
        expect(await stakedFlr.paused()).to.be.true;
      });

      it("cannot pause if paused", async function () {
        await expect(stakedFlr.connect(deployer).pause())
          .to.be.revertedWith("Pausable: paused");
      });
    });

    describe("#resume", function () {
      it("requires ROLE_RESUME", async function () {
        await expect(stakedFlr.connect(user1).resume())
          .to.be.revertedWith("ROLE_RESUME");
      });

      it("emits a Unpaused event", async function () {
        const receipt = await stakedFlr.connect(deployer).resume();

        expect(receipt)
          .to.emit(stakedFlr, "Unpaused")
          .withArgs(deployer.address);
      });

      it("paused() returns false", async function () {
        expect(await stakedFlr.paused()).to.be.false;
      });

      it("cannot resume if not paused", async function () {
        await expect(stakedFlr.connect(deployer).resume())
          .to.be.revertedWith("Pausable: not paused");
      });
    });

    describe("#pauseMinting", function () {
      it("requires ROLE_PAUSE_MINTING", async function () {
        await expect(stakedFlr.connect(user1).pauseMinting())
          .to.be.revertedWith("ROLE_PAUSE_MINTING");
      });

      it("emits a MintingPaused event", async function () {
        const receipt = await stakedFlr.connect(deployer).pauseMinting();

        expect(receipt)
          .to.emit(stakedFlr, "MintingPaused")
          .withArgs(deployer.address);
      });

      it("sets mintingPaused to true", async function () {
        expect(await stakedFlr.mintingPaused()).to.be.true;
      });

      it("cannot pause if paused", async function () {
        await expect(stakedFlr.connect(deployer).pauseMinting())
          .to.be.revertedWith("Minting is already paused");
      });
    });

    describe("#resumeMinting", function () {
      it("requires ROLE_RESUME_MINTING", async function () {
        await expect(stakedFlr.connect(user1).resumeMinting())
          .to.be.revertedWith("ROLE_RESUME_MINTING");
      });

      it("emits a MintingResumed event", async function () {
        const receipt = await stakedFlr.connect(deployer).resumeMinting();

        expect(receipt)
          .to.emit(stakedFlr, "MintingResumed")
          .withArgs(deployer.address);
      });

      it("sets mintingPaused to false", async function () {
        expect(await stakedFlr.mintingPaused()).to.be.false;
      });
    });
  });
});
