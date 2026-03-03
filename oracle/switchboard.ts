import type { Address } from "@solana/kit";
import bs58 from "bs58";
import { toAddress } from "../client/program";
import type { AddressLike, KitRpc } from "../client/types";
import { fetchMarketDataAccount } from "../accounts/fetchers";
import { invariant } from "../shared/errors";

export async function resolveSwitchboardFeedFromMarketData(
  rpc: KitRpc,
  marketData: AddressLike
): Promise<Address> {
  const account = await fetchMarketDataAccount(rpc, marketData);
  invariant(!!account, "Market data account not found.");
  return toAddress(
    bs58.encode(
      Array.from(account.switchboardFeedId as unknown as Uint8Array)
    )
  );
}

export interface SwitchboardPullFeedLike<TInstruction = unknown, TLookupTable = unknown> {
  fetchUpdateIx(args: {
    crossbarClient: unknown;
    chain?: "solana";
    network?: "devnet" | "mainnet";
  }): Promise<[TInstruction | null, unknown, unknown, TLookupTable[]]>;
}

export interface BuildSwitchboardPullFeedUpdateParams<
  TInstruction = unknown,
  TLookupTable = unknown,
> {
  pullFeed: SwitchboardPullFeedLike<TInstruction, TLookupTable>;
  crossbarClient: unknown;
  chain?: "solana";
  network?: "devnet" | "mainnet";
}

export async function buildSwitchboardPullFeedUpdate<
  TInstruction = unknown,
  TLookupTable = unknown,
>(
  params: BuildSwitchboardPullFeedUpdateParams<TInstruction, TLookupTable>
): Promise<{ updateInstructions: TInstruction[]; lookupTables: TLookupTable[] }> {
  const [pullIx, _responses, _success, luts] = await params.pullFeed.fetchUpdateIx({
    crossbarClient: params.crossbarClient,
    chain: params.chain ?? "solana",
    network: params.network,
  });

  const updateInstructions: TInstruction[] = pullIx ? [pullIx] : [];
  return {
    updateInstructions,
    lookupTables: luts ?? [],
  };
}
