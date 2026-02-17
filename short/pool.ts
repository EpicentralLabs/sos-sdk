import {
  getBorrowFromPoolInstructionAsync,
  getDepositToPoolInstructionAsync,
  getRepayPoolLoanInstructionAsync,
  getRepayPoolLoanFromCollateralInstructionAsync,
  getWithdrawFromPoolInstructionAsync,
} from "../../../clients/ts/src/generated/instructions";
import type { Instruction } from "@solana/kit";
import { toAddress } from "../client/program";
import type { AddressLike, BuiltTransaction } from "../client/types";
import { assertNonNegativeAmount, assertPositiveAmount } from "../shared/amounts";

export interface BuildDepositToPoolParams {
  optionPool: AddressLike;
  optionAccount: AddressLike;
  makerOptionAccount: AddressLike;
  escrowLongAccount: AddressLike;
  maker: AddressLike;
  amount: bigint | number;
  makerPoolShare?: AddressLike;
  tokenProgram?: AddressLike;
  associatedTokenProgram?: AddressLike;
  systemProgram?: AddressLike;
}

export interface BuildWithdrawFromPoolParams {
  optionPool: AddressLike;
  optionAccount: AddressLike;
  makerOptionAccount: AddressLike;
  escrowLongAccount: AddressLike;
  maker: AddressLike;
  amount: bigint | number;
  makerPoolShare?: AddressLike;
  tokenProgram?: AddressLike;
}

export interface BuildBorrowFromPoolParams {
  vault: AddressLike;
  vaultTokenAccount: AddressLike;
  escrowTokenAccount: AddressLike;
  collateralMint: AddressLike;
  maker: AddressLike;
  nonce: bigint | number;
  borrowAmount: bigint | number;
  collateralAmount: bigint | number;
  poolLoan?: AddressLike;
  escrowState?: AddressLike;
  escrowAuthority?: AddressLike;
  tokenProgram?: AddressLike;
  systemProgram?: AddressLike;
}

export interface BuildRepayPoolLoanParams {
  poolLoan: AddressLike;
  vault: AddressLike;
  vaultTokenAccount: AddressLike;
  escrowState: AddressLike;
  escrowTokenAccount: AddressLike;
  makerTokenAccount: AddressLike;
  feeWalletTokenAccount: AddressLike;
  maker: AddressLike;
  escrowAuthority?: AddressLike;
  tokenProgram?: AddressLike;
}

export interface BuildRepayPoolLoanFromCollateralParams {
  poolLoan: AddressLike;
  vault: AddressLike;
  vaultTokenAccount: AddressLike;
  optionAccount: AddressLike;
  optionPool: AddressLike;
  collateralVault: AddressLike;
  writerPosition: AddressLike;
  feeWalletTokenAccount: AddressLike;
  maker: AddressLike;
  collateralPool?: AddressLike;
  tokenProgram?: AddressLike;
}

export async function buildDepositToPoolInstruction(
  params: BuildDepositToPoolParams
): Promise<Instruction<string>> {
  assertPositiveAmount(params.amount, "amount");

  return getDepositToPoolInstructionAsync({
    optionPool: toAddress(params.optionPool),
    optionAccount: toAddress(params.optionAccount),
    makerPoolShare: params.makerPoolShare ? toAddress(params.makerPoolShare) : undefined,
    makerOptionAccount: toAddress(params.makerOptionAccount),
    escrowLongAccount: toAddress(params.escrowLongAccount),
    maker: toAddress(params.maker) as any,
    tokenProgram: params.tokenProgram ? toAddress(params.tokenProgram) : undefined,
    associatedTokenProgram: params.associatedTokenProgram
      ? toAddress(params.associatedTokenProgram)
      : undefined,
    systemProgram: params.systemProgram ? toAddress(params.systemProgram) : undefined,
    amount: params.amount,
  });
}

export async function buildDepositToPoolTransaction(
  params: BuildDepositToPoolParams
): Promise<BuiltTransaction> {
  const instruction = await buildDepositToPoolInstruction(params);
  return { instructions: [instruction] };
}

export async function buildWithdrawFromPoolInstruction(
  params: BuildWithdrawFromPoolParams
): Promise<Instruction<string>> {
  assertPositiveAmount(params.amount, "amount");

  return getWithdrawFromPoolInstructionAsync({
    optionPool: toAddress(params.optionPool),
    optionAccount: toAddress(params.optionAccount),
    makerPoolShare: params.makerPoolShare ? toAddress(params.makerPoolShare) : undefined,
    makerOptionAccount: toAddress(params.makerOptionAccount),
    escrowLongAccount: toAddress(params.escrowLongAccount),
    maker: toAddress(params.maker) as any,
    tokenProgram: params.tokenProgram ? toAddress(params.tokenProgram) : undefined,
    amount: params.amount,
  });
}

