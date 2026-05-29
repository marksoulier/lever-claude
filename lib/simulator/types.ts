// Core data types for the Lever financial simulator.
// These mirror the plan_data JSONB structure stored in the plans.plan_data column.
// See STEERING.md → Simulator infrastructure → plan_data JSON structure.

// ── Storage types (as persisted in plan_data) ─────────────────────────────

export interface Parameter {
  id: number;
  type: string;
  value: string | number; // dates stored as ISO strings ("2024-01-15")
}

export interface EventFunctionPart {
  type: string;
  title: string;
  enabled: boolean;
}

export interface UpdatingEvent {
  id: number;
  type: string;
  title: string;
  description: string;
  is_recurring: boolean;
  parameters: Parameter[];
  event_functions?: EventFunctionPart[];
}

export interface SimEvent {
  id: number;
  type: string;
  title: string;
  description: string;
  is_recurring: boolean;
  hide?: boolean;
  parameters: Parameter[];
  event_functions?: EventFunctionPart[];
  updating_events: UpdatingEvent[];
}

export interface Account {
  name: string;
  // Cash | Debt | Assets | Savings | Investments | Retirement | Tax
  category: string;
  // None | Appreciation | Depreciation | Daily Compound | Monthly Compound | Yearly Compound | Depreciation (Days)
  growth: string;
  rate?: number;              // annual rate as decimal, e.g. 0.07
  days_of_usefulness?: number;
  // regular | system-controlled | non-networth-account
  account_type: string;
}

export interface SimulationResult {
  date: number;                               // days since birth
  value: number;                              // total net worth
  parts: Record<string, number>;              // per-account balances (networth accounts)
  nonNetworthParts?: Record<string, number>;  // non-networth account balances
}

export interface PlanData {
  birth_date: string;           // ISO date, e.g. "1995-03-12"
  location?: string;
  occupation?: string;
  goals?: string;
  inflation_rate: number;       // e.g. 0.03
  adjust_for_inflation: boolean;
  accounts: Account[];
  events: SimEvent[];
  simulation_results?: SimulationResult[];
}

// ── Simulator-internal types (after parseEventsForSimulation) ─────────────
// Parameters are converted from arrays to objects; dates to days-since-birth.

export interface ParsedUpdatingEvent {
  id: number;
  type: string;
  title: string;
  is_recurring: boolean;
  parameters: Record<string, any>;      // { paramType: value }; dates as day numbers
  event_functions: Record<string, boolean>; // { functionType: enabled }
}

export interface ParsedEvent {
  id: number;
  type: string;
  title: string;
  description: string;
  is_recurring: boolean;
  parameters: Record<string, any>;
  event_functions: Record<string, boolean>;
  updating_events: ParsedUpdatingEvent[];
  // Transient simulation state (e.g. _mortgage_state, _car_loan_state) — not persisted
  [key: string]: any;
}

// ── Account state tracked during simulation ────────────────────────────────

export interface AccountState {
  balance: number;
  growth_type: string;
  growth_rate: number;
  days_of_usefulness?: number;
  inflation_rate: number;
  account_type: string;
  // Internal simulation counters
  _days_elapsed?: number;
  _depreciation_start_balance?: number;
}
