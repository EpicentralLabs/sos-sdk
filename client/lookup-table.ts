import { address, type Address } from "@solana/kit";
import type { KitRpc } from "./types";

export const LOOKUP_TABLE_ADDRESSES: Record<"devnet" | "mainnet", Address | null> = {
  devnet: address("HsoWoDfW4yXVaXE31tEz167cjQn79TeXYxggSrXvRvri"),
  mainnet: null,
};

export const LOOKUP_TABLE_ADDRESS: Address | null = LOOKUP_TABLE_ADDRESSES.devnet;

export function detectNetwork(rpcUrl: string): "devnet" | "mainnet" {
  const lower = rpcUrl.toLowerCase();
  return lower.includes("mainnet") ? "mainnet" : "devnet";
}

export function getLookupTableAddressForNetwork(
  network: "devnet" | "mainnet"
): Address | null {
  return LOOKUP_TABLE_ADDRESSES[network];
}

export async function getLookupTableAccount(
  rpc: KitRpc,
  lookupTableAddress: Address | null
): Promise<unknown | null> {
  if (!lookupTableAddress) return null;
  const rpcWithLookupTable = rpc as KitRpc & {
    getAddressLookupTable: (address: Address) => { send: () => Promise<{ value: unknown | null }> };
  };
  const result = await rpcWithLookupTable.getAddressLookupTable(lookupTableAddress).send();
  return result.value ?? null;
}