/**
 * Builds a pool withdraw instruction set for an LP maker position.
 */
export async function buildWithdrawFromPoolTransaction(
  params: BuildWithdrawFromPoolParams
): Promise<BuiltTransaction> {
  const instruction = await buildWithdrawFromPoolInstruction(params);
  return { instructions: [instruction] };
}

export async function buildBorrowFromPoolInstruction(
  params: BuildBorrowFromPoolParams
): Promise<Instruction<string>> {
  assertNonNegativeAmount(params.nonce, "nonce");
  assertPositiveAmount(params.borrowAmount, "borrowAmount");
  assertPositiveAmount(params.collateralAmount, "collateralAmount");

  return getBorrowFromPoolInstructionAsync({
    poolLoan: params.poolLoan ? toAddress(params.poolLoan) : undefined,
    vault: toAddress(params.vault),
    vaultTokenAccount: toAddress(params.vaultTokenAccount),
    escrowState: params.escrowState ? toAddress(params.escrowState) : undefined,
    escrowAuthority: params.escrowAuthority ? toAddress(params.escrowAuthority) : undefined,
    escrowTokenAccount: toAddress(params.escrowTokenAccount),
    collateralMint: toAddress(params.collateralMint),
    maker: toAddress(params.maker) as any,
    tokenProgram: params.tokenProgram ? toAddress(params.tokenProgram) : undefined,
    systemProgram: params.systemProgram ? toAddress(params.systemProgram) : undefined,
    nonce: params.nonce,
    borrowAmount: params.borrowAmount,
    collateralAmount: params.collateralAmount,
  });
}

/**
 * Builds the borrow transaction instruction set for pool leverage.
 */
export async function buildBorrowFromPoolTransaction(
  params: BuildBorrowFromPoolParams
): Promise<BuiltTransaction> {
  const instruction = await buildBorrowFromPoolInstruction(params);
  return { instructions: [instruction] };
}

export async function buildRepayPoolLoanInstruction(
  params: BuildRepayPoolLoanParams
): Promise<Instruction<string>> {
  return getRepayPoolLoanInstructionAsync({
    poolLoan: toAddress(params.poolLoan),
    vault: toAddress(params.vault),
    vaultTokenAccount: toAddress(params.vaultTokenAccount),
    escrowState: toAddress(params.escrowState),
    escrowAuthority: params.escrowAuthority
      ? toAddress(params.escrowAuthority)
      : undefined,
    escrowTokenAccount: toAddress(params.escrowTokenAccount),
    makerTokenAccount: toAddress(params.makerTokenAccount),
    feeWalletTokenAccount: toAddress(params.feeWalletTokenAccount),
    maker: toAddress(params.maker) as any,
    tokenProgram: params.tokenProgram ? toAddress(params.tokenProgram) : undefined,
  });
}

/**
 * Builds the repay loan instruction set.
 */
export async function buildRepayPoolLoanTransaction(
  params: BuildRepayPoolLoanParams
): Promise<BuiltTransaction> {
  const instruction = await buildRepayPoolLoanInstruction(params);
  return { instructions: [instruction] };
}

export async function buildRepayPoolLoanFromCollateralInstruction(
  params: BuildRepayPoolLoanFromCollateralParams
): Promise<Instruction<string>> {
  return getRepayPoolLoanFromCollateralInstructionAsync({
    poolLoan: toAddress(params.poolLoan),
    vault: toAddress(params.vault),
    vaultTokenAccount: toAddress(params.vaultTokenAccount),
    optionAccount: toAddress(params.optionAccount),
    optionPool: toAddress(params.optionPool),
    collateralPool: params.collateralPool ? toAddress(params.collateralPool) : undefined,
    collateralVault: toAddress(params.collateralVault),
    writerPosition: toAddress(params.writerPosition),
    feeWalletTokenAccount: toAddress(params.feeWalletTokenAccount),
    maker: toAddress(params.maker) as any,
    tokenProgram: params.tokenProgram ? toAddress(params.tokenProgram) : undefined,
  });
}

/**
 * Builds the repay-from-collateral instruction set.
 */
export async function buildRepayPoolLoanFromCollateralTransaction(
  params: BuildRepayPoolLoanFromCollateralParams
): Promise<BuiltTransaction> {
  const instruction = await buildRepayPoolLoanFromCollateralInstruction(params);
  return { instructions: [instruction] };
}
