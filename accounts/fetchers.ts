import {
  getCollateralPoolDecoder,
  getLenderPositionDecoder,
  getMarketDataAccountDecoder,
  getOptionAccountDecoder,
  getOptionPoolDecoder,
  getPoolLoanDecoder,
  getPositionAccountDecoder,
  getVaultDecoder,
  getWriterPositionDecoder,
  type CollateralPool,
  type LenderPosition,
  type MarketDataAccount,
  type OptionAccount,
  type OptionPool,
  type PoolLoan,
  type PositionAccount,
  type Vault,
  type WriterPosition,
} from "../generated/accounts";
import type { Address } from "@solana/kit";
import { toAddress } from "../client/program";
import type { AddressLike, KitRpc } from "../client/types";

async function fetchRawAccount(
  rpc: KitRpc,
  address: AddressLike
): Promise<Uint8Array | null> {
  const response = await rpc.getAccountInfo(toAddress(address), { encoding: "base64" }).send();
  const accountInfo = response.value;
  if (!accountInfo) return null;
  const [data] = accountInfo.data;
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function decodeAccount<T>(
  rpc: KitRpc,
  address: AddressLike,
  decoder: { decode: (value: Uint8Array) => T }
): Promise<T | null> {
  const data = await fetchRawAccount(rpc, address);
  if (!data) return null;
  return decoder.decode(data);
}

export async function fetchOptionAccount(
  rpc: KitRpc,
  optionAccount: AddressLike
): Promise<OptionAccount | null> {
  return decodeAccount(rpc, optionAccount, getOptionAccountDecoder());
}

export async function fetchOptionPool(
  rpc: KitRpc,
  optionPool: AddressLike
): Promise<OptionPool | null> {
  return decodeAccount(rpc, optionPool, getOptionPoolDecoder());
}

export async function fetchCollateralPool(
  rpc: KitRpc,
  collateralPool: AddressLike
): Promise<CollateralPool | null> {
  return decodeAccount(rpc, collateralPool, getCollateralPoolDecoder());
}

export async function fetchWriterPosition(
  rpc: KitRpc,
  writerPosition: AddressLike
): Promise<WriterPosition | null> {
  return decodeAccount(rpc, writerPosition, getWriterPositionDecoder());
}

export async function fetchLenderPosition(
  rpc: KitRpc,
  lenderPosition: AddressLike
): Promise<LenderPosition | null> {
  return decodeAccount(rpc, lenderPosition, getLenderPositionDecoder());
}

export async function fetchBuyerPosition(
  rpc: KitRpc,
  buyerPosition: AddressLike
): Promise<PositionAccount | null> {
  return decodeAccount(rpc, buyerPosition, getPositionAccountDecoder());
}

export async function fetchVault(
  rpc: KitRpc,
  vault: AddressLike
): Promise<Vault | null> {
  return decodeAccount(rpc, vault, getVaultDecoder());
}

export async function fetchMarketDataAccount(
  rpc: KitRpc,
  marketData: AddressLike
): Promise<MarketDataAccount | null> {
  return decodeAccount(rpc, marketData, getMarketDataAccountDecoder());
}

export async function fetchPoolLoan(
  rpc: KitRpc,
  poolLoan: AddressLike
): Promise<PoolLoan | null> {
  return decodeAccount(rpc, poolLoan, getPoolLoanDecoder());
}

export async function accountExists(
  rpc: KitRpc,
  address: AddressLike
): Promise<boolean> {
  const response = await rpc.getAccountInfo(toAddress(address), { encoding: "base64" }).send();
  return response.value !== null;
}

export async function fetchManyAccounts(
  rpc: KitRpc,
  addresses: AddressLike[]
): Promise<Array<{ address: Address; exists: boolean }>> {
  const keys = addresses.map((value) => toAddress(value));
  const response = await rpc.getMultipleAccounts(keys, { encoding: "base64" }).send();
  const infos = response.value;
  return keys.map((key, index) => ({
    address: key,
    exists: infos[index] !== null,
  }));
}
