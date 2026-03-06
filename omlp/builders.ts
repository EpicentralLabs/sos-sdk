import {
  getDepositToPositionInstructionAsync,
  getWithdrawFromPositionInstructionAsync,
} from "../generated/instructions";
import type { Instruction } from "@solana/kit";
import { toAddress } from "../client/program";
import type { AddressLike, BuiltTransaction, KitRpc } from "../client/types";
import { assertPositiveAmount } from "../shared/amounts";
import { getCloseAccountInstruction, NATIVE_MINT } from "../wsol/instructions";
import {
  buildSwitchboardCrank,
  prependSwitchboardCrank,
} from "../oracle/switchboard";

export interface BuildDepositToPositionParams {
  vault: AddressLike;
  lenderTokenAccount: AddressLike;
  vaultTokenAccount: AddressLike;
  lender: AddressLike;
  amount: bigint | number;
  position?: AddressLike;
  rpc?: KitRpc;
  switchboardFeed?: AddressLike;
  marketData?: AddressLike;
  disableSwitchboardCrank?: boolean;
  switchboardCrossbarUrl?: string;
  switchboardNumSignatures?: number;
}

export interface BuildWithdrawFromPositionParams {
  vault: AddressLike;
  vaultTokenAccount: AddressLike;
  lenderTokenAccount: AddressLike;
  lender: AddressLike;
  amount: bigint | number;
  position?: AddressLike;
  unwrapSol?: boolean;
  vaultMint?: AddressLike;
  rpc?: KitRpc;
  switchboardFeed?: AddressLike;
  marketData?: AddressLike;
  disableSwitchboardCrank?: boolean;
  switchboardCrossbarUrl?: string;
  switchboardNumSignatures?: number;
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
  const actionTx = { instructions: [instruction] };
  if (
    params.disableSwitchboardCrank ||
    !params.rpc ||
    (!params.switchboardFeed && !params.marketData)
  ) {
    return actionTx;
  }

  const crank = await buildSwitchboardCrank({
    rpc: params.rpc,
    payer: params.lender,
    switchboardFeed: params.switchboardFeed,
    marketData: params.marketData,
    crossbarUrl: params.switchboardCrossbarUrl,
    numSignatures: params.switchboardNumSignatures,
  });
  return prependSwitchboardCrank(crank, actionTx);
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
  const withdrawInstruction = await buildWithdrawFromPositionInstruction(params);
  const instructions: Instruction<string>[] = [withdrawInstruction];

  const shouldUnwrapSol =
    params.unwrapSol === true &&
    params.vaultMint !== undefined &&
    toAddress(params.vaultMint) === toAddress(NATIVE_MINT);

  if (shouldUnwrapSol) {
    instructions.push(
      getCloseAccountInstruction(
        params.lenderTokenAccount,
        params.lender,
        params.lender
      )
    );
  }

  const actionTx = { instructions };
  if (
    params.disableSwitchboardCrank ||
    !params.rpc ||
    (!params.switchboardFeed && !params.marketData)
  ) {
    return actionTx;
  }

  const crank = await buildSwitchboardCrank({
    rpc: params.rpc,
    payer: params.lender,
    switchboardFeed: params.switchboardFeed,
    marketData: params.marketData,
    crossbarUrl: params.switchboardCrossbarUrl,
    numSignatures: params.switchboardNumSignatures,
  });
  return prependSwitchboardCrank(crank, actionTx);
}
