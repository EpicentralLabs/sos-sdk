import bs58 from "bs58";
import type { Address } from "@solana/kit";
import {
  OPTION_POOL_DISCRIMINATOR,
  POOL_LOAN_DISCRIMINATOR,
  POSITION_ACCOUNT_DISCRIMINATOR,
  VAULT_DISCRIMINATOR,
  WRITER_POSITION_DISCRIMINATOR,
  getOptionPoolDecoder,
  getOptionPoolSize,
  getPoolLoanDecoder,
  getPoolLoanSize,
  getPositionAccountDecoder,
  getPositionAccountSize,
  getVaultDecoder,
  getVaultSize,
  getWriterPositionDecoder,
  getWriterPositionSize,
  type OptionPool,
  type PoolLoan,
  type PositionAccount,
  type Vault,
  type WriterPosition,
} from "../generated/accounts";
import { PROGRAM_ID, toAddress } from "../client/program";
import type { AddressLike, KitRpc } from "../client/types";

const DISCRIMINATOR_OFFSET = 0n;
const OWNER_OFFSET = 8n;
const ACTIVE_POOL_LOAN_STATUS = 1;

type ListedAccount<T> = {
  address: Address;
  data: T;
};

type ProgramAccountResponse = {
  pubkey: Address;
  account: {
    data: [string, string] | string;
  };
};

function decodeBase64Data(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function discriminatorFilter(discriminator: Uint8Array) {
  return {
    memcmp: {
      offset: DISCRIMINATOR_OFFSET,
      encoding: "base58",
      bytes: bs58.encode(discriminator),
    },
  } as const;
}

function ownerFilter(owner: AddressLike) {
  return {
    memcmp: {
      offset: OWNER_OFFSET,
      encoding: "base58",
      bytes: toAddress(owner),
    },
  } as const;
}

async function fetchAndDecodeProgramAccounts<T>(
  rpc: KitRpc,
  decoder: { decode: (value: Uint8Array) => T },
  filters: ReadonlyArray<unknown>
): Promise<Array<ListedAccount<T>>> {
  const response = await rpc
    .getProgramAccounts(PROGRAM_ID, {
      encoding: "base64",
      filters: filters as never,
    })
    .send();

  const rawAccounts = Array.isArray(response)
    ? (response as Array<ProgramAccountResponse>)
    : (response as { value: Array<ProgramAccountResponse> }).value;

  return rawAccounts.map(({ pubkey, account }) => {
    const base64Data =
      Array.isArray(account.data) ? account.data[0] : account.data;
    return {
      address: pubkey,
      data: decoder.decode(decodeBase64Data(base64Data)),
    };
  });
}

export async function fetchWriterPositionsByWriter(
  rpc: KitRpc,
  writer: AddressLike
): Promise<Array<ListedAccount<WriterPosition>>> {
  return fetchAndDecodeProgramAccounts(rpc, getWriterPositionDecoder(), [
    discriminatorFilter(WRITER_POSITION_DISCRIMINATOR),
    ownerFilter(writer),
    { dataSize: BigInt(getWriterPositionSize()) },
  ]);
}

export async function fetchPositionAccountsByBuyer(
  rpc: KitRpc,
  buyer: AddressLike
): Promise<Array<ListedAccount<PositionAccount>>> {
  return fetchAndDecodeProgramAccounts(rpc, getPositionAccountDecoder(), [
    discriminatorFilter(POSITION_ACCOUNT_DISCRIMINATOR),
    ownerFilter(buyer),
    { dataSize: BigInt(getPositionAccountSize()) },
  ]);
}

export async function fetchPoolLoansByMaker(
  rpc: KitRpc,
  maker: AddressLike
): Promise<Array<ListedAccount<PoolLoan>>> {
  const decoded = await fetchAndDecodeProgramAccounts(rpc, getPoolLoanDecoder(), [
    discriminatorFilter(POOL_LOAN_DISCRIMINATOR),
    ownerFilter(maker),
    { dataSize: BigInt(getPoolLoanSize()) },
  ]);
  return decoded.filter(
    (item: { address: Address; data: PoolLoan }) =>
      item.data.status === ACTIVE_POOL_LOAN_STATUS
  );
}

export async function fetchAllOptionPools(
  rpc: KitRpc
): Promise<Array<ListedAccount<OptionPool>>> {
  return fetchAndDecodeProgramAccounts(rpc, getOptionPoolDecoder(), [
    discriminatorFilter(OPTION_POOL_DISCRIMINATOR),
    { dataSize: BigInt(getOptionPoolSize()) },
  ]);
}

export async function fetchAllVaults(
  rpc: KitRpc
): Promise<Array<ListedAccount<Vault>>> {
  return fetchAndDecodeProgramAccounts(rpc, getVaultDecoder(), [
    discriminatorFilter(VAULT_DISCRIMINATOR),
    { dataSize: BigInt(getVaultSize()) },
  ]);
}
