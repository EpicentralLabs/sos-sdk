import {
  getBuyFromPoolInstructionAsync,
  getCloseLongToPoolInstructionAsync,
} from "../generated/instructions";
import type { Instruction } from "@solana/kit";
import { toAddress } from "../client/program";
import type { AddressLike, BuiltTransaction, KitRpc } from "../client/types";
import { resolveOptionAccounts } from "../accounts/resolve-option";
import {
  deriveAssociatedTokenAddress,
  deriveBuyerPositionPda,
} from "../accounts/pdas";
import { assertNonNegativeAmount, assertPositiveAmount } from "../shared/amounts";
import { invariant } from "../shared/errors";
import {
  appendRemainingAccounts,
  type RemainingAccountInput,
} from "../shared/remaining-accounts";
import type { OptionType } from "../generated/types";
import { getCreateAssociatedTokenIdempotentInstructionWithAddress, NATIVE_MINT } from "../wsol/instructions";
import { fetchOptionPool } from "../accounts/fetchers";
import { getBuyFromPoolRemainingAccounts } from "./remaining-accounts";
import { fetchWriterPositionsForPool } from "../accounts/list";

export interface BuildBuyFromPoolParams {
  optionPool: AddressLike;
  optionAccount: AddressLike;
  longMint: AddressLike;
  underlyingMint: AddressLike;
  marketData: AddressLike;
  priceUpdate: AddressLike;
  buyer: AddressLike;
  buyerPaymentAccount: AddressLike;
  escrowLongAccount: AddressLike;
  premiumVault: AddressLike;
  quantity: bigint | number;
  premiumAmount: bigint | number;
  buyerPosition?: AddressLike;
  buyerOptionAccount?: AddressLike;
  remainingAccounts?: RemainingAccountInput[];
}

export interface BuildCloseLongToPoolParams {
  optionPool: AddressLike;
  optionAccount: AddressLike;
  collateralPool: AddressLike;
  underlyingMint: AddressLike;
  longMint: AddressLike;
  escrowLongAccount: AddressLike;
  premiumVault: AddressLike;
  marketData: AddressLike;
  priceUpdate: AddressLike;
  buyer: AddressLike;
  buyerLongAccount: AddressLike;
  buyerPayoutAccount: AddressLike;
  collateralVault: AddressLike;
  quantity: bigint | number;
  minPayoutAmount: bigint | number;
  buyerPosition?: AddressLike;
  omlpVault?: AddressLike;
  remainingAccounts?: RemainingAccountInput[];
}

export async function buildBuyFromPoolInstruction(
  params: BuildBuyFromPoolParams
): Promise<Instruction<string>> {
  assertPositiveAmount(params.quantity, "quantity");
  assertPositiveAmount(params.premiumAmount, "premiumAmount");

  const kitInstruction = await getBuyFromPoolInstructionAsync({
    optionPool: toAddress(params.optionPool),
    optionAccount: toAddress(params.optionAccount),
    longMint: toAddress(params.longMint),
    underlyingMint: toAddress(params.underlyingMint),
    marketData: toAddress(params.marketData),
    priceUpdate: toAddress(params.priceUpdate),
    buyer: toAddress(params.buyer) as any,
    buyerPosition: params.buyerPosition ? toAddress(params.buyerPosition) : undefined,
    buyerOptionAccount: params.buyerOptionAccount
      ? toAddress(params.buyerOptionAccount)
      : undefined,
    buyerPaymentAccount: toAddress(params.buyerPaymentAccount),
    escrowLongAccount: toAddress(params.escrowLongAccount),
    premiumVault: toAddress(params.premiumVault),
    quantity: params.quantity,
    premiumAmount: params.premiumAmount,
  });

  return appendRemainingAccounts(kitInstruction, params.remainingAccounts);
}

/**
 * Builds a buy-from-pool transaction. The returned transaction may include a
 * leading create-ATA-idempotent instruction for the buyer's option account so
 * first-time buyers succeed without a separate setup step.
 */
