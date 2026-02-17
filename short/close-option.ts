import { getCloseOptionInstruction } from "../generated/instructions";
import type { Instruction } from "@solana/kit";
import { toAddress } from "../client/program";
import type { AddressLike, BuiltTransaction } from "../client/types";

export interface BuildCloseOptionParams {
  optionAccount: AddressLike;
  optionMint: AddressLike;
  makerOptionAccount: AddressLike;
  maker: AddressLike;
  tokenProgram?: AddressLike;
}

export function buildCloseOptionInstruction(
  params: BuildCloseOptionParams
): Instruction<string> {
  return getCloseOptionInstruction({
    optionAccount: toAddress(params.optionAccount),
    optionMint: toAddress(params.optionMint),
    makerOptionAccount: toAddress(params.makerOptionAccount),
    maker: toAddress(params.maker) as any,
    tokenProgram: params.tokenProgram ? toAddress(params.tokenProgram) : undefined,
  });
}

/**
 * Builds the close-option transaction instruction set for a maker.
 */
export function buildCloseOptionTransaction(
  params: BuildCloseOptionParams
): BuiltTransaction {
  const instruction = buildCloseOptionInstruction(params);
  return { instructions: [instruction] };
}
