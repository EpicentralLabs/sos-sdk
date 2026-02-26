import { address, type Address } from "@solana/kit";
import { fetchAddressLookupTable } from "@solana-program/address-lookup-table";
import { PROGRAM_ID } from "./program";
import type { KitRpc } from "./types";

export const LOOKUP_TABLE_ADDRESSES: Record<"devnet" | "mainnet", Address | null> = {
  devnet: address("EheW9UCUDMFybVKKXh5Eyg8hgVQpVc3uBZjBpu9gai4L"),
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

/** Result of verifying that a lookup table is correct for the current option program */
export interface VerifyLookupTableResult {
  /** True if the lookup table exists on-chain and contains the current program ID */
  valid: boolean;
  /** Whether the lookup table account was found on-chain */
  foundOnChain: boolean;
  /** Whether the Option Program ID is present in the table's addresses */
  programIdInTable: boolean;
  /** If valid is false, addresses that were required but missing from the table */
  missingAddresses?: Address[];
  /** Human-readable reason when valid is false */
  reason?: string;
}

/**
 * Verifies that the given lookup table is correct for the current Option Program.
 * Ensures:
 * 1. The lookup table exists on-chain
 * 2. The table contains the current program ID (from client/program)
 *
 * Use this before sending transactions to avoid using a stale or wrong ALT.
 *
 * @param rpc - RPC client (must support getAddressLookupTable)
 * @param lookupTableAddress - ALT address to verify (e.g. from getLookupTableAddressForNetwork)
 * @param requiredAddresses - Optional extra addresses that must be in the table (e.g. key PDAs). PROGRAM_ID is always required.
 * @returns Verification result with valid flag and details
 */
export async function verifyLookupTableForProgram(
  rpc: KitRpc,
  lookupTableAddress: Address | null,
  requiredAddresses?: Address[]
): Promise<VerifyLookupTableResult> {
  if (!lookupTableAddress) {
    return {
      valid: false,
      foundOnChain: false,
      programIdInTable: false,
      reason: "No lookup table address configured for this network",
    };
  }

  let tableAddresses: Address[];
  try {
    const { data } = await fetchAddressLookupTable(rpc, lookupTableAddress);
    tableAddresses = data.addresses as Address[];
  } catch {
    return {
      valid: false,
      foundOnChain: false,
      programIdInTable: false,
      reason: "Lookup table not found on-chain or RPC error",
    };
  }

  const programIdStr = PROGRAM_ID;
  const set = new Set(tableAddresses.map((a) => (typeof a === "string" ? a : String(a))));
  const programIdInTable = set.has(programIdStr);

  const required = requiredAddresses ?? [];
  const allRequired = [programIdStr as Address, ...required];
  const missingAddresses = allRequired.filter(
    (addr) => !set.has(typeof addr === "string" ? addr : String(addr))
  );

  const valid = programIdInTable && missingAddresses.length === 0;

  return {
    valid,
    foundOnChain: true,
    programIdInTable,
    ...(missingAddresses.length > 0 && { missingAddresses: missingAddresses as Address[] }),
    ...(!valid &&
      (!programIdInTable
        ? { reason: "Lookup table does not contain the current Option Program ID" }
        : { reason: `Lookup table is missing required addresses: ${missingAddresses.join(", ")}` })),
  };
}
