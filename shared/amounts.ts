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

/**
 * Calculate required collateral for option position in token base units
 * Matches on-chain formula: ((qty / 1_000_000) * 100 * strike) / spot * 10^decimals
 * 
 * @param quantity - Option quantity in base units (1 contract = 1_000_000)
 * @param strikePrice - Strike price in USD
 * @param spotPrice - Current spot price of underlying in USD (from oracle)
 * @param tokenDecimals - Number of decimals for the underlying token (e.g., 9 for SOL)
 * @returns Required collateral in token base units
 */
export function calculateRequiredCollateral(
  quantity: bigint | number,
  strikePrice: number,
  spotPrice: number,
  tokenDecimals: number
): number {
  // Convert base units to contract count
  const contracts = Number(quantity) / 1_000_000;
  const contractSize = 100; // 1 contract = 100 units of underlying
  
  // USD value needed for collateral
  const usdRequired = contracts * contractSize * strikePrice;
  
  // Convert USD to token base units
  const baseUnits = 10 ** tokenDecimals;
  return (usdRequired / spotPrice) * baseUnits;
}
