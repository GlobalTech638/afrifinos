export type CategoryKind = "income" | "expense" | "transfer" | "fee" | "uncategorized";

export interface Category {
  readonly categoryId: string;
  readonly ownerId?: string;
  readonly name: string;
  readonly kind: CategoryKind;
  readonly parentCategoryId?: string;
  readonly system: boolean;
}
