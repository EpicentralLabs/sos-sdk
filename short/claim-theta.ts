import { getClaimThetaInstructionAsync } from "../generated/instructions";
import type { Instruction } from "@solana/kit";
import { toAddress } from "../client/program";
import type { AddressLike, BuiltTransaction } from "../client/types";

export interface BuildClaimThetaParams {
  optionPool: AddressLike;
  writerPosition?: AddressLike;
  writerPaymentAccount: AddressLike;
  premiumVault: AddressLike;
  writer: AddressLike;
  tokenProgram?: AddressLike;
}

export async function buildClaimThetaInstruction(
  params: BuildClaimThetaParams
): Promise<Instruction<string>> {
  return getClaimThetaInstructionAsync({
    optionPool: toAddress(params.optionPool),
    writerPosition: params.writerPosition ? toAddress(params.writerPosition) : undefined,
    writerPaymentAccount: toAddress(params.writerPaymentAccount),
    premiumVault: toAddress(params.premiumVault),
    writer: toAddress(params.writer) as any,
    tokenProgram: params.tokenProgram ? toAddress(params.tokenProgram) : undefined,
  });
}

/**
 * Builds a theta claim transaction for a writer's position.
 * Writers claim their reserved theta (time-decay share) only.
 * `writerPosition` is optional and can be derived by the generated instruction helper.
 */
export async function buildClaimThetaTransaction(
  params: BuildClaimThetaParams
): Promise<BuiltTransaction> {
  const instruction = await buildClaimThetaInstruction(params);
  return { instructions: [instruction] };
}
