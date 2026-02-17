import { getClaimPremiumInstructionAsync } from "../generated/instructions";
import type { Instruction } from "@solana/kit";
import { toAddress } from "../client/program";
import type { AddressLike, BuiltTransaction } from "../client/types";

export interface BuildClaimPremiumParams {
  optionPool: AddressLike;
  makerPaymentAccount: AddressLike;
  premiumVault: AddressLike;
  maker: AddressLike;
  makerPoolShare?: AddressLike;
  tokenProgram?: AddressLike;
}

export async function buildClaimPremiumInstruction(
  params: BuildClaimPremiumParams
): Promise<Instruction<string>> {
  return getClaimPremiumInstructionAsync({
    optionPool: toAddress(params.optionPool),
    makerPoolShare: params.makerPoolShare ? toAddress(params.makerPoolShare) : undefined,
    makerPaymentAccount: toAddress(params.makerPaymentAccount),
    premiumVault: toAddress(params.premiumVault),
    maker: toAddress(params.maker) as any,
    tokenProgram: params.tokenProgram ? toAddress(params.tokenProgram) : undefined,
  });
}

/**
 * Builds a premium claim transaction for a maker's pool share.
 * `makerPoolShare` is optional and can be derived by the generated instruction helper.
 */
export async function buildClaimPremiumTransaction(
  params: BuildClaimPremiumParams
): Promise<BuiltTransaction> {
  const instruction = await buildClaimPremiumInstruction(params);
  return { instructions: [instruction] };
}
