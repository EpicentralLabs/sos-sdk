import {
  getDepositToPositionInstructionAsync,
  getWithdrawFromPositionInstructionAsync,
} from "../../../clients/ts/src/generated/instructions";
import type { Instruction } from "@solana/kit";
import { toAddress } from "../client/program";
import type { AddressLike, BuiltTransaction } from "../client/types";
import { assertPositiveAmount } from "../shared/amounts";

export interface BuildDepositToPositionParams {
  vault: AddressLike;
  lenderTokenAccount: AddressLike;
  vaultTokenAccount: AddressLike;
  lender: AddressLike;
  amount: bigint | number;
  position?: AddressLike;
}

export interface BuildWithdrawFromPositionParams {
  vault: AddressLike;
  vaultTokenAccount: AddressLike;
  lenderTokenAccount: AddressLike;
  lender: AddressLike;
  amount: bigint | number;
  position?: AddressLike;
}

export async function buildDepositToPositionInstruction(
  params: BuildDepositToPositionParams
): Promise<Instruction<string>> {
  assertPositiveAmount(params.amount, "amount");

  const kitInstruction = await getDepositToPositionInstructionAsync({
    position: params.position ? toAddress(params.position) : undefined,
    vault: toAddress(params.vault),
    lenderTokenAccount: toAddress(params.lenderTokenAccount),
    vaultTokenAccount: toAddress(params.vaultTokenAccount),
    lender: toAddress(params.lender) as any,
    amount: params.amount,
  });

  return kitInstruction;
}

export async function buildDepositToPositionTransaction(
  params: BuildDepositToPositionParams
): Promise<BuiltTransaction> {
  const instruction = await buildDepositToPositionInstruction(params);
  return { instructions: [instruction] };
}

export async function buildWithdrawFromPositionInstruction(
  params: BuildWithdrawFromPositionParams
): Promise<Instruction<string>> {
  assertPositiveAmount(params.amount, "amount");

  const kitInstruction = await getWithdrawFromPositionInstructionAsync({
    position: params.position ? toAddress(params.position) : undefined,
    vault: toAddress(params.vault),
    vaultTokenAccount: toAddress(params.vaultTokenAccount),
    lenderTokenAccount: toAddress(params.lenderTokenAccount),
    lender: toAddress(params.lender) as any,
    amount: params.amount,
  });

  return kitInstruction;
}

export async function buildWithdrawFromPositionTransaction(
  params: BuildWithdrawFromPositionParams
): Promise<BuiltTransaction> {
  const instruction = await buildWithdrawFromPositionInstruction(params);
  return { instructions: [instruction] };
}
