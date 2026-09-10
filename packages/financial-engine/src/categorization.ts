export interface CategoryRule {
  readonly categoryId: string;
  readonly keywords: readonly string[];
}

export interface CategoryMatch {
  readonly categoryId?: string;
  readonly confidence: number;
  readonly matchedKeywords: readonly string[];
  readonly source: "rule" | "none";
}

const DEFAULT_RULES: readonly CategoryRule[] = [
  { categoryId: "food", keywords: ["restaurant", "food", "groceries", "supermarket", "carrefour", "naivas"] },
  { categoryId: "transport", keywords: ["uber", "bolt", "fuel", "petrol", "matatu", "transport"] },
  { categoryId: "utilities", keywords: ["electricity", "kplc", "water", "internet", "airtel", "safaricom"] },
  { categoryId: "rent", keywords: ["rent", "landlord", "house"] },
  { categoryId: "education", keywords: ["school", "tuition", "university", "college", "fees"] },
  { categoryId: "health", keywords: ["hospital", "clinic", "pharmacy", "medical"] },
  { categoryId: "debt", keywords: ["loan", "fuliza", "repayment", "debt"] },
  { categoryId: "savings", keywords: ["savings", "sacco", "fixed deposit", "money market"] },
];

export function categorize(description: string, rules: readonly CategoryRule[] = DEFAULT_RULES): CategoryMatch {
  const normalized = description.toLowerCase();
  let best: CategoryMatch = { confidence: 0, matchedKeywords: [], source: "none" };

  for (const rule of rules) {
    const matchedKeywords = rule.keywords.filter((keyword) => normalized.includes(keyword.toLowerCase()));
    if (matchedKeywords.length === 0) continue;
    const confidence = Math.min(1, 0.55 + matchedKeywords.length * 0.15);
    if (confidence > best.confidence) {
      best = { categoryId: rule.categoryId, confidence, matchedKeywords, source: "rule" };
    }
  }

  return best;
}
