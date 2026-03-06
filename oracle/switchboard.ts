import type { Address, Instruction } from "@solana/kit";
import { fromLegacyTransactionInstruction } from "@solana/compat";
import { CrossbarClient } from "@switchboard-xyz/common";
import bs58 from "bs58";
import { toAddress } from "../client/program";
import type { AddressLike, BuiltTransaction, KitRpc } from "../client/types";
import { fetchMarketDataAccount } from "../accounts/fetchers";
import { invariant } from "../shared/errors";

const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const MAINNET_BETA_GENESIS_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

export type SwitchboardNetwork = "devnet" | "mainnet";

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

export interface BuildSwitchboardCrankParams {
  rpc: KitRpc;
  payer: AddressLike;
  switchboardFeed?: AddressLike;
  marketData?: AddressLike;
  network?: SwitchboardNetwork;
  crossbarUrl?: string;
  numSignatures?: number;
}

export interface SwitchboardCrankResult {
  instructions: Instruction<string>[];
  addressLookupTableAddresses: AddressLike[];
}

export async function inferSwitchboardNetwork(
  rpc: KitRpc
): Promise<SwitchboardNetwork> {
  const genesisHash = await rpc.getGenesisHash().send();
  if (genesisHash === DEVNET_GENESIS_HASH) {
    return "devnet";
  }
  if (genesisHash === MAINNET_BETA_GENESIS_HASH) {
    return "mainnet";
  }
  throw new Error(
    `Unable to infer Switchboard network from genesis hash: ${genesisHash}`
  );
}

export async function buildSwitchboardCrank(
  params: BuildSwitchboardCrankParams
): Promise<SwitchboardCrankResult> {
  const resolvedFeed =
    params.switchboardFeed ??
    (params.marketData
      ? await resolveSwitchboardFeedFromMarketData(params.rpc, params.marketData)
      : undefined);

  invariant(
    !!resolvedFeed,
    "switchboardFeed or marketData is required to build Switchboard crank instructions."
  );

  const network = params.network ?? (await inferSwitchboardNetwork(params.rpc));
  const crossbar = params.crossbarUrl
    ? new CrossbarClient(params.crossbarUrl)
    : CrossbarClient.default();
  const updates = await crossbar.fetchSolanaUpdates(
    network,
    [toAddress(resolvedFeed)],
    toAddress(params.payer),
    params.numSignatures
  );
  const update = updates[0];

  const instructions =
    update?.pullIxns?.map((instruction) =>
      fromLegacyTransactionInstruction(instruction)
    ) ?? [];
  const addressLookupTableAddresses = update?.lookupTables ?? [];

  return {
    instructions,
    addressLookupTableAddresses,
  };
}

export function prependSwitchboardCrank(
  crank: SwitchboardCrankResult,
  action: BuiltTransaction
): BuiltTransaction {
  return {
    instructions: [...crank.instructions, ...action.instructions],
    addressLookupTableAddresses: [
      ...(crank.addressLookupTableAddresses ?? []),
      ...(action.addressLookupTableAddresses ?? []),
    ],
  };
}
