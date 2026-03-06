import { getOptionExerciseInstruction } from "../generated/instructions";
import type { Instruction } from "@solana/kit";
import { toAddress } from "../client/program";
import type { AddressLike, BuiltTransaction, KitRpc } from "../client/types";
import {
  buildSwitchboardCrank,
  prependSwitchboardCrank,
} from "../oracle/switchboard";

export interface BuildOptionExerciseParams {
  optionAccount: AddressLike;
  positionAccount: AddressLike;
  marketData: AddressLike;
  underlyingMint: AddressLike;
  switchboardFeed: AddressLike;
  buyerPaymentAccount: AddressLike;
  makerCollateralAccount: AddressLike;
  escrowState: AddressLike;
  escrowTokenAccount: AddressLike;
  escrowAuthority: AddressLike;
  buyer: AddressLike;
  tokenProgram?: AddressLike;
  rpc?: KitRpc;
  disableSwitchboardCrank?: boolean;
  switchboardCrossbarUrl?: string;
  switchboardNumSignatures?: number;
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
    switchboardFeed: toAddress(params.switchboardFeed),
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
): Promise<BuiltTransaction> {
  const instruction = buildOptionExerciseInstruction(params);
  const actionTx = { instructions: [instruction] };
  if (params.disableSwitchboardCrank || !params.rpc) {
    return Promise.resolve(actionTx);
  }

  return buildSwitchboardCrank({
    rpc: params.rpc,
    payer: params.buyer,
    switchboardFeed: params.switchboardFeed,
    crossbarUrl: params.switchboardCrossbarUrl,
    numSignatures: params.switchboardNumSignatures,
  }).then((crank) => prependSwitchboardCrank(crank, actionTx));
}
