import { formatUnits } from "ethers";
import type { JsonRpcProvider } from "ethers";
import { aggregator } from "./eth.js";

export async function readChainlink(feedAddr: string, prov: JsonRpcProvider) {
  const a = aggregator(feedAddr, prov);
  const [dec, desc, r] = await Promise.all([a.decimals(), a.description(), a.latestRoundData()]);
  const decimals = Number(dec);
  const answer: bigint = BigInt(r.answer);
  return {
    description: String(desc),
    decimals,
    answer,
    formatted: formatUnits(answer, decimals),
    updatedAt: Number(r.updatedAt)
  };
}
