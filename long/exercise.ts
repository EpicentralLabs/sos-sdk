import { getOptionExerciseInstruction } from "../generated/instructions";
import type { Instruction } from "@solana/kit";
import { toAddress } from "../client/program";
import type { AddressLike, BuiltTransaction } from "../client/types";

export interface BuildOptionExerciseParams {
  optionAccount: AddressLike;
  positionAccount: AddressLike;
  marketData: AddressLike;
  underlyingMint: AddressLike;
  priceUpdate: AddressLike;
  buyerPaymentAccount: AddressLike;
  makerCollateralAccount: AddressLike;
  escrowState: AddressLike;
  escrowTokenAccount: AddressLike;
  escrowAuthority: AddressLike;
  buyer: AddressLike;
  tokenProgram?: AddressLike;
}

/**
 * Legacy escrow-based option exercise. Prefer pool flows: close_long_to_pool and auto_exercise_expired.
 * @deprecated Use buildCloseLongToPoolTransaction for closing longs and rely on auto_exercise_expired for expiration.
 */
export function buildOptionExerciseInstruction(
  params: BuildOptionExerciseParams
): Instruction<string> {
  return getOptionExerciseInstruction({
    optionAccount: toAddress(params.optionAccount),
    positionAccount: toAddress(params.positionAccount),
    marketData: toAddress(params.marketData),
    underlyingMint: toAddress(params.underlyingMint),
    priceUpdate: toAddress(params.priceUpdate),
    buyerPaymentAccount: toAddress(params.buyerPaymentAccount),
    makerCollateralAccount: toAddress(params.makerCollateralAccount),
    escrowState: toAddress(params.escrowState),
    escrowTokenAccount: toAddress(params.escrowTokenAccount),
    escrowAuthority: toAddress(params.escrowAuthority),
    buyer: toAddress(params.buyer) as any,
    tokenProgram: params.tokenProgram ? toAddress(params.tokenProgram) : undefined,
  });
}

/**
 * Builds an option exercise transaction (escrow/ask-based flow).
 * Prefer pool-based flows: buildCloseLongToPoolTransaction for closing longs and auto_exercise_expired for expired ITM.
 * @deprecated Use buildCloseLongToPoolTransaction and auto_exercise_expired; do not use for new flows.
 */
export function buildOptionExerciseTransaction(
  params: BuildOptionExerciseParams
): BuiltTransaction {
  const instruction = buildOptionExerciseInstruction(params);
  return { instructions: [instruction] };
}