export async function buildBuyFromPoolTransaction(
  params: BuildBuyFromPoolParams
): Promise<BuiltTransaction> {
  const buyerOptionAccountAddress = params.buyerOptionAccount
    ? toAddress(params.buyerOptionAccount)
    : await deriveAssociatedTokenAddress(params.buyer, params.longMint);

  const createAtaIx =
    await getCreateAssociatedTokenIdempotentInstructionWithAddress(
      params.buyer,
      params.buyer,
      params.longMint,
      buyerOptionAccountAddress
    );

  const buyFromPoolIx = await buildBuyFromPoolInstruction(params);
  return { instructions: [createAtaIx, buyFromPoolIx] };
}

export interface BuildBuyFromPoolTransactionWithDerivationParams {
  underlyingAsset: AddressLike;
  optionType: OptionType;
  strikePrice: number;
  expirationDate: bigint | number;
  buyer: AddressLike;
  buyerPaymentAccount: AddressLike;
  priceUpdate: AddressLike;
  quantity: bigint | number;
  premiumAmount: bigint | number;
  rpc: KitRpc;
  programId?: AddressLike;
  buyerPosition?: AddressLike;
  buyerOptionAccount?: AddressLike;
  remainingAccounts?: RemainingAccountInput[];
}

const DEFAULT_MARKET_ORDER_SLIPPAGE_BUFFER_BASE_UNITS = 500_000n;

interface MarketOrderBufferLikeParams {
  slippageBufferBaseUnits?: bigint | number;
  slippageBufferLamports?: bigint | number;
}

function normalizeMarketOrderSlippageBuffer(
  params: MarketOrderBufferLikeParams,
  underlyingMint: AddressLike
): bigint {
  const hasBaseUnits = params.slippageBufferBaseUnits !== undefined;
  const hasLamports = params.slippageBufferLamports !== undefined;

  invariant(
    !(hasBaseUnits && hasLamports),
    "Provide only one of slippageBufferBaseUnits or slippageBufferLamports."
  );

  if (hasBaseUnits) {
    assertNonNegativeAmount(params.slippageBufferBaseUnits!, "slippageBufferBaseUnits");
    return BigInt(params.slippageBufferBaseUnits!);
  }

  if (hasLamports) {
    assertNonNegativeAmount(params.slippageBufferLamports!, "slippageBufferLamports");
    invariant(
      String(toAddress(underlyingMint)) === String(NATIVE_MINT),
      "slippageBufferLamports is only supported for SOL/WSOL underlyings. Use slippageBufferBaseUnits for other assets."
    );
    return BigInt(params.slippageBufferLamports!);
  }

  return DEFAULT_MARKET_ORDER_SLIPPAGE_BUFFER_BASE_UNITS;
}

export async function buildBuyFromPoolTransactionWithDerivation(
  params: BuildBuyFromPoolTransactionWithDerivationParams
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
    !!resolved.escrowLongAccount &&
      !!resolved.premiumVault &&
      !!resolved.underlyingMint,
    "Option pool must exist; ensure rpc is provided and pool is initialized."
  );

  const [buyerPosition, buyerOptionAccount] = await Promise.all([
    params.buyerPosition
      ? Promise.resolve(params.buyerPosition)
      : deriveBuyerPositionPda(
          params.buyer,
          resolved.optionAccount,
          params.programId
        ).then(([addr]) => addr),
    params.buyerOptionAccount
      ? Promise.resolve(params.buyerOptionAccount)
      : deriveAssociatedTokenAddress(params.buyer, resolved.longMint),
  ]);

  return buildBuyFromPoolTransaction({
    optionPool: resolved.optionPool,
    optionAccount: resolved.optionAccount,
    longMint: resolved.longMint,
    underlyingMint: resolved.underlyingMint!,
    marketData: resolved.marketData,
    priceUpdate: params.priceUpdate,
    buyer: params.buyer,
    buyerPaymentAccount: params.buyerPaymentAccount,
    escrowLongAccount: resolved.escrowLongAccount!,
    premiumVault: resolved.premiumVault!,
    quantity: params.quantity,
    premiumAmount: params.premiumAmount,
    buyerPosition,
    buyerOptionAccount,
    remainingAccounts: params.remainingAccounts,
  });
}

