import { address, getAddressEncoder, getProgramDerivedAddress, type Address } from "@solana/kit";
import { OptionType } from "../generated/types";
import { PROGRAM_ID, toAddress } from "../client/program";
import type { AddressLike } from "../client/types";

const METADATA_PROGRAM_ADDRESS = address("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const ASSOCIATED_TOKEN_PROGRAM_ADDRESS = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const TOKEN_PROGRAM_ADDRESS = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

function f64ToLeBytes(value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setFloat64(0, value, true);
  return bytes;
}

function i64ToLeBytes(value: bigint | number): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigInt64(0, BigInt(value), true);
  return bytes;
}

function u64ToLeBytes(value: bigint | number): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, BigInt(value), true);
  return bytes;
}

function optionTypeToU8(optionType: OptionType): number {
  return optionType === OptionType.Call ? 0 : 1;
}

export async function deriveOptionAccountPda(params: {
  underlyingAsset: AddressLike;
  optionType: OptionType;
  strikePrice: number;
  expirationDate: bigint | number;
  programId?: AddressLike;
}): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  const programAddress = params.programId ? toAddress(params.programId) : PROGRAM_ID;
  return getProgramDerivedAddress({
    programAddress,
    seeds: [
      new TextEncoder().encode("option"),
      addressEncoder.encode(toAddress(params.underlyingAsset)),
      Uint8Array.of(optionTypeToU8(params.optionType)),
      f64ToLeBytes(params.strikePrice),
      i64ToLeBytes(params.expirationDate),
    ],
  });
}

export async function deriveLongMintPda(
  optionAccount: AddressLike,
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [
      new TextEncoder().encode("long_mint"),
      addressEncoder.encode(toAddress(optionAccount)),
    ],
  });
}

export async function deriveShortMintPda(
  optionAccount: AddressLike,
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [
      new TextEncoder().encode("short_mint"),
      addressEncoder.encode(toAddress(optionAccount)),
    ],
  });
}

export async function deriveMintAuthorityPda(
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [new TextEncoder().encode("mint_authority")],
  });
}

export async function deriveConfigPda(
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [new TextEncoder().encode("config")],
  });
}

export async function deriveOptionPoolPda(
  optionAccount: AddressLike,
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [
      new TextEncoder().encode("option_pool"),
      addressEncoder.encode(toAddress(optionAccount)),
    ],
  });
}

export async function deriveCollateralPoolPda(
  optionAccount: AddressLike,
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [
      new TextEncoder().encode("collateral_pool"),
      addressEncoder.encode(toAddress(optionAccount)),
    ],
  });
}

export async function deriveWriterPositionPda(
  optionPool: AddressLike,
  writer: AddressLike,
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [
      new TextEncoder().encode("writer_position"),
      addressEncoder.encode(toAddress(optionPool)),
      addressEncoder.encode(toAddress(writer)),
    ],
  });
}

export async function deriveMakerCollateralSharePda(
  collateralPool: AddressLike,
  maker: AddressLike,
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [
      new TextEncoder().encode("maker_collateral_share"),
      addressEncoder.encode(toAddress(collateralPool)),
      addressEncoder.encode(toAddress(maker)),
    ],
  });
}

export async function deriveMakerPoolSharePda(
  optionPool: AddressLike,
  maker: AddressLike,
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [
      new TextEncoder().encode("maker_pool_share"),
      addressEncoder.encode(toAddress(optionPool)),
      addressEncoder.encode(toAddress(maker)),
    ],
  });
}

export async function deriveBuyerPositionPda(
  buyer: AddressLike,
  optionAccount: AddressLike,
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [
      new TextEncoder().encode("position"),
      addressEncoder.encode(toAddress(buyer)),
      addressEncoder.encode(toAddress(optionAccount)),
    ],
  });
}

export async function deriveMetadataPda(mint: AddressLike): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: METADATA_PROGRAM_ADDRESS,
    seeds: [
      new TextEncoder().encode("metadata"),
      addressEncoder.encode(METADATA_PROGRAM_ADDRESS),
      addressEncoder.encode(toAddress(mint)),
    ],
  });
}

export async function deriveMarketDataPda(
  underlyingAsset: AddressLike,
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [
      new TextEncoder().encode("market_data"),
      addressEncoder.encode(toAddress(underlyingAsset)),
    ],
  });
}

export async function deriveVaultPda(
  mint: AddressLike,
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [new TextEncoder().encode("vault"), addressEncoder.encode(toAddress(mint))],
  });
}

export async function deriveLenderPositionPda(
  vault: AddressLike,
  lender: AddressLike,
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [
      new TextEncoder().encode("lender_position"),
      addressEncoder.encode(toAddress(vault)),
      addressEncoder.encode(toAddress(lender)),
    ],
  });
}

export async function deriveEscrowStatePda(
  maker: AddressLike,
  collateralMint: AddressLike,
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [
      new TextEncoder().encode("escrow_v2"),
      addressEncoder.encode(toAddress(maker)),
      addressEncoder.encode(toAddress(collateralMint)),
    ],
  });
}

export async function deriveEscrowAuthorityPda(
  escrowState: AddressLike,
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [
      new TextEncoder().encode("escrow_authority_v2"),
      addressEncoder.encode(toAddress(escrowState)),
    ],
  });
}

export async function derivePoolLoanPda(
  writerPosition: AddressLike,
  nonce: bigint | number,
  programId: AddressLike = PROGRAM_ID
): Promise<readonly [Address, number]> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: toAddress(programId),
    seeds: [
      new TextEncoder().encode("pool_loan"),
      addressEncoder.encode(toAddress(writerPosition)),
      u64ToLeBytes(nonce),
    ],
  });
}

export async function deriveAssociatedTokenAddress(
  owner: AddressLike,
  mint: AddressLike,
  _allowOwnerOffCurve = false
): Promise<Address> {
  const addressEncoder = getAddressEncoder();
  const [associatedTokenAddress] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    seeds: [
      addressEncoder.encode(toAddress(owner)),
      addressEncoder.encode(TOKEN_PROGRAM_ADDRESS),
      addressEncoder.encode(toAddress(mint)),
    ],
  });
  return associatedTokenAddress;
}
