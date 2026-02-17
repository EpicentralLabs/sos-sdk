import { address, type Address } from "@solana/kit";
import { OPTION_PROGRAM_PROGRAM_ADDRESS } from "../generated/programs";
import type { AddressLike } from "./types";

export const PROGRAM_ADDRESS = OPTION_PROGRAM_PROGRAM_ADDRESS;
export const PROGRAM_ID = address(OPTION_PROGRAM_PROGRAM_ADDRESS);
export const getProgramId = (): Address => PROGRAM_ID;
export const getProgramIdString = (): string => PROGRAM_ID;

export function toAddress(value: AddressLike): Address {
  return typeof value === "string" ? address(value) : value;
}
export { address };