export interface BuildBuyFromPoolMarketOrderParams
  extends Omit<
      BuildBuyFromPoolTransactionWithDerivationParams,
      "premiumAmount" | "remainingAccounts"
    >,
    MarketOrderBufferLikeParams {
  quotedPremiumTotal: bigint | number;
}

/**
 * High-level market-order buy builder.
 * Refetches option pool and remaining writer-position accounts right before
 * build and sets max premium = quotedPremiumTotal + slippage buffer.
 */
export async function buildBuyFromPoolMarketOrderTransactionWithDerivation(
  params: BuildBuyFromPoolMarketOrderParams
): Promise<BuiltTransaction> {
  assertPositiveAmount(params.quantity, "quantity");
  assertPositiveAmount(params.quotedPremiumTotal, "quotedPremiumTotal");

  const resolved = await resolveOptionAccounts({
    underlyingAsset: params.underlyingAsset,
    optionType: params.optionType,
    strikePrice: params.strikePrice,
    expirationDate: params.expirationDate,
    programId: params.programId,
    rpc: params.rpc,
  });

  const [refetchedPool, remainingAccounts, buyerPosition, buyerOptionAccount] =
    await Promise.all([
      fetchOptionPool(params.rpc, resolved.optionPool),
      getBuyFromPoolRemainingAccounts(params.rpc, resolved.optionPool, params.programId),
      params.buyerPosition
        ? Promise.resolve(params.buyerPosition)
        : deriveBuyerPositionPda(
            params.buyer,
            resolved.optionAccount,
            params.programId
          ).then(([addr]) => addr),
      params.buyerOptionAccount
        ? Promise.resolve(params.buyerOptionAccount)
        : deriveAssociatedTokenAddress(params.buyer, resolved.longMint),
    ]);

  invariant(
    !!refetchedPool,
    "Option pool must exist; ensure rpc is provided and pool is initialized."
  );

  // Build-time coverage assertion: verify active writer liquidity >= requested quantity
  // This catches data staleness between preflight and build
  const quantity = BigInt(params.quantity);
  const writerPositions = await fetchWriterPositionsForPool(
    params.rpc,
    resolved.optionPool,
    params.programId
  );
  const activeUnsoldTotal = writerPositions
    .filter((p) => !p.data.isSettled && !p.data.isLiquidated && p.data.unsoldQty > 0n)
    .reduce((sum, p) => sum + p.data.unsoldQty, 0n);

  invariant(
    activeUnsoldTotal >= quantity,
    `Insufficient active writer liquidity: available=${activeUnsoldTotal}, requested=${quantity}. ` +
    `This may indicate data staleness - please refresh and retry.`
  );

  const slippageBuffer = normalizeMarketOrderSlippageBuffer(
    params,
    refetchedPool.underlyingMint
  );
  const maxPremiumAmount = BigInt(params.quotedPremiumTotal) + slippageBuffer;
  assertPositiveAmount(maxPremiumAmount, "maxPremiumAmount");

  return buildBuyFromPoolTransaction({
    optionPool: resolved.optionPool,
    optionAccount: resolved.optionAccount,
    longMint: resolved.longMint,
    underlyingMint: refetchedPool.underlyingMint,
    marketData: resolved.marketData,
    priceUpdate: params.priceUpdate,
    buyer: params.buyer,
    buyerPaymentAccount: params.buyerPaymentAccount,
    escrowLongAccount: refetchedPool.escrowLongAccount,
    premiumVault: refetchedPool.premiumVault,
    quantity: params.quantity,
    premiumAmount: maxPremiumAmount,
    buyerPosition,
    buyerOptionAccount,
    remainingAccounts,
  });
}

