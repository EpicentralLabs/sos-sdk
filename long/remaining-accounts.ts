import type { RemainingAccountInput } from "../shared/remaining-accounts";
import type { AddressLike, KitRpc } from "../client/types";
import { PROGRAM_ID } from "../client/program";
import { fetchWriterPositionsForPool } from "../accounts/list";

/**
 * Returns remaining_accounts for the buy_from_pool instruction: WriterPosition
 * accounts for the given pool, sorted by unsoldQty ascending (smallest first),
 * in the shape expected by buildBuyFromPoolTransaction and
 * buildBuyFromPoolTransactionWithDerivation.
 */
export async function getBuyFromPoolRemainingAccounts(
  rpc: KitRpc,
  optionPool: AddressLike,
  programId?: AddressLike
): Promise<RemainingAccountInput[]> {
  const positions = await fetchWriterPositionsForPool(
    rpc,
    optionPool,
    programId ?? PROGRAM_ID
  );

  // Filter out inactive positions (settled, liquidated, or zero unsold)
  const activePositions = positions.filter((p) => {
    const isActive = !p.data.isSettled && !p.data.isLiquidated && p.data.unsoldQty > 0;
    if (!isActive) {
      console.log(
        `Filtering out inactive writer position: ${p.address}, ` +
        `isSettled=${p.data.isSettled}, isLiquidated=${p.data.isLiquidated}, unsoldQty=${p.data.unsoldQty}`
      );
    }
    return isActive;
  });

  const sorted = [...activePositions].sort((a, b) => {
    const aQty = a.data.unsoldQty;
    const bQty = b.data.unsoldQty;
    return aQty < bQty ? -1 : aQty > bQty ? 1 : 0;
  });
  return sorted.map(({ address }) => ({
    address,
    isWritable: true,
  }));
}
