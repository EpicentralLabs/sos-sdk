import {
  getOptionMintInstructionAsync,
  getSettleMakerCollateralInstructionAsync,
  getSyncWriterPositionInstruction,
  getUnwindWriterUnsoldInstructionAsync,
  type OptionType,
} from "../generated";
import type { Instruction } from "@solana/kit";
import { toAddress } from "../client/program";
import type { AddressLike, BuiltTransaction, KitRpc } from "../client/types";
import { resolveOptionAccounts } from "../accounts/resolve-option";
import {
  deriveAssociatedTokenAddress,
  deriveMakerCollateralSharePda,
  deriveMetadataPda,
  deriveWriterPositionPda,
} from "../accounts/pdas";
import { assertNonNegativeAmount, assertPositiveAmount } from "../shared/amounts";
import { invariant } from "../shared/errors";
import {
  appendRemainingAccounts,
  type RemainingAccountInput,
} from "../shared/remaining-accounts";

export interface BuildOptionMintParams {
  optionType: OptionType;
  strikePrice: number;
  expirationDate: bigint | number;
  quantity: bigint | number;
  underlyingAsset: AddressLike;
  underlyingSymbol: string;
  makerCollateralAmount: bigint | number;
  borrowedAmount: bigint | number;
  maker: AddressLike;
  makerCollateralAccount: AddressLike;
  underlyingMint: AddressLike;
  longMetadataAccount?: AddressLike;
  shortMetadataAccount?: AddressLike;
  optionAccount?: AddressLike;
  longMint?: AddressLike;
  shortMint?: AddressLike;
  mintAuthority?: AddressLike;
  makerLongAccount?: AddressLike;
  makerShortAccount?: AddressLike;
  marketData?: AddressLike;
  optionPool?: AddressLike;
  escrowLongAccount?: AddressLike;
  premiumVault?: AddressLike;
  collateralPool?: AddressLike;
  collateralVault?: AddressLike;
  writerPosition?: AddressLike;
  vault?: AddressLike;
  vaultTokenAccount?: AddressLike;
  escrowState?: AddressLike;
  escrowAuthority?: AddressLike;
  escrowTokenAccount?: AddressLike;
  poolLoan?: AddressLike;
  remainingAccounts?: RemainingAccountInput[];
}

export interface BuildUnwindWriterUnsoldParams {
  optionPool: AddressLike;
  optionAccount: AddressLike;
  longMint: AddressLike;
  shortMint: AddressLike;
  escrowLongAccount: AddressLike;
  writerShortAccount: AddressLike;
  collateralVault: AddressLike;
  writerCollateralAccount: AddressLike;
  writer: AddressLike;
  unwindQty: bigint | number;
  collateralPool?: AddressLike;
  writerPosition?: AddressLike;
  omlpVault?: AddressLike;
  feeWallet?: AddressLike;
  remainingAccounts?: RemainingAccountInput[];
}

export interface BuildSyncWriterPositionParams {
  optionPool: AddressLike;
  optionAccount: AddressLike;
  writerPosition: AddressLike;
}

export interface BuildSettleMakerCollateralParams {
  optionAccount: AddressLike;
  collateralVault: AddressLike;
  makerCollateralAccount: AddressLike;
  omlpVault: AddressLike;
  poolLoan: AddressLike;
  maker: AddressLike;
  makerCollateralShare?: AddressLike;
  collateralPool?: AddressLike;
}

