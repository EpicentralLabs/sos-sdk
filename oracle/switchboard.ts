import type { Address, Instruction } from "@solana/kit";
import { fromLegacyTransactionInstruction } from "@solana/compat";
import { CrossbarClient } from "@switchboard-xyz/common";
import {
  AnchorUtils,
  ON_DEMAND_DEVNET_PID,
  ON_DEMAND_MAINNET_PID,
  Queue,
} from "@switchboard-xyz/on-demand";
import { Connection } from "@solana/web3.js";
import bs58 from "bs58";
import { toAddress } from "../client/program";
import type { AddressLike, BuiltTransaction, KitRpc } from "../client/types";
import { fetchMarketDataAccount } from "../accounts/fetchers";
import { invariant } from "../shared/errors";

const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const MAINNET_BETA_GENESIS_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

export type SwitchboardNetwork = "devnet" | "mainnet";

export const SWITCHBOARD_DEFAULT_DEVNET_QUEUE =
  "EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7";
export const SWITCHBOARD_DEFAULT_MAINNET_QUEUE =
  "A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w";
export const SLOT_HASHES_SYSVAR_ADDRESS =
  "SysvarS1otHashes111111111111111111111111111";
export const INSTRUCTIONS_SYSVAR_ADDRESS =
  "Sysvar1nstructions1111111111111111111111111";

const KNOWN_FEED_ID_TO_ACCOUNT: Record<SwitchboardNetwork, Record<string, string>> = {
  devnet: {
    "0x822512ee9add93518eca1c105a38422841a76c590db079eebb283deb2c14caa9":
      "EneYGtye2n7jkSwGvQtwBaY6VBhP2mbizHD2y7hNkGFC",
    "0x883ea8295f70ae506e894679d124196bb07064ea530cefd835b58c33a5ab6549":
      "DHB2Ph8CK7PmR3xswqcmDkgQeucnwSZtfnMpnc7mQgkb",
  },
  mainnet: {
    "0x822512ee9add93518eca1c105a38422841a76c590db079eebb283deb2c14caa9":
      "4Hmd6PdjVA9auCoScE12iaBogfwS4ZXQ6VZoBeqanwWW",
    "0x883ea8295f70ae506e894679d124196bb07064ea530cefd835b58c33a5ab6549":
      "GckHmCwSyYvYDTJax4hhTzGMykV5JmgKDSaFkcnWPeU4",
  },
};

export async function resolveSwitchboardFeedFromMarketData(
  rpc: KitRpc,
  marketData: AddressLike
): Promise<Address> {
  const account = await fetchMarketDataAccount(rpc, marketData);
  invariant(!!account, "Market data account not found.");
  const feedBytes = Uint8Array.from(
    account.switchboardFeedId as unknown as Uint8Array
  );
  const feedIdHex = feedIdBytesToHex(feedBytes).toLowerCase();
  const network = await inferSwitchboardNetwork(rpc);
  const mappedFeedAccount = KNOWN_FEED_ID_TO_ACCOUNT[network][feedIdHex];
  if (mappedFeedAccount) {
    return toAddress(mappedFeedAccount);
  }

  // Backward compatibility for environments still storing feed account pubkey bytes.
  return toAddress(bs58.encode(Array.from(feedBytes)));
}

export function feedIdBytesToHex(feedIdBytes: Uint8Array): string {
  return `0x${Buffer.from(feedIdBytes).toString("hex")}`;
}

export async function resolveSwitchboardFeedIdFromMarketData(
  rpc: KitRpc,
  marketData: AddressLike
): Promise<string> {
  const account = await fetchMarketDataAccount(rpc, marketData);
  invariant(!!account, "Market data account not found.");
  return feedIdBytesToHex(
    Uint8Array.from(account.switchboardFeedId as unknown as Uint8Array)
  );
}

export interface BuildSwitchboardQuoteInstructionParams {
  rpcEndpoint: string;
  feedIdHex: string;
  network?: SwitchboardNetwork;
  crossbarUrl?: string;
  numSignatures?: number;
  instructionIdx?: number;
}

export interface SwitchboardQuoteInstructionResult {
  instruction: Instruction<string>;
  queueAddress: AddressLike;
}

export async function buildSwitchboardQuoteInstruction(
  params: BuildSwitchboardQuoteInstructionParams
): Promise<SwitchboardQuoteInstructionResult> {
  const network = params.network ?? "devnet";
  const normalizedFeedId = params.feedIdHex.startsWith("0x")
    ? params.feedIdHex
    : `0x${params.feedIdHex}`;

  const connection = new Connection(params.rpcEndpoint, "processed");
  const programId =
    network === "mainnet" ? ON_DEMAND_MAINNET_PID : ON_DEMAND_DEVNET_PID;
  const program = await AnchorUtils.loadProgramFromConnection(
    connection,
    undefined,
    programId
  );
  const queue = await Queue.loadDefault(program);

  const crossbar = params.crossbarUrl
    ? new CrossbarClient(params.crossbarUrl)
    : CrossbarClient.default();
  const quoteIx = await queue.fetchQuoteIx(crossbar, [normalizedFeedId], {
    numSignatures: params.numSignatures,
    instructionIdx: params.instructionIdx ?? 0,
    variableOverrides: {},
  });

  return {
    instruction: fromLegacyTransactionInstruction(quoteIx),
    queueAddress: toAddress(queue.pubkey.toBase58()),
  };
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
