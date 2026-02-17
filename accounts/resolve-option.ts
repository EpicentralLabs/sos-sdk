import type { Address } from "@solana/kit";
import { OptionType } from "../generated/types";
import { toAddress } from "../client/program";
import type { AddressLike, KitRpc } from "../client/types";
import {
  deriveCollateralPoolPda,
  deriveLongMintPda,
  deriveMarketDataPda,
  deriveMintAuthorityPda,
  deriveOptionAccountPda,
  deriveOptionPoolPda,
  deriveShortMintPda,
} from "./pdas";
import { fetchCollateralPool, fetchOptionAccount, fetchOptionPool } from "./fetchers";

export interface ResolveOptionAccountsParams {
  underlyingAsset: AddressLike;
  optionType: OptionType;
  strikePrice: number;
  expirationDate: bigint | number;
  programId?: AddressLike;
  rpc?: KitRpc;
}

export interface ResolvedOptionAccounts {
  optionAccount: Address;
  longMint: Address;
  shortMint: Address;
  optionPool: Address;
  marketData: Address;
  collateralPool: Address;
  mintAuthority: Address;
  underlyingMint?: Address;
  escrowLongAccount?: Address;
  premiumVault?: Address;
  collateralVault?: Address;
  optionPoolData?: Awaited<ReturnType<typeof fetchOptionPool>>;
  optionAccountData?: Awaited<ReturnType<typeof fetchOptionAccount>>;
  collateralPoolData?: Awaited<ReturnType<typeof fetchCollateralPool>>;
}

/**
 * Resolves all derived and optionally fetched accounts for an option.
 * Given option identity (underlyingAsset, optionType, strikePrice, expirationDate),
 * returns PDAs and, when rpc is provided, fetches OptionPool and CollateralPool
 * to expose escrowLongAccount, premiumVault, collateralVault, underlyingMint.
 */
export async function resolveOptionAccounts(
  params: ResolveOptionAccountsParams
): Promise<ResolvedOptionAccounts> {
  const programId = params.programId;

  const [optionAccount] = await deriveOptionAccountPda({
    underlyingAsset: params.underlyingAsset,
    optionType: params.optionType,
    strikePrice: params.strikePrice,
    expirationDate: params.expirationDate,
    programId,
  });

  const [longMint] = await deriveLongMintPda(optionAccount, programId);
  const [shortMint] = await deriveShortMintPda(optionAccount, programId);
  const [optionPool] = await deriveOptionPoolPda(optionAccount, programId);
  const [marketData] = await deriveMarketDataPda(params.underlyingAsset, programId);
  const [collateralPool] = await deriveCollateralPoolPda(optionAccount, programId);
  const [mintAuthority] = await deriveMintAuthorityPda(programId);

  const result: ResolvedOptionAccounts = {
    optionAccount,
    longMint,
    shortMint,
    optionPool,
    marketData,
    collateralPool,
    mintAuthority,
  };

  if (params.rpc) {
    const [optionPoolFetched, optionAccountFetched, collateralPoolFetched] =
      await Promise.all([
        fetchOptionPool(params.rpc, optionPool),
        fetchOptionAccount(params.rpc, optionAccount),
        fetchCollateralPool(params.rpc, collateralPool),
      ]);

    if (optionPoolFetched) {
      result.optionPoolData = optionPoolFetched;
      result.escrowLongAccount = optionPoolFetched.escrowLongAccount;
      result.premiumVault = optionPoolFetched.premiumVault;
      result.underlyingMint = optionPoolFetched.underlyingMint;
    }

    if (optionAccountFetched) {
      result.optionAccountData = optionAccountFetched;
    }

    if (collateralPoolFetched) {
      result.collateralPoolData = collateralPoolFetched;
      result.collateralVault = collateralPoolFetched.collateralVault;
    }
  }

  return result;
}