export async function buildOptionMintInstruction(
  params: BuildOptionMintParams
): Promise<Instruction<string>> {
  assertPositiveAmount(params.quantity, "quantity");
  assertNonNegativeAmount(params.makerCollateralAmount, "makerCollateralAmount");
  assertNonNegativeAmount(params.borrowedAmount, "borrowedAmount");
  invariant(params.strikePrice > 0, "strikePrice must be greater than zero.");
  invariant(params.underlyingSymbol.length > 0, "underlyingSymbol is required.");

  const borrowedAmount = BigInt(params.borrowedAmount);
  if (borrowedAmount > 0n) {
    invariant(!!params.vault, "vault is required when borrowedAmount > 0");
    invariant(
      !!params.vaultTokenAccount,
      "vaultTokenAccount is required when borrowedAmount > 0"
    );
    invariant(!!params.escrowState, "escrowState is required when borrowedAmount > 0");
    invariant(
      !!params.escrowAuthority,
      "escrowAuthority is required when borrowedAmount > 0"
    );
    invariant(
      !!params.escrowTokenAccount,
      "escrowTokenAccount is required when borrowedAmount > 0"
    );
    invariant(!!params.poolLoan, "poolLoan is required when borrowedAmount > 0");
  }

  const [derivedLongMetadata, derivedShortMetadata] = await Promise.all([
    params.longMint ? deriveMetadataPda(params.longMint) : Promise.resolve(undefined),
    params.shortMint ? deriveMetadataPda(params.shortMint) : Promise.resolve(undefined),
  ]);
  const longMetadata = params.longMetadataAccount ?? derivedLongMetadata?.[0];
  const shortMetadata = params.shortMetadataAccount ?? derivedShortMetadata?.[0];

  invariant(
    !!longMetadata && !!shortMetadata,
    "longMetadataAccount and shortMetadataAccount are required (or provide longMint/shortMint to derive)."
  );

  const kitInstruction = await getOptionMintInstructionAsync({
    optionAccount: params.optionAccount ? toAddress(params.optionAccount) : undefined,
    longMint: params.longMint ? toAddress(params.longMint) : undefined,
    shortMint: params.shortMint ? toAddress(params.shortMint) : undefined,
    mintAuthority: params.mintAuthority ? toAddress(params.mintAuthority) : undefined,
    makerLongAccount: params.makerLongAccount
      ? toAddress(params.makerLongAccount)
      : undefined,
    makerShortAccount: params.makerShortAccount
      ? toAddress(params.makerShortAccount)
      : undefined,
    longMetadataAccount: toAddress(longMetadata!),
    shortMetadataAccount: toAddress(shortMetadata!),
    marketData: params.marketData ? toAddress(params.marketData) : undefined,
    underlyingMint: toAddress(params.underlyingMint),
    optionPool: params.optionPool ? toAddress(params.optionPool) : undefined,
    escrowLongAccount: params.escrowLongAccount
      ? toAddress(params.escrowLongAccount)
      : undefined,
    premiumVault: params.premiumVault ? toAddress(params.premiumVault) : undefined,
    collateralPool: params.collateralPool ? toAddress(params.collateralPool) : undefined,
    collateralVault: params.collateralVault ? toAddress(params.collateralVault) : undefined,
    makerCollateralAccount: toAddress(params.makerCollateralAccount),
    writerPosition: params.writerPosition ? toAddress(params.writerPosition) : undefined,
    vault: params.vault ? toAddress(params.vault) : undefined,
    vaultTokenAccount: params.vaultTokenAccount
      ? toAddress(params.vaultTokenAccount)
      : undefined,
    escrowState: params.escrowState ? toAddress(params.escrowState) : undefined,
    escrowAuthority: params.escrowAuthority ? toAddress(params.escrowAuthority) : undefined,
    escrowTokenAccount: params.escrowTokenAccount
      ? toAddress(params.escrowTokenAccount)
      : undefined,
    poolLoan: params.poolLoan ? toAddress(params.poolLoan) : undefined,
    maker: toAddress(params.maker) as any,
    optionType: params.optionType,
    strikePrice: params.strikePrice,
    expirationDate: params.expirationDate,
    quantity: params.quantity,
    underlyingAsset: toAddress(params.underlyingAsset),
    underlyingSymbol: params.underlyingSymbol,
    makerCollateralAmount: params.makerCollateralAmount,
    borrowedAmount: params.borrowedAmount,
  });

  return appendRemainingAccounts(kitInstruction, params.remainingAccounts);
}

export async function buildOptionMintTransaction(
  params: BuildOptionMintParams
): Promise<BuiltTransaction> {
  const instruction = await buildOptionMintInstruction(params);
  return { instructions: [instruction] };
}

