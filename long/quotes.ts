import { assertPositiveAmount } from "../shared/amounts";
import { SdkValidationError } from "../shared/errors";

export function applySlippageBps(amount: bigint | number, slippageBps: number): bigint {
  if (slippageBps < 0) {
    throw new SdkValidationError("slippageBps cannot be negative.");
  }

  const base = BigInt(amount);
  return (base * BigInt(10_000 + slippageBps)) / 10_000n;
}

export function applyMinSlippageBps(amount: bigint | number, slippageBps: number): bigint {
  if (slippageBps < 0) {
    throw new SdkValidationError("slippageBps cannot be negative.");
  }

  const base = BigInt(amount);
  return (base * BigInt(10_000 - slippageBps)) / 10_000n;
}

export function buildBuyQuote(params: {
  quantity: bigint | number;
  premiumPerContract: bigint | number;
  maxSlippageBps: number;
}): { expectedPremium: bigint; maxPremium: bigint } {
  assertPositiveAmount(params.quantity, "quantity");
  assertPositiveAmount(params.premiumPerContract, "premiumPerContract");

  const expectedPremium = BigInt(params.quantity) * BigInt(params.premiumPerContract);
  return {
    expectedPremium,
    maxPremium: applySlippageBps(expectedPremium, params.maxSlippageBps),
  };
}

export function buildCloseQuote(params: {
  expectedPayout: bigint | number;
  maxSlippageBps: number;
}): { expectedPayout: bigint; minPayout: bigint } {
  assertPositiveAmount(params.expectedPayout, "expectedPayout");

  const expectedPayout = BigInt(params.expectedPayout);
  return {
    expectedPayout,
    minPayout: applyMinSlippageBps(expectedPayout, params.maxSlippageBps),
  };
}
