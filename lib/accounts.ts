// Shared account types and helpers used by API routes and MCP tools.

export type AccountType = "cash" | "investment" | "real_estate" | "debt";

export type Account = {
  id: string;
  name: string;
  institution: string | null;
  type: AccountType;
  subtype: string | null;
  balance: number;         // dollars; positive for all types including debt
  currency: string;
  displayOrder: number;
};

export type DbAccountRow = {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  type: string;
  subtype: string | null;
  balance: number;
  currency: string;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export function accountFromRow(row: DbAccountRow): Account {
  return {
    id:           row.id,
    name:         row.name,
    institution:  row.institution,
    type:         row.type as AccountType,
    subtype:      row.subtype,
    balance:      row.balance,
    currency:     row.currency,
    displayOrder: row.display_order,
  };
}

// Net worth = sum of asset balances minus sum of debt balances.
export function computeNetWorth(accounts: Account[]): number {
  return accounts.reduce(
    (sum, a) => sum + (a.type === "debt" ? -a.balance : a.balance),
    0,
  );
}

export const ACCOUNT_ICONS: Record<AccountType, string> = {
  cash:         "🏦",
  investment:   "📈",
  real_estate:  "🏠",
  debt:         "💳",
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash:         "Cash",
  investment:   "Investment",
  real_estate:  "Real estate",
  debt:         "Debt",
};

export const ACCOUNT_TYPES: AccountType[] = ["cash", "investment", "real_estate", "debt"];