export interface BuildOptionMintTransactionWithDerivationParams {
  underlyingAsset: AddressLike;
  optionType: OptionType;
  strikePrice: number;
  expirationDate: bigint | number;
  quantity: bigint | number;
  underlyingMint: AddressLike;
  underlyingSymbol: string;
  makerCollateralAmount: bigint | number;
  borrowedAmount: bigint | number;
  maker: AddressLike;
  makerCollateralAccount: AddressLike;
  rpc: KitRpc;
  programId?: AddressLike;
  vault?: AddressLike;
  vaultTokenAccount?: AddressLike;
  escrowState?: AddressLike;
  escrowAuthority?: AddressLike;
  escrowTokenAccount?: AddressLike;
  poolLoan?: AddressLike;
  remainingAccounts?: RemainingAccountInput[];
}

export async function buildOptionMintTransactionWithDerivation(
  params: BuildOptionMintTransactionWithDerivationParams
): Promise<BuiltTransaction> {
  const borrowedAmount = BigInt(params.borrowedAmount);
  if (borrowedAmount > 0n) {
    invariant(!!params.vault, "vault is required when borrowedAmount > 0");
    invariant(
      !!params.vaultTokenAccount,
      "vaultTokenAccount is required when borrowedAmount > 0"
    );
    invariant(!!params.escrowState, "escrowState is required when borrowedAmount > 0");
    invariant(
      !!params.escrowAuthority,
      "escrowAuthority is required when borrowedAmount > 0"
    );
    invariant(
      !!params.escrowTokenAccount,
      "escrowTokenAccount is required when borrowedAmount > 0"
    );
    invariant(!!params.poolLoan, "poolLoan is required when borrowedAmount > 0");
  }

  const resolved = await resolveOptionAccounts({
    underlyingAsset: params.underlyingAsset,
    optionType: params.optionType,
    strikePrice: params.strikePrice,
    expirationDate: params.expirationDate,
    programId: params.programId,
    rpc: params.rpc,
  });

  const underlyingMint = resolved.underlyingMint ?? params.underlyingMint;
  const [makerLongAccount, makerShortAccount] = await Promise.all([
    deriveAssociatedTokenAddress(params.maker, resolved.longMint),
    deriveAssociatedTokenAddress(params.maker, resolved.shortMint),
  ]);

  return buildOptionMintTransaction({
    ...params,
    underlyingAsset: params.underlyingAsset,
    underlyingMint,
    optionAccount: resolved.optionAccount,
    longMint: resolved.longMint,
    shortMint: resolved.shortMint,
    mintAuthority: resolved.mintAuthority,
    makerLongAccount,
    makerShortAccount,
    marketData: resolved.marketData,
    optionPool: resolved.optionPool,
    escrowLongAccount: resolved.escrowLongAccount,
    premiumVault: resolved.premiumVault,
    collateralPool: resolved.collateralPool,
    collateralVault: resolved.collateralVault,
    vault: params.vault,
    vaultTokenAccount: params.vaultTokenAccount,
    escrowState: params.escrowState,
    escrowAuthority: params.escrowAuthority,
    escrowTokenAccount: params.escrowTokenAccount,
    poolLoan: params.poolLoan,
    remainingAccounts: params.remainingAccounts,
  });
}

export async function buildUnwindWriterUnsoldInstruction(
  params: BuildUnwindWriterUnsoldParams
): Promise<Instruction<string>> {
  assertPositiveAmount(params.unwindQty, "unwindQty");

  const kitInstruction = await getUnwindWriterUnsoldInstructionAsync({
    optionPool: toAddress(params.optionPool),
    optionAccount: toAddress(params.optionAccount),
    collateralPool: params.collateralPool ? toAddress(params.collateralPool) : undefined,
    writerPosition: params.writerPosition ? toAddress(params.writerPosition) : undefined,
    longMint: toAddress(params.longMint),
    shortMint: toAddress(params.shortMint),
    escrowLongAccount: toAddress(params.escrowLongAccount),
    writerShortAccount: toAddress(params.writerShortAccount),
    collateralVault: toAddress(params.collateralVault),
    writerCollateralAccount: toAddress(params.writerCollateralAccount),
    omlpVault: params.omlpVault ? toAddress(params.omlpVault) : undefined,
    feeWallet: params.feeWallet ? toAddress(params.feeWallet) : undefined,
    writer: toAddress(params.writer) as any,
    unwindQty: params.unwindQty,
  });

  return appendRemainingAccounts(kitInstruction, params.remainingAccounts);
}

