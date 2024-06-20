import hre from "hardhat";

/**
 * Convert HEX string into ASCII string.
 *
 * @param hex HEX-encoded string
 * @returns {string} ASCII-encoded string
 */
export const hexToAsciiString = (hex: string): string => {
  let out = "";
  let i = 0;

  if (hex.substring(0, 2) === "0x") {
    i = 2;
  }

  for (; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  }

  return out;
};

/**
 * convert ASCII string into HEX string.
 *
 * @param string ASCII-encoded string
 * @returns {string} HEX-encoded string
 */
export const asciiToHexString = (string: string): string => {
  let out = "0x";
  for (let i = 0; i < string.length; i += 1) {
    out += string.charCodeAt(i).toString(16);
  }

  return out;
}

/**
 * Increase EVM time by `seconds` seconds and mine a new block.
 *
 * @param seconds Number of seconds to advance the clock
 */
export const increaseTime = async (seconds: number) => {
  await hre.ethers.provider.send("evm_increaseTime", [seconds]);
  await hre.ethers.provider.send("evm_mine", []);
}

/**
 * Get the timestamp of a block.
 *
 * @param blockNumber Block number
 */
export const getBlockTimestamp = async (blockNumber: number) => {
  const { timestamp } = await hre.ethers.provider.send(
    "eth_getBlockByNumber",
    [`0x${blockNumber.toString(16)}`, true],
  );

  return parseInt(timestamp, 16);
};
