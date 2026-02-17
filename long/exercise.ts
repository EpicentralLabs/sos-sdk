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
 * Builds an option exercise transaction instruction set.
 * Use `priceUpdate` from a fresh Pyth receiver update for accurate exercise pricing.
 */
export function buildOptionExerciseTransaction(
  params: BuildOptionExerciseParams
): BuiltTransaction {
  const instruction = buildOptionExerciseInstruction(params);
  return { instructions: [instruction] };
}