export async function buildUnwindWriterUnsoldTransaction(
  params: BuildUnwindWriterUnsoldParams
): Promise<BuiltTransaction> {
  const instruction = await buildUnwindWriterUnsoldInstruction(params);
  return { instructions: [instruction] };
}

export interface BuildUnwindWriterUnsoldTransactionWithDerivationParams {
  underlyingAsset: AddressLike;
  optionType: OptionType;
  strikePrice: number;
  expirationDate: bigint | number;
  writer: AddressLike;
  unwindQty: bigint | number;
  rpc: KitRpc;
  programId?: AddressLike;
  omlpVault?: AddressLike;
  feeWallet?: AddressLike;
  remainingAccounts?: RemainingAccountInput[];
}

export async function buildUnwindWriterUnsoldTransactionWithDerivation(
  params: BuildUnwindWriterUnsoldTransactionWithDerivationParams
): Promise<BuiltTransaction> {
  const resolved = await resolveOptionAccounts({
    underlyingAsset: params.underlyingAsset,
    optionType: params.optionType,
    strikePrice: params.strikePrice,
    expirationDate: params.expirationDate,
    programId: params.programId,
    rpc: params.rpc,
  });

  invariant(
    !!resolved.escrowLongAccount && !!resolved.collateralVault && !!resolved.underlyingMint,
    "Option pool and collateral pool must exist; ensure rpc is provided and pools are initialized."
  );

  const [writerShortAccount, writerCollateralAccount, writerPosition] =
    await Promise.all([
      deriveAssociatedTokenAddress(params.writer, resolved.shortMint),
      deriveAssociatedTokenAddress(params.writer, resolved.underlyingMint),
      deriveWriterPositionPda(resolved.optionPool, params.writer, params.programId),
    ]);

  return buildUnwindWriterUnsoldTransaction({
    optionPool: resolved.optionPool,
    optionAccount: resolved.optionAccount,
    longMint: resolved.longMint,
    shortMint: resolved.shortMint,
    escrowLongAccount: resolved.escrowLongAccount!,
    writerShortAccount,
    collateralVault: resolved.collateralVault!,
    writerCollateralAccount,
    writer: params.writer,
    unwindQty: params.unwindQty,
    collateralPool: resolved.collateralPool,
    writerPosition: writerPosition[0],
    omlpVault: params.omlpVault,
    feeWallet: params.feeWallet,
    remainingAccounts: params.remainingAccounts,
  });
}

export function buildSyncWriterPositionInstruction(
  params: BuildSyncWriterPositionParams
): Instruction<string> {
  const kitInstruction = getSyncWriterPositionInstruction({
    optionPool: toAddress(params.optionPool),
    optionAccount: toAddress(params.optionAccount),
    writerPosition: toAddress(params.writerPosition),
  });
  return kitInstruction;
}

export function buildSyncWriterPositionTransaction(
  params: BuildSyncWriterPositionParams
): BuiltTransaction {
  const instruction = buildSyncWriterPositionInstruction(params);
  return { instructions: [instruction] };
}

export async function buildSettleMakerCollateralInstruction(
  params: BuildSettleMakerCollateralParams
): Promise<Instruction<string>> {
  const makerCollateralShare =
    params.makerCollateralShare ??
    (params.collateralPool
      ? (await deriveMakerCollateralSharePda(params.collateralPool, params.maker))[0]
      : undefined);

  invariant(
    !!makerCollateralShare,
    "makerCollateralShare is required (or provide collateralPool + maker to derive)."
  );

  const kitInstruction = await getSettleMakerCollateralInstructionAsync({
    optionAccount: toAddress(params.optionAccount),
    collateralPool: params.collateralPool ? toAddress(params.collateralPool) : undefined,
    makerCollateralShare: toAddress(makerCollateralShare),
    collateralVault: toAddress(params.collateralVault),
    makerCollateralAccount: toAddress(params.makerCollateralAccount),
    omlpVault: toAddress(params.omlpVault),
    poolLoan: toAddress(params.poolLoan),
  });
  return kitInstruction;
}

export async function buildSettleMakerCollateralTransaction(
  params: BuildSettleMakerCollateralParams
): Promise<BuiltTransaction> {
  const instruction = await buildSettleMakerCollateralInstruction(params);
  return { instructions: [instruction] };
}
