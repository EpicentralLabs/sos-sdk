/**
 * OMLP (Option Maker Liquidity Pool) service – V2 pool-based API only.
 * Exposes: depositToPosition, withdrawFromPosition, withdrawAllFromPosition, withdrawInterestFromPosition.
 * Borrow/repay use short/pool (buildBorrowFromPool*, buildRepayPoolLoan*). Legacy offer-based instructions are not exposed.
 */
import { fetchLenderPosition, fetchVault } from "../accounts/fetchers";
import type { KitRpc } from "../client/types";
import {
  buildDepositToPositionTransaction,
  buildWithdrawFromPositionTransaction,
  type BuildDepositToPositionParams,
  type BuildWithdrawFromPositionParams,
} from "./builders";

const INTEREST_FP_SCALE = 1_000_000_000_000n;

function positiveDiff(a: bigint, b: bigint): bigint {
  return a > b ? a - b : 0n;
}

function calculatePendingInterest(
  deposited: bigint,
  vaultAccInterestPerShareFp: bigint,
  positionInterestIndexSnapshotFp: bigint
): bigint {
  const deltaFp = positiveDiff(
    vaultAccInterestPerShareFp,
    positionInterestIndexSnapshotFp
  );

  return (deposited * deltaFp) / INTEREST_FP_SCALE;
}

export async function depositToPosition(
  params: BuildDepositToPositionParams
) {
  return buildDepositToPositionTransaction(params);
}

export async function withdrawFromPosition(
  params: BuildWithdrawFromPositionParams
) {
  return buildWithdrawFromPositionTransaction(params);
}

export async function withdrawAllFromPosition(
  rpc: KitRpc,
  params: Omit<BuildWithdrawFromPositionParams, "amount"> & {
    position: NonNullable<BuildWithdrawFromPositionParams["position"]>;
  }
): Promise<{ instructions: Awaited<ReturnType<typeof buildWithdrawFromPositionTransaction>>["instructions"]; amount: bigint }> {
  const [position, vault] = await Promise.all([
    fetchLenderPosition(rpc, params.position),
    fetchVault(rpc, params.vault),
  ]);

  if (!position) {
    throw new Error("Lender position not found. Provide position PDA or deposit first.");
  }
  if (!vault) {
    throw new Error("Vault account not found.");
  }

  const unclaimedInterest = positiveDiff(
    position.totalInterestEarned,
    position.interestClaimed
  );
  const pendingInterest = calculatePendingInterest(
    position.deposited,
    vault.accInterestPerShareFp,
    position.interestIndexSnapshotFp
  );
  const userMax = position.deposited + unclaimedInterest + pendingInterest;
  const poolAvailable = positiveDiff(vault.totalLiquidity, vault.totalLoans);
  const amount = userMax < poolAvailable ? userMax : poolAvailable;
  if (amount <= 0n) {
    throw new Error("No withdrawable balance available right now.");
  }

  const built = await buildWithdrawFromPositionTransaction({
    ...params,
    amount,
    vaultMint: vault.mint,
  });
  return { instructions: built.instructions, amount };
}

export async function withdrawInterestFromPosition(
  rpc: KitRpc,
  params: Omit<BuildWithdrawFromPositionParams, "amount"> & {
    position: NonNullable<BuildWithdrawFromPositionParams["position"]>;
  }
): Promise<{ instructions: Awaited<ReturnType<typeof buildWithdrawFromPositionTransaction>>["instructions"]; amount: bigint }> {
  const [position, vault] = await Promise.all([
    fetchLenderPosition(rpc, params.position),
    fetchVault(rpc, params.vault),
  ]);

  if (!position) {
    throw new Error("Lender position not found. Provide position PDA or deposit first.");
  }
  if (!vault) {
    throw new Error("Vault account not found.");
  }

  const unclaimedInterest = positiveDiff(
    position.totalInterestEarned,
    position.interestClaimed
  );
  const pendingInterest = calculatePendingInterest(
    position.deposited,
    vault.accInterestPerShareFp,
    position.interestIndexSnapshotFp
  );
  const totalClaimableInterest = unclaimedInterest + pendingInterest;
  const poolAvailable = positiveDiff(vault.totalLiquidity, vault.totalLoans);
  const amount =
    totalClaimableInterest < poolAvailable
      ? totalClaimableInterest
      : poolAvailable;
  if (amount <= 0n) {
    throw new Error("No claimable interest available right now.");
  }

  const built = await buildWithdrawFromPositionTransaction({
    ...params,
    amount,
    vaultMint: vault.mint,
  });
  return { instructions: built.instructions, amount };
}

export const omlpBuilders = {
  buildDepositToPositionTransaction,
  buildWithdrawFromPositionTransaction,
};
