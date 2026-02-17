import {
  getBuyFromPoolInstructionAsync,
  getCloseLongToPoolInstructionAsync,
} from "../../../clients/ts/src/generated/instructions";
import type { Instruction } from "@solana/kit";
import { toAddress } from "../client/program";
import type { AddressLike, BuiltTransaction } from "../client/types";
import { assertPositiveAmount } from "../shared/amounts";
import { invariant } from "../shared/errors";
import {
  appendRemainingAccounts,
  type RemainingAccountInput,
} from "../shared/remaining-accounts";

export interface BuildBuyFromPoolParams {
  optionPool: AddressLike;
  optionAccount: AddressLike;
  longMint: AddressLike;
  underlyingMint: AddressLike;
  marketData: AddressLike;
  priceUpdate: AddressLike;
  buyer: AddressLike;
  buyerPaymentAccount: AddressLike;
  escrowLongAccount: AddressLike;
  premiumVault: AddressLike;
  quantity: bigint | number;
  premiumAmount: bigint | number;
  buyerPosition?: AddressLike;
  buyerOptionAccount?: AddressLike;
  remainingAccounts?: RemainingAccountInput[];
}

export interface BuildCloseLongToPoolParams {
  optionPool: AddressLike;
  optionAccount: AddressLike;
  collateralPool: AddressLike;
  underlyingMint: AddressLike;
  longMint: AddressLike;
  escrowLongAccount: AddressLike;
  premiumVault: AddressLike;
  marketData: AddressLike;
  priceUpdate: AddressLike;
  buyer: AddressLike;
  buyerLongAccount: AddressLike;
  buyerPayoutAccount: AddressLike;
  collateralVault: AddressLike;
  quantity: bigint | number;
  minPayoutAmount: bigint | number;
  buyerPosition?: AddressLike;
  omlpVault?: AddressLike;
  remainingAccounts?: RemainingAccountInput[];
}

export async function buildBuyFromPoolInstruction(
  params: BuildBuyFromPoolParams
): Promise<Instruction<string>> {
  assertPositiveAmount(params.quantity, "quantity");
  assertPositiveAmount(params.premiumAmount, "premiumAmount");

  const kitInstruction = await getBuyFromPoolInstructionAsync({
    optionPool: toAddress(params.optionPool),
    optionAccount: toAddress(params.optionAccount),
    longMint: toAddress(params.longMint),
    underlyingMint: toAddress(params.underlyingMint),
    marketData: toAddress(params.marketData),
    priceUpdate: toAddress(params.priceUpdate),
    buyer: toAddress(params.buyer) as any,
    buyerPosition: params.buyerPosition ? toAddress(params.buyerPosition) : undefined,
    buyerOptionAccount: params.buyerOptionAccount
      ? toAddress(params.buyerOptionAccount)
      : undefined,
    buyerPaymentAccount: toAddress(params.buyerPaymentAccount),
    escrowLongAccount: toAddress(params.escrowLongAccount),
    premiumVault: toAddress(params.premiumVault),
    quantity: params.quantity,
    premiumAmount: params.premiumAmount,
  });

  return appendRemainingAccounts(kitInstruction, params.remainingAccounts);
}

export async function buildBuyFromPoolTransaction(
  params: BuildBuyFromPoolParams
): Promise<BuiltTransaction> {
  const instruction = await buildBuyFromPoolInstruction(params);
  return { instructions: [instruction] };
}

export async function buildCloseLongToPoolInstruction(
  params: BuildCloseLongToPoolParams
): Promise<Instruction<string>> {
  assertPositiveAmount(params.quantity, "quantity");
  invariant(
    BigInt(params.minPayoutAmount) >= 0n,
    "minPayoutAmount must be greater than or equal to zero."
  );

  const kitInstruction = await getCloseLongToPoolInstructionAsync({
    optionPool: toAddress(params.optionPool),
    optionAccount: toAddress(params.optionAccount),
    collateralPool: toAddress(params.collateralPool),
    underlyingMint: toAddress(params.underlyingMint),
    longMint: toAddress(params.longMint),
    escrowLongAccount: toAddress(params.escrowLongAccount),
    premiumVault: toAddress(params.premiumVault),
    marketData: toAddress(params.marketData),
    priceUpdate: toAddress(params.priceUpdate),
    buyer: toAddress(params.buyer) as any,
    buyerLongAccount: toAddress(params.buyerLongAccount),
    buyerPayoutAccount: toAddress(params.buyerPayoutAccount),
    collateralVault: toAddress(params.collateralVault),
    buyerPosition: params.buyerPosition ? toAddress(params.buyerPosition) : undefined,
    omlpVault: params.omlpVault ? toAddress(params.omlpVault) : undefined,
    quantity: params.quantity,
    minPayoutAmount: params.minPayoutAmount,
  });

  return appendRemainingAccounts(kitInstruction, params.remainingAccounts);
}

export async function buildCloseLongToPoolTransaction(
  params: BuildCloseLongToPoolParams
): Promise<BuiltTransaction> {
  const instruction = await buildCloseLongToPoolInstruction(params);
  return { instructions: [instruction] };
}
