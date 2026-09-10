export type SourceKind = "manual" | "csv" | "provider_api" | "provider_file" | "system";

export interface Provenance {
  readonly sourceKind: SourceKind;
  readonly providerId?: string;
  readonly externalId?: string;
  readonly importedAt: string;
  readonly sourceHash?: string;
}
