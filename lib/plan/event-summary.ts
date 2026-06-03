// Human-readable summaries for plan events shown in the "Events in this plan" panel.
// Extracted from the plan page so it can be unit-tested independently.

export type EventParam = { type: string; value: string | number };
export type EventForSummary = { type: string; parameters: EventParam[] };

export const EVENT_LABELS: Record<string, string> = {
  get_job: "Full-time Job", get_wage_job: "Hourly Job", start_business: "Business",
  inflow: "Income", outflow: "Expense", rent_payment: "Rent",
  buy_house: "Home Purchase", existing_mortgage: "Existing Mortgage",
  buy_car: "Car Purchase", loan_amortization: "Personal Loan",
  payment_schedule: "Debt Repayment", loan: "Loan",
  federal_subsidized_loan: "Federal Student Loan", federal_unsubsidized_loan: "Federal Student Loan",
  private_student_loan: "Private Student Loan",
  roth_ira_contribution: "Roth IRA", invest_money: "Investment Goal",
  high_yield_savings_account: "High Yield Savings",
  monthly_budgeting: "Monthly Budget", buy_groceries: "Groceries",
  buy_health_insurance: "Health Insurance", buy_life_insurance: "Life Insurance",
  receive_government_aid: "Government Aid",
  have_kid: "Having a Child", childcare_expense: "Childcare",
  marriage: "Marriage", divorce: "Divorce", career_break: "Career Break",
  moving_costs: "Moving Costs", windfall: "Windfall",
  freelance_income: "Freelance Income", retirement: "Retirement",
  transfer_money: "Money Transfer", usa_tax_system: "US Tax System",
  declare_accounts: "Account Declaration", manual_correction: "Manual Adjustment",
  purchase: "Purchase", gift: "Gift",
};

export const FREQ_LABEL: Record<number, string> = {
  7: "weekly", 14: "biweekly", 30: "monthly", 365: "yearly",
};

// Returns a short human-readable summary of the key financial value for an event,
// e.g. "$1,650 monthly" for a mortgage, "$95,000 salary" for a job.
// Returns "" for event types with no meaningful single-value summary.
export function getEventSummary(event: EventForSummary): string {
  const p = Object.fromEntries(event.parameters.map(x => [x.type, x.value]));
  const fmtMoney = (v: unknown) => v != null ? `$${Number(v).toLocaleString()}` : null;
  const fmtFreq  = (v: unknown) => v != null ? (FREQ_LABEL[Number(v)] ?? `every ${v} days`) : null;

  switch (event.type) {
    case "get_job": case "get_wage_job": case "income_with_changing_parameters":
      return [fmtMoney(p.salary ?? p.annual_salary), "salary"].filter(Boolean).join(" ");

    case "inflow": case "outflow":
    case "childcare_expense": case "buy_groceries": case "freelance_income":
      return [fmtMoney(p.amount ?? p.monthly_cost), fmtFreq(p.frequency_days)].filter(Boolean).join(" ");

    case "rent_payment":
      return [fmtMoney(p.amount ?? p.monthly_rent ?? p.monthly_cost), fmtFreq(p.frequency_days) ?? "monthly"].filter(Boolean).join(" ");

    case "payment_schedule": case "existing_mortgage":
      // Regression for BUGS.md B — payment_schedule previously fell through to default (no amount shown)
      return [fmtMoney(p.payment ?? p.payment_amount), "monthly"].filter(Boolean).join(" ");

    case "monthly_budgeting": {
      // Regression for BUGS.md B — monthly_budgeting has no single `amount`; sum all category fields
      const cats = ["groceries","utilities","rent","transportation","insurance",
                    "healthcare","dining_out","entertainment","personal_care","miscellaneous","other"];
      const total = cats.reduce((sum, k) => sum + (Number(p[k]) || 0), 0);
      return total > 0 ? `$${total.toLocaleString()} monthly` : "";
    }

    case "buy_house": case "loan_amortization": case "federal_subsidized_loan":
    case "federal_unsubsidized_loan": case "private_student_loan":
      return [fmtMoney(p.principal), p.interest_rate != null ? `@ ${(Number(p.interest_rate) * 100).toFixed(1)}%` : null].filter(Boolean).join(" ");

    case "buy_car":
      return [fmtMoney(p.price ?? p.cost), "purchase"].filter(Boolean).join(" ");

    case "roth_ira_contribution": case "invest_money": case "high_yield_savings_account":
      return [fmtMoney(p.monthly_contribution ?? p.amount), "monthly"].filter(Boolean).join(" ");

    case "buy_health_insurance": case "buy_life_insurance":
      return [fmtMoney(p.monthly_premium ?? p.premium), "monthly"].filter(Boolean).join(" ");

    case "windfall":
      return fmtMoney(p.amount) ?? "";

    default:
      return "";
  }
}
