import Decimal from "decimal.js";
import { SdkValidationError } from "./errors";

export function toBaseUnits(amount: Decimal.Value, decimals: number): bigint {
  const scaled = new Decimal(amount).mul(new Decimal(10).pow(decimals));
  return BigInt(scaled.floor().toFixed(0));
}

export function fromBaseUnits(amount: bigint | number, decimals: number): Decimal {
  return new Decimal(amount.toString()).div(new Decimal(10).pow(decimals));
}

export function assertPositiveAmount(value: bigint | number, label: string): void {
  const bigintValue = typeof value === "bigint" ? value : BigInt(value);
  if (bigintValue <= 0n) {
    throw new SdkValidationError(`${label} must be greater than zero.`);
  }
}

export function assertNonNegativeAmount(value: bigint | number, label: string): void {
  const bigintValue = typeof value === "bigint" ? value : BigInt(value);
  if (bigintValue < 0n) {
    throw new SdkValidationError(`${label} cannot be negative.`);
  }
}

export function calculateRequiredCollateral(
  quantity: bigint | number,
  strikePrice: number
): number {
  return Number(quantity) * 100 * strikePrice;
}
