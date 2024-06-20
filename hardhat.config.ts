import "@typechain/hardhat";
// use old package hardhat-etherscan,
// flare not supported by sourcify
import "@nomiclabs/hardhat-etherscan"
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/test-helpers";
import "@openzeppelin/hardhat-upgrades";
import "solidity-coverage";
import "hardhat-gas-reporter";

export default {
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./src",
    tests: "./tests",
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts: {
        accountsBalance: "10000000000000000000000" // Sets the balance of each account to 10,000 ETH (specified in wei)
      }
    },
    local: {
      url: "http://localhost:9650/ext/bc/C/rpc",
      chainId: 4294967295,
      accounts: [
        "1b5ca097234ed6f05fe7fd53427fd99a967d38de9addff4831c7d334c71d464d",
      ],
    },
    // our modified go-flare local testnet
    localflare2: {
      url: "http://localhost:9650/ext/bc/C/rpc",
      chainId: 162,
      accounts: [
        "1b5ca097234ed6f05fe7fd53427fd99a967d38de9addff4831c7d334c71d464d",
      ],
    },
    // our modified go-flare Hetzner testnet
    hetznerflare: {
      url: "http://95.217.18.190:9650/ext/bc/C/rpc",
      chainId: 162,
      accounts: [
        "1b5ca097234ed6f05fe7fd53427fd99a967d38de9addff4831c7d334c71d464d",
      ],
    },
    coston: {
      url: "https://coston-api.flare.network/ext/C/rpc",
      chainId: 16,
      accounts: [
        "1b5ca097234ed6f05fe7fd53427fd99a967d38de9addff4831c7d334c71d464d", // b
      ],
    },
    coston2: {
      url: "https://coston2-api.flare.network/ext/bc/C/rpc",
      chainId: 114,
      accounts: [
        "1b5ca097234ed6f05fe7fd53427fd99a967d38de9addff4831c7d334c71d464d", // b
      ],
    },
    flare: { 
      url:  "https://flare.solidifi.app/ext/C/rpc",
      chainId: 14,
      accounts: [
        "1b5ca097234ed6f05fe7fd53427fd99a967d38de9addff4831c7d334c71d464d",
      ]
    }
  },
  etherscan: {
    apiKey: {
      flare: "flare", // apiKey is not required, just set a placeholder
    },
    customChains: [
      {
        network: 'flare',
        chainId: 14,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/mainnet/evm/14/etherscan",
          browserURL: "https://flare.routescan.io"
        },
      },
    ],
  },
  typechain: {
    outDir: "./typechain",
  },
  gasReporter: {
    enabled: !!process.env.REPORT_GAS,
  },
};