export async function buildCloseLongToPoolInstruction(
  params: BuildCloseLongToPoolParams
): Promise<Instruction<string>> {
  assertPositiveAmount(params.quantity, "quantity");
  invariant(
    BigInt(params.minPayoutAmount) >= 0n,
    "minPayoutAmount must be greater than or equal to zero."
  );

  const kitInstruction = await getCloseLongToPoolInstructionAsync({
    optionPool: toAddress(params.optionPool),
    optionAccount: toAddress(params.optionAccount),
    collateralPool: toAddress(params.collateralPool),
    underlyingMint: toAddress(params.underlyingMint),
    longMint: toAddress(params.longMint),
    escrowLongAccount: toAddress(params.escrowLongAccount),
    premiumVault: toAddress(params.premiumVault),
    marketData: toAddress(params.marketData),
    priceUpdate: toAddress(params.priceUpdate),
    buyer: toAddress(params.buyer) as any,
    buyerLongAccount: toAddress(params.buyerLongAccount),
    buyerPayoutAccount: toAddress(params.buyerPayoutAccount),
    collateralVault: toAddress(params.collateralVault),
    buyerPosition: params.buyerPosition ? toAddress(params.buyerPosition) : undefined,
    omlpVault: params.omlpVault ? toAddress(params.omlpVault) : undefined,
    quantity: params.quantity,
    minPayoutAmount: params.minPayoutAmount,
  });

  return appendRemainingAccounts(kitInstruction, params.remainingAccounts);
}

export async function buildCloseLongToPoolTransaction(
  params: BuildCloseLongToPoolParams
): Promise<BuiltTransaction> {
  const instruction = await buildCloseLongToPoolInstruction(params);
  return { instructions: [instruction] };
}

export interface BuildCloseLongToPoolTransactionWithDerivationParams {
  underlyingAsset: AddressLike;
  optionType: OptionType;
  strikePrice: number;
  expirationDate: bigint | number;
  buyer: AddressLike;
  buyerLongAccount: AddressLike;
  buyerPayoutAccount: AddressLike;
  priceUpdate: AddressLike;
  quantity: bigint | number;
  minPayoutAmount: bigint | number;
  rpc: KitRpc;
  programId?: AddressLike;
  buyerPosition?: AddressLike;
  omlpVault?: AddressLike;
  remainingAccounts?: RemainingAccountInput[];
}

export async function buildCloseLongToPoolTransactionWithDerivation(
  params: BuildCloseLongToPoolTransactionWithDerivationParams
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
    !!resolved.escrowLongAccount &&
      !!resolved.premiumVault &&
      !!resolved.collateralVault &&
      !!resolved.underlyingMint,
    "Option pool and collateral pool must exist; ensure rpc is provided and pools are initialized."
  );

  const buyerPosition = params.buyerPosition
    ? params.buyerPosition
    : (await deriveBuyerPositionPda(
        params.buyer,
        resolved.optionAccount,
        params.programId
      ))[0];

  return buildCloseLongToPoolTransaction({
    optionPool: resolved.optionPool,
    optionAccount: resolved.optionAccount,
    collateralPool: resolved.collateralPool,
    underlyingMint: resolved.underlyingMint!,
    longMint: resolved.longMint,
    escrowLongAccount: resolved.escrowLongAccount!,
    premiumVault: resolved.premiumVault!,
    marketData: resolved.marketData,
    priceUpdate: params.priceUpdate,
    buyer: params.buyer,
    buyerLongAccount: params.buyerLongAccount,
    buyerPayoutAccount: params.buyerPayoutAccount,
    collateralVault: resolved.collateralVault!,
    quantity: params.quantity,
    minPayoutAmount: params.minPayoutAmount,
    buyerPosition,
    omlpVault: params.omlpVault,
    remainingAccounts: params.remainingAccounts,
  });
}
