import type { AddressLike, KitRpc } from "../client/types";
import type { OptionType } from "../generated/types";
import { fetchWriterPositionsForPool } from "../accounts/list";
import { resolveOptionAccounts } from "../accounts/resolve-option";
import { fetchOptionPool } from "../accounts/fetchers";
import { assertNonNegativeAmount, assertPositiveAmount } from "../shared/amounts";
import { invariant } from "../shared/errors";

function toBigInt(value: bigint | number): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

export interface PreflightBuyFromPoolMarketOrderParams {
  underlyingAsset: AddressLike;
  optionType: OptionType;
  strikePrice: number;
  expirationDate: bigint | number;
  quantity: bigint | number;
  rpc: KitRpc;
  programId?: AddressLike;
  quotedPremiumTotal?: bigint | number;
  slippageBufferBaseUnits?: bigint | number;
}

export interface BuyFromPoolMarketOrderPremiumSummary {
  quotedPremiumTotal: bigint;
  slippageBufferBaseUnits: bigint;
  maxPremiumAmount: bigint;
}

export interface PreflightBuyFromPoolMarketOrderResult {
  canBuy: boolean;
  reason?: string;
  poolTotalAvailable: bigint;
  requestedQuantity: bigint;
  remainingAccountsCount: number;
  remainingUnsoldAggregate: bigint;
  premium?: BuyFromPoolMarketOrderPremiumSummary;
}

export async function preflightBuyFromPoolMarketOrder(
  params: PreflightBuyFromPoolMarketOrderParams
): Promise<PreflightBuyFromPoolMarketOrderResult> {
  assertPositiveAmount(params.quantity, "quantity");
  const requestedQuantity = toBigInt(params.quantity);

  const resolved = await resolveOptionAccounts({
    underlyingAsset: params.underlyingAsset,
    optionType: params.optionType,
    strikePrice: params.strikePrice,
    expirationDate: params.expirationDate,
    programId: params.programId,
    rpc: params.rpc,
  });

  const [optionPool, writerPositions] = await Promise.all([
    fetchOptionPool(params.rpc, resolved.optionPool),
    fetchWriterPositionsForPool(params.rpc, resolved.optionPool, params.programId),
  ]);

  invariant(
    !!optionPool,
    "Option pool must exist; ensure rpc is provided and pool is initialized."
  );

  // Filter out inactive positions (settled, liquidated, or zero unsold)
  const activeWriterPositions = writerPositions.filter(
    ({ data }) => !data.isSettled && !data.isLiquidated && toBigInt(data.unsoldQty) > 0n
  );

  // Use active positions for coverage calculation
  const availableWriterPositions = activeWriterPositions;
  const remainingUnsoldAggregate = availableWriterPositions.reduce(
    (acc, { data }) => acc + toBigInt(data.unsoldQty),
    0n
  );
  const poolTotalAvailable = toBigInt(optionPool.totalAvailable);

  const hasPoolLiquidity = poolTotalAvailable >= requestedQuantity;
  const hasWriterCoverage = remainingUnsoldAggregate >= requestedQuantity;

  let reason: string | undefined;
  if (!hasPoolLiquidity) {
    reason = "Pool total_available is less than requested quantity.";
  } else if (!hasWriterCoverage) {
    reason =
      "Remaining writer-position liquidity is insufficient to fully fill requested quantity.";
  }

  const result: PreflightBuyFromPoolMarketOrderResult = {
    canBuy: hasPoolLiquidity && hasWriterCoverage,
    reason,
    poolTotalAvailable,
    requestedQuantity,
    remainingAccountsCount: availableWriterPositions.length,
    remainingUnsoldAggregate,
  };

  if (params.quotedPremiumTotal !== undefined) {
    assertPositiveAmount(params.quotedPremiumTotal, "quotedPremiumTotal");
    if (params.slippageBufferBaseUnits !== undefined) {
      assertNonNegativeAmount(params.slippageBufferBaseUnits, "slippageBufferBaseUnits");
    }
    const quotedPremiumTotal = toBigInt(params.quotedPremiumTotal);
    const slippageBufferBaseUnits =
      params.slippageBufferBaseUnits !== undefined
        ? toBigInt(params.slippageBufferBaseUnits)
        : 0n;

    result.premium = {
      quotedPremiumTotal,
      slippageBufferBaseUnits,
      maxPremiumAmount: quotedPremiumTotal + slippageBufferBaseUnits,
    };
  }

  return result;
}
