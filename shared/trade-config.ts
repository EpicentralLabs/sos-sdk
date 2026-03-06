export interface TradeConfig {
  slippageBps?: number;
  computeUnitLimit?: number;
  computeUnitPriceMicroLamports?: number;
}

let globalTradeConfig: TradeConfig = {};

export function setGlobalTradeConfig(config: TradeConfig): void {
  globalTradeConfig = { ...config };
}

export function updateGlobalTradeConfig(config: Partial<TradeConfig>): void {
  globalTradeConfig = { ...globalTradeConfig, ...config };
}

export function getGlobalTradeConfig(): TradeConfig {
  return { ...globalTradeConfig };
}

export function resetGlobalTradeConfig(): void {
  globalTradeConfig = {};
}

export function resolveTradeConfig(overrides?: Partial<TradeConfig>): TradeConfig {
  return { ...globalTradeConfig, ...overrides };
}
