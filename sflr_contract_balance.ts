import { ethers } from "hardhat";

(async () => {
  console.log(await ethers.provider.getBalance("0xa4DfF80B4a1D748BF28BC4A271eD834689Ea3407"));
})();
