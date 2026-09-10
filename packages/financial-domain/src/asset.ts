import type { Money } from "./money.js";

export interface Asset {
  readonly assetId: string;
  readonly ownerId: string;
  readonly name: string;
  readonly value: Money;
  readonly assetType: "cash" | "investment" | "property" | "business" | "other";
  readonly valuedAt: string;
}
