// Day-by-day deterministic financial simulator.
// Faithful port of modal-canvas-flow/src/hooks/simulationRunner.ts.
// React dependencies removed; uses Lever's own types.
// See STEERING.md → Simulator infrastructure → The simulator.

import type {
  PlanData,
  SimulationResult,
  ParsedEvent,
  ParsedUpdatingEvent,
  AccountState,
} from './types';

// ── Date utilities ─────────────────────────────────────────────────────────

// Detect ISO date strings vs numeric day values stored in parameters.
function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);
}

// Convert an ISO date string to days elapsed since birth_date.
function dateToDays(isoDate: string, birthDate: string): number {
  return Math.floor((Date.parse(isoDate) - Date.parse(birthDate)) / 86_400_000);
}

// ── Plan parsing ───────────────────────────────────────────────────────────
// Converts stored plan_data (parameter arrays, ISO dates) to the format
// the simulator event handlers expect (parameter objects, day numbers).

function paramsToObject(
  params: { type: string; value: string | number }[],
  birthDate: string,
): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const p of params) {
    obj[p.type] = isIsoDate(p.value) ? dateToDays(p.value, birthDate) : p.value;
  }
  return obj;
}

function functionsToObject(fns: { type: string; enabled: boolean }[]): Record<string, boolean> {
  const obj: Record<string, boolean> = {};
  for (const f of fns) obj[f.type] = f.enabled;
  return obj;
}

function parseUpdatingEvent(ue: any, birthDate: string): ParsedUpdatingEvent {
  return {
    id: ue.id,
    type: ue.type,
    title: ue.title ?? '',
    is_recurring: ue.is_recurring ?? false,
    parameters: paramsToObject(ue.parameters ?? [], birthDate),
    event_functions: functionsToObject(ue.event_functions ?? []),
  };
}

// Convert plan_data events to simulator-internal ParsedEvent format.
// Hidden events are excluded. Date parameters are converted to day numbers.
function parseEventsForSimulation(planData: PlanData): ParsedEvent[] {
  return planData.events
    .filter((e) => !e.hide)
    .map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title ?? '',
      description: e.description ?? '',
      is_recurring: e.is_recurring ?? false,
      parameters: paramsToObject(e.parameters ?? [], planData.birth_date),
      event_functions: functionsToObject(e.event_functions ?? []),
      updating_events: (e.updating_events ?? []).map((ue) =>
        parseUpdatingEvent(ue, planData.birth_date),
      ),
    }));
}

// ── Growth application ─────────────────────────────────────────────────────

// Growth types that respond to market returns — used by year-by-year Monte Carlo.
const MARKET_GROWTH_TYPES = new Set([
  'Daily Compound', 'Monthly Compound', 'Yearly Compound', 'Appreciation',
]);

// currentSimDay: days elapsed since simulation start (for year-by-year return indexing).
// yearlyReturns: when provided, overrides growth_rate for market-linked accounts each year.
function applyGrowth(
  accounts: Record<string, AccountState>,
  currentSimDay?: number,
  yearlyReturns?: number[],
): void {
  const yearIndex = (yearlyReturns && currentSimDay != null)
    ? Math.min(Math.floor(currentSimDay / 365), yearlyReturns.length - 1)
    : -1;

  for (const name in accounts) {
    const acc = accounts[name];
    const annualRate = (yearIndex >= 0 && MARKET_GROWTH_TYPES.has(acc.growth_type))
      ? (yearlyReturns![yearIndex] ?? acc.growth_rate ?? 0)
      : (acc.growth_rate || 0);
    const dailyRate = annualRate / 365;
    acc._days_elapsed = (acc._days_elapsed ?? 0) + 1;

    switch (acc.growth_type) {
      case 'None':
        break;

      case 'Simple Interest':
      case 'Appreciation': {
        if (acc.balance !== 0 && dailyRate !== 0) {
          acc.balance += acc.balance * dailyRate;
        }
        break;
      }

      case 'Daily Compound': {
        if (acc.balance !== 0 && dailyRate !== 0) {
          acc.balance *= 1 + dailyRate;
        }
        break;
      }

      case 'Monthly Compound': {
        if (acc.balance !== 0 && annualRate !== 0) {
          const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
          const dailyEquiv = Math.pow(1 + monthlyRate, 12 / 365) - 1;
          acc.balance *= 1 + dailyEquiv;
        }
        break;
      }

      case 'Yearly Compound': {
        if (acc.balance !== 0 && annualRate !== 0 && acc._days_elapsed % 365 === 0) {
          acc.balance *= 1 + annualRate;
        }
        break;
      }

      case 'Depreciation': {
        // Depreciation uses the account's own rate, not market overrides
        const deprRate = (acc.growth_rate || 0) / 365;
        if (acc.balance !== 0 && deprRate !== 0) {
          acc.balance -= acc.balance * deprRate;
        }
        break;
      }

      case 'Depreciation (Days)': {
        const daysOfUsefulness = Number(acc.days_of_usefulness || 0);
        if (daysOfUsefulness > 0) {
          if (acc._depreciation_start_balance == null || acc.balance > acc._depreciation_start_balance) {
            acc._depreciation_start_balance = acc.balance;
          }
          const dailyDecrease = acc._depreciation_start_balance / daysOfUsefulness;
          acc.balance = Math.max(0, acc.balance - dailyDecrease);
        }
        break;
      }
    }
  }
}

// ── Financial math helpers ─────────────────────────────────────────────────

function calculateMortgagePayment(principal: number, annualRateDecimal: number, termYears: number): number {
  if (principal <= 0 || termYears <= 0) return 0;
  const monthlyRate = annualRateDecimal / 12;
  const n = termYears * 12;
  if (monthlyRate === 0) return principal / n;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
}

function calculateInstallmentPayment(
  principal: number,
  annualRateDecimal: number,
  totalPayments: number,
  paymentsPerYear: number,
): number {
  if (principal <= 0 || totalPayments <= 0 || paymentsPerYear <= 0) return 0;
  const ratePerPayment = annualRateDecimal / paymentsPerYear;
  if (ratePerPayment === 0) return principal / totalPayments;
  return (principal * ratePerPayment) / (1 - Math.pow(1 + ratePerPayment, -totalPayments));
}

// ── Event handlers ─────────────────────────────────────────────────────────

type QueueFn = (eventId: number, paramType: string, value: number) => void;

function applyInflow(
  day: number,
  event: ParsedEvent,
  accounts: Record<string, AccountState>,
  queue: QueueFn,
): void {
  const p = event.parameters;

  for (const ue of event.updating_events) {
    switch (ue.type) {
      case 'update_amount': {
        if (ue.parameters.start_time === day) p.amount = ue.parameters.amount;
        break;
      }
      case 'increment_amount': {
        const up = ue.parameters;
        if (up.start_time === day) p.amount += up.amount;
        else if (ue.is_recurring && day <= up.end_time && (day - up.start_time) % Math.round(up.frequency_days) === 0) {
          p.amount += up.amount;
        }
        break;
      }
      case 'additional_inflow': {
        const up = ue.parameters;
        const target = accounts[p.to_key];
        if (!target) break;
        if (up.start_time === day) target.balance += up.amount;
        else if (ue.is_recurring && day <= up.end_time && (day - up.start_time) % Math.round(up.frequency_days) === 0) {
          target.balance += up.amount;
        }
        break;
      }
    }
  }

  const target = accounts[p.to_key];
  if (!target) return;

  if (p.start_time === day) target.balance += p.amount;
  else if (event.is_recurring && day <= p.end_time && (day - p.start_time) % Math.round(p.frequency_days) === 0) {
    target.balance += p.amount;
  }
}

function applyOutflow(
  day: number,
  event: ParsedEvent,
  accounts: Record<string, AccountState>,
  _queue: QueueFn,
): void {
  const p = event.parameters;

  for (const ue of event.updating_events) {
    if (ue.type === 'update_amount' && ue.parameters.start_time === day) {
      p.amount = ue.parameters.amount;
    }
  }

  const source = accounts[p.from_key];
  if (!source) return;

  if (p.start_time === day) source.balance -= p.amount;
  else if (event.is_recurring && day <= p.end_time && (day - p.start_time) % Math.round(p.frequency_days) === 0) {
    source.balance -= p.amount;
  }
}

function applyDeclareAccounts(
  day: number,
  event: ParsedEvent,
  accounts: Record<string, AccountState>,
  _queue: QueueFn,
): void {
  const p = event.parameters;
  if (p.start_time !== day) return;

  const pairs: [string | undefined, number | undefined][] = [
    [p.account1, p.amount1],
    [p.account2, p.amount2],
    [p.account3, p.amount3],
    [p.account4, p.amount4],
    [p.account5, p.amount5],
  ];

  for (const [key, amount] of pairs) {
    if (key && accounts[key]) accounts[key].balance = amount ?? 0;
  }
}

function applyTransferMoney(
  day: number,
  event: ParsedEvent,
  accounts: Record<string, AccountState>,
  _queue: QueueFn,
): void {
  const p = event.parameters;

  for (const ue of event.updating_events) {
    if (ue.type === 'update_amount' && ue.parameters.start_time === day) {
      p.amount = ue.parameters.amount;
    }
  }

  const source = accounts[p.from_key];
  const target = accounts[p.to_key];
  if (!source || !target) return;

  if (p.start_time === day) { source.balance -= p.amount; target.balance += p.amount; }
  else if (event.is_recurring && day <= p.end_time && (day - p.start_time) % Math.round(p.frequency_days) === 0) {
    source.balance -= p.amount;
    target.balance += p.amount;
  }
}

function applyManualCorrection(
  day: number,
  event: ParsedEvent,
  accounts: Record<string, AccountState>,
  _queue: QueueFn,
): void {
  const p = event.parameters;
  const target = accounts[p.to_key];
  if (!target) return;
  if (p.start_time === day) target.balance = p.amount;
}

function applyPaymentSchedule(
  day: number,
  event: ParsedEvent,
  accounts: Record<string, AccountState>,
  queue: QueueFn,
): void {
  const p = event.parameters;
  const source = accounts[p.from_key];
  const target = accounts[p.to_key];
  if (!source || !target) return;

  if (p.start_time === day) {
    source.balance -= p.payment;
    target.balance += p.payment;
    p.end_time = day + 365 * 1000;
  } else if (event.is_recurring && day <= p.end_time && (day - p.start_time) % Math.round(p.frequency_days) === 0) {
    if (target.balance * -1 < p.payment) {
      source.balance += target.balance;
      target.balance = 0;
      p.end_time = day;
      queue(event.id, 'end_time', day);
      return;
    }
    source.balance -= p.payment;
    target.balance += p.payment;
  }
}

function applyGetJob(
  day: number,
  event: ParsedEvent,
  accounts: Record<string, AccountState>,
  _queue: QueueFn,
): void {
  const p = event.parameters;

  for (const ue of event.updating_events) {
    switch (ue.type) {
      case 'get_a_raise':
        if (ue.parameters.start_time === day) p.salary = ue.parameters.salary;
        break;
      case 'reoccurring_raise': {
        const up = ue.parameters;
        if ((day - up.start_time) % Math.round(up.frequency_days) === 0 && day >= up.start_time && day <= up.end_time) {
          p.salary += up.salary_increase;
        }
        break;
      }
      case 'get_a_bonus': {
        const target = accounts[p.to_key];
        if (ue.parameters.start_time === day && target) target.balance += ue.parameters.bonus;
        break;
      }
      case 'change_401k_contribution':
        if (ue.parameters.start_time === day) p.p_401k_contribution = ue.parameters.p_401k_contribution;
        break;
    }
  }

  const payPeriodDays = Math.round(365 / (p.pay_period || 26));
  if (day > p.end_time || (day - p.start_time) % payPeriodDays !== 0) return;

  const gross = p.salary / (p.pay_period || 26);
  const contrib401k = gross * (p.p_401k_contribution ?? 0);
  const match401k = gross * (p.p_401k_match ?? 0);
  const taxable = gross - contrib401k;

  const federal = taxable * (p.federal_income_tax ?? 0);
  const state = taxable * (p.state_income_tax ?? 0);
  const local = taxable * (p.local_income_tax ?? 0);
  const social = gross * (p.social_security_tax ?? 0);
  const medicare = gross * (p.medicare_tax ?? 0);
  const totalWithheld = federal + state + local + social + medicare;
  const netpay = gross - contrib401k - totalWithheld;

  if (accounts[p.to_key]) accounts[p.to_key].balance += netpay;
  if (p.p_401k_key && accounts[p.p_401k_key]) accounts[p.p_401k_key].balance += contrib401k + match401k;
  if (p.taxable_income_key && accounts[p.taxable_income_key]) accounts[p.taxable_income_key].balance += taxable;
  if (p.federal_withholdings_key && accounts[p.federal_withholdings_key]) accounts[p.federal_withholdings_key].balance += federal + social + medicare;
  if (p.state_withholdings_key && accounts[p.state_withholdings_key]) accounts[p.state_withholdings_key].balance += state;
  if (p.local_withholdings_key && accounts[p.local_withholdings_key]) accounts[p.local_withholdings_key].balance += local;
}

function applyGetWageJob(
  day: number,
  event: ParsedEvent,
  accounts: Record<string, AccountState>,
  _queue: QueueFn,
): void {
  const p = event.parameters;

  for (const ue of event.updating_events) {
    switch (ue.type) {
      case 'get_a_raise':
        if (ue.parameters.start_time === day) p.hourly_wage = ue.parameters.new_hourly_wage;
        break;
      case 'change_hours':
        if (ue.parameters.start_time === day) p.hours_per_week = ue.parameters.new_hours;
        break;
      case 'change_401k_contribution':
        if (ue.parameters.start_time === day) p.p_401k_contribution = ue.parameters.p_401k_contribution;
        break;
      case 'change_employer_match':
        if (ue.parameters.start_time === day) p.employer_match = ue.parameters.new_match_rate;
        break;
    }
  }

  const payPeriodDays = Math.round(p.frequency_days || 365 / (p.pay_period || 26));
  if (day > p.end_time || (day - p.start_time) % payPeriodDays !== 0) return;

  const hoursPerPeriod = p.hours_per_week * (payPeriodDays / 7);
  const gross = p.hourly_wage * hoursPerPeriod;
  const contrib401k = gross * (p.p_401k_contribution ?? 0);
  const match401k = gross * (p.employer_match ?? 0);
  const taxable = gross - contrib401k;

  const federal = taxable * (p.federal_income_tax ?? 0);
  const state = taxable * (p.state_income_tax ?? 0);
  const social = gross * (p.social_security_tax ?? 0);
  const medicare = gross * (p.medicare_tax ?? 0);
  const totalWithheld = federal + state + social + medicare;
  const netpay = gross - contrib401k - totalWithheld;

  if (accounts[p.to_key]) accounts[p.to_key].balance += netpay;
  if (p.p_401k_key && accounts[p.p_401k_key]) accounts[p.p_401k_key].balance += contrib401k + match401k;
  if (p.taxable_income_key && accounts[p.taxable_income_key]) accounts[p.taxable_income_key].balance += taxable;
  if (p.federal_withholdings_key && accounts[p.federal_withholdings_key]) accounts[p.federal_withholdings_key].balance += federal + social + medicare;
  if (p.state_withholdings_key && accounts[p.state_withholdings_key]) accounts[p.state_withholdings_key].balance += state;
}

function applyMonthlyBudgeting(
  day: number,
  event: ParsedEvent,
  accounts: Record<string, AccountState>,
  _queue: QueueFn,
): void {
  const p = event.parameters;

  for (const ue of event.updating_events) {
    if (ue.type === 'update_monthly_budget' && ue.parameters.start_time === day) {
      const key = ue.parameters.key;
      if (key in p) p[key] = ue.parameters.amount;
    }
  }

  const triggered =
    p.start_time === day ||
    (event.is_recurring && (day - p.start_time) % (p.frequency_days || 30) === 0);

  if (!triggered) return;

  const source = accounts[p.from_key];
  if (!source) return;

  source.balance -= (p.dining_out ?? 0) + (p.entertainment ?? 0) + (p.groceries ?? 0) +
    (p.healthcare ?? 0) + (p.insurance ?? 0) + (p.miscellaneous ?? 0) +
    (p.personal_care ?? 0) + (p.rent ?? 0) + (p.utilities ?? 0) + (p.transportation ?? 0);
}

function applyBuyCar(
  day: number,
  event: ParsedEvent,
  accounts: Record<string, AccountState>,
  queue: QueueFn,
): void {
  const p = event.parameters;

  const source = accounts[p.from_key];
  const carAsset = accounts[p.to_key];
  const loanAcc = accounts[p.car_loan_account];
  if (!source || !carAsset || !loanAcc) return;

  const paymentIntervalDays = Math.max(1, Number(p.frequency_days || 30));
  const loanTermYears = Number(p.loan_term_years || 0);

  if (p.start_time === day && !event._car_loan_state) {
    const principal = Math.max(0, p.car_value - p.downpayment);
    const annualRate = loanAcc.growth_rate ?? 0;
    const totalPayments = Math.max(0, Math.round((loanTermYears * 365) / paymentIntervalDays));
    const paymentsPerYear = 365 / paymentIntervalDays;
    const payment = calculateInstallmentPayment(principal, annualRate, totalPayments, paymentsPerYear);

    event._car_loan_state = {
      payment_amount: payment,
      remaining_principal: principal,
      start_time: day,
      end_day: day + Math.ceil(paymentIntervalDays * totalPayments),
      next_payment_day: day + paymentIntervalDays,
      total_payments: totalPayments,
      payments_made: 0,
      payment_interval_days: paymentIntervalDays,
    };

    source.balance -= p.downpayment;
    carAsset.balance += p.car_value;
    loanAcc.balance -= principal;
  }

  for (const ue of event.updating_events) {
    switch (ue.type) {
      case 'pay_loan_early': {
        const up = ue.parameters;
        if (up.start_time === day && event._car_loan_state) {
          const paySource = accounts[up.from_key];
          if (paySource) paySource.balance -= up.amount;
          loanAcc.balance += up.amount;
          event._car_loan_state.remaining_principal = Math.max(0, -loanAcc.balance);
          if (event._car_loan_state.remaining_principal <= 0) {
            event._car_loan_state.end_day = day;
            p.end_time = day;
            queue(event.id, 'end_time', day);
          }
        }
        break;
      }
      case 'car_repair': {
        const up = ue.parameters;
        if (up.start_time === day) {
          const repairSource = accounts[up.from_key];
          if (repairSource) repairSource.balance -= up.cost;
        }
        break;
      }
    }
  }

  if (event._car_loan_state && day >= event._car_loan_state.start_time && day <= event._car_loan_state.end_day) {
    const state = event._car_loan_state;
    const outstanding = Math.max(0, -loanAcc.balance);
    state.remaining_principal = outstanding;

    const canPay =
      outstanding > 0 &&
      (state.total_payments == null || state.payments_made < state.total_payments) &&
      day + 1e-9 >= (state.next_payment_day ?? (state.start_time + paymentIntervalDays));

    if (canPay) {
      const actual = Math.min(Number(state.payment_amount || 0), outstanding);
      source.balance -= actual;
      loanAcc.balance += actual;

      state.remaining_principal = Math.max(0, -loanAcc.balance);
      state.payments_made = (state.payments_made ?? 0) + 1;
      state.next_payment_day = (state.next_payment_day ?? (state.start_time + paymentIntervalDays)) + paymentIntervalDays;

      if (state.remaining_principal <= 0 || state.payments_made >= (state.total_payments ?? Infinity)) {
        state.end_day = day;
        p.end_time = day;
        queue(event.id, 'end_time', day);
      }
    }
  }
}

function applyBuyHouse(
  day: number,
  event: ParsedEvent,
  accounts: Record<string, AccountState>,
  queue: QueueFn,
): void {
  const p = event.parameters;

  const source = accounts[p.from_key];
  const homeAsset = accounts[p.to_key];
  const mortgage = accounts[p.mortgage_account];
  if (!source || !homeAsset || !mortgage) return;

  const isEnabled = (key: string) => event.event_functions?.[key] ?? true;
  const loanTermYears = Number(p.loan_term_years);

  if (p.start_time === day && !event._mortgage_state) {
    const principal = Math.max(0, p.home_value - p.downpayment);
    const annualRate = mortgage.growth_rate ?? 0;
    const monthlyPayment = calculateMortgagePayment(principal, annualRate, loanTermYears);
    const totalPayments = Math.max(0, Math.round(loanTermYears * 12));

    event._home_value = p.home_value;
    event._mortgage_state = {
      monthly_payment: monthlyPayment,
      remaining_principal: principal,
      interest_rate: annualRate,
      start_time: day,
      end_day: day + Math.ceil((365 / 12) * totalPayments),
      next_payment_day: day + 365 / 12,
      total_payments: totalPayments,
      payments_made: 0,
    };

    if (isEnabled('downpayment')) source.balance -= p.downpayment;
    if (isEnabled('home_asset')) homeAsset.balance += p.home_value;
    if (isEnabled('morgage_loan')) mortgage.balance -= principal;
  }

  for (const ue of event.updating_events) {
    switch (ue.type) {
      case 'new_appraisal': {
        if (ue.parameters.start_time === day && isEnabled('home_asset')) {
          homeAsset.balance = ue.parameters.appraised_value;
        }
        break;
      }
      case 'extra_mortgage_payment': {
        const up = ue.parameters;
        if (up.start_time === day && event._mortgage_state) {
          const paySource = accounts[up.from_key];
          if (paySource) paySource.balance -= up.amount;
          if (isEnabled('morgage_loan')) {
            mortgage.balance += up.amount;
            event._mortgage_state.remaining_principal = Math.max(0, -mortgage.balance);
            if (event._mortgage_state.remaining_principal <= 0) event._mortgage_state.end_day = day;
          }
        }
        break;
      }
      case 'late_payment': {
        const up = ue.parameters;
        if (up.start_time === day) {
          const paySource = accounts[up.from_key];
          if (paySource) paySource.balance -= up.amount;
        }
        break;
      }
      case 'sell_house': {
        const up = ue.parameters;
        if (up.start_time === day) {
          const homeValue = event._home_value ?? p.home_value;
          if (isEnabled('home_asset')) homeAsset.balance -= homeValue;
          const saleTarget = accounts[up.to_key];
          if (saleTarget) saleTarget.balance += up.sale_price;
          if (event._mortgage_state) {
            const payoff = Math.max(0, -mortgage.balance);
            if (saleTarget) saleTarget.balance -= payoff;
            if (isEnabled('morgage_loan')) mortgage.balance += payoff;
            event._mortgage_state.remaining_principal = 0;
            event._mortgage_state.end_day = day;
          }
        }
        break;
      }
      case 'refinance_home': {
        const up = ue.parameters;
        if (up.start_time === day && event._mortgage_state) {
          const newMortgage = accounts[up.new_home_mortgage_account];
          if (!newMortgage) break;

          const remaining = Math.max(0, -mortgage.balance);
          if (isEnabled('morgage_loan')) {
            mortgage.balance = 0;
            newMortgage.balance -= remaining;
          }

          const newTermYears = Number(up.new_loan_term_years || loanTermYears);
          const newRate = newMortgage.growth_rate ?? event._mortgage_state.interest_rate ?? 0;
          const newPayment = calculateMortgagePayment(remaining, newRate, newTermYears);
          const newTotalPayments = Math.max(0, Math.round(newTermYears * 12));

          p.mortgage_account = up.new_home_mortgage_account;
          p.loan_term_years = String(newTermYears);

          event._mortgage_state = {
            monthly_payment: newPayment,
            remaining_principal: remaining,
            interest_rate: newRate,
            start_time: day,
            end_day: day + Math.ceil((365 / 12) * newTotalPayments),
            next_payment_day: day + 365 / 12,
            total_payments: newTotalPayments,
            payments_made: 0,
          };
        }
        break;
      }
    }
  }

  if (event._mortgage_state && day >= event._mortgage_state.start_time && day <= event._mortgage_state.end_day) {
    const state = event._mortgage_state;
    const outstanding = Math.max(0, -mortgage.balance);
    state.remaining_principal = outstanding;

    const canPay =
      outstanding > 0 &&
      (state.total_payments == null || state.payments_made < state.total_payments) &&
      day + 1e-9 >= (state.next_payment_day ?? (state.start_time + 365 / 12));

    if (canPay) {
      const actual = Math.min(state.monthly_payment, outstanding);

      if (isEnabled('mortgage_payment')) {
        source.balance -= actual;
        if (isEnabled('morgage_loan')) {
          mortgage.balance += actual;
          state.remaining_principal = Math.max(0, -mortgage.balance);
        }
      }

      if (isEnabled('property_tax')) {
        const tax = (event._home_value ?? p.home_value) * (p.property_tax_rate ?? 0) / 12;
        source.balance -= tax;
      }

      if (isEnabled('final_home_payment_correction') && state.remaining_principal <= 0) {
        if (isEnabled('morgage_loan')) mortgage.balance = 0;
      }

      state.payments_made = (state.payments_made ?? 0) + 1;
      state.next_payment_day = (state.next_payment_day ?? (state.start_time + 365 / 12)) + 365 / 12;

      if (state.remaining_principal <= 0 || state.payments_made >= (state.total_payments ?? Infinity)) {
        state.end_day = day;
        p.end_time = day;
        queue(event.id, 'end_time', day);
      }
    }
  }
}

// ── Additional event handlers ──────────────────────────────────────────────

// windfall: one-time deposit — same as a non-recurring inflow
function applyWindfall(day: number, event: ParsedEvent, accounts: Record<string, AccountState>, _queue: QueueFn): void {
  if (event.parameters.start_time !== day) return;
  const target = accounts[event.parameters.to_key];
  if (target) target.balance += event.parameters.amount;
}

// roth_ira_contribution: recurring transfer from checking to Roth account
function applyRothIra(day: number, event: ParsedEvent, accounts: Record<string, AccountState>, _queue: QueueFn): void {
  const p = event.parameters;
  const amount = p.monthly_contribution ?? p.amount ?? 0;
  const source = accounts[p.from_key];
  const target = accounts[p.to_key];
  if (!source || !target) return;
  if (p.start_time === day) { source.balance -= amount; target.balance += amount; }
  else if (event.is_recurring && day <= p.end_time && (day - p.start_time) % Math.round(p.frequency_days ?? 30) === 0) {
    source.balance -= amount; target.balance += amount;
  }
}

// invest_money: recurring transfer to an investment account (alias to transfer_money)
function applyInvestMoney(day: number, event: ParsedEvent, accounts: Record<string, AccountState>, queue: QueueFn): void {
  applyTransferMoney(day, event, accounts, queue);
}

// career_break: marks a period of no work. Income pause must be configured by
// setting the job event's end_time = career break start. This handler is a
// display-only marker — it records the break in the event timeline but does not
// directly modify account balances.
function applyCareerBreak(_day: number, _event: ParsedEvent, _accounts: Record<string, AccountState>, _queue: QueueFn): void {
  // no-op: income stops when the job event's end_time is reached
}

// ── Event dispatch ─────────────────────────────────────────────────────────

function applyEventsToDay(
  day: number,
  events: ParsedEvent[],
  accounts: Record<string, AccountState>,
  queue: QueueFn,
): void {
  for (const event of events) {
    if (event.parameters.start_time > day) continue;

    switch (event.type) {
      case 'inflow':          applyInflow(day, event, accounts, queue); break;
      case 'outflow':         applyOutflow(day, event, accounts, queue); break;
      case 'declare_accounts': applyDeclareAccounts(day, event, accounts, queue); break;
      case 'transfer_money':  applyTransferMoney(day, event, accounts, queue); break;
      case 'manual_correction': applyManualCorrection(day, event, accounts, queue); break;
      case 'payment_schedule': applyPaymentSchedule(day, event, accounts, queue); break;
      case 'get_job':         applyGetJob(day, event, accounts, queue); break;
      case 'get_wage_job':    applyGetWageJob(day, event, accounts, queue); break;
      case 'monthly_budgeting': applyMonthlyBudgeting(day, event, accounts, queue); break;
      case 'buy_house':       applyBuyHouse(day, event, accounts, queue); break;
      case 'buy_car':         applyBuyCar(day, event, accounts, queue); break;
      case 'existing_mortgage': applyPaymentSchedule(day, event, accounts, queue); break;
      case 'childcare_expense': applyOutflow(day, event, accounts, queue); break;
      case 'rent_payment':      applyOutflow(day, event, accounts, queue); break;
      case 'freelance_income':  applyInflow(day, event, accounts, queue); break;
      case 'windfall':          applyWindfall(day, event, accounts, queue); break;
      case 'roth_ira_contribution': applyRothIra(day, event, accounts, queue); break;
      case 'invest_money':      applyInvestMoney(day, event, accounts, queue); break;
      case 'career_break':      applyCareerBreak(day, event, accounts, queue); break;
      // Additional event types are added here as the library grows
    }
  }
}

// ── Public entry point ─────────────────────────────────────────────────────

// Run the full simulation for a plan. Returns a time series of daily snapshots.
// planData is deep-cloned before simulation to avoid mutating stored data.
// startDay and endDay are in days-since-birth (day 0 = birth).
// yearlyReturns: optional array of annual return rates (one per simulation year).
// When provided, market-linked accounts use the year-specific rate instead of their
// static growth_rate — enabling sequence-of-returns modeling in Monte Carlo.
export async function runSimulation(
  planData: PlanData,
  startDay: number,
  endDay: number,
  yearlyReturns?: number[],
): Promise<SimulationResult[]> {
  // Deep clone so event handler mutations (e.g. _mortgage_state) don't pollute plan_data
  const clone = JSON.parse(JSON.stringify(planData)) as PlanData;

  // Initialise account state from plan accounts
  const accounts: Record<string, AccountState> = {};
  for (const acc of clone.accounts) {
    accounts[acc.name] = {
      balance: 0,
      growth_type: acc.growth || 'None',
      growth_rate: acc.rate ?? 0,
      days_of_usefulness: acc.days_of_usefulness,
      inflation_rate: clone.inflation_rate,
      account_type: acc.account_type,
    };
  }

  const events = parseEventsForSimulation(clone);
  const results: SimulationResult[] = [];

  // Queue for parameter updates triggered during simulation (e.g. loan payoff dates).
  // We collect but don't write back — these are transient within a single run.
  const pendingUpdates = new Map<string, { eventId: number; paramType: string; value: number }>();
  const queue: QueueFn = (eventId, paramType, value) => {
    pendingUpdates.set(`${eventId}:${paramType}`, { eventId, paramType, value });
  };

  let day = startDay;

  while (day <= endDay) {
    applyGrowth(accounts, day - startDay, yearlyReturns);
    applyEventsToDay(day, events, accounts, queue);

    const parts: Record<string, number> = {};
    const nonNetworthParts: Record<string, number> = {};
    let networth = 0;

    for (const name in accounts) {
      if (accounts[name].account_type === 'non-networth-account') {
        nonNetworthParts[name] = accounts[name].balance;
      } else {
        parts[name] = accounts[name].balance;
        networth += accounts[name].balance;
      }
    }

    results.push({ date: day, value: networth, parts, nonNetworthParts });
    day++;
  }

  return results;
}

// Default accounts to use when initializing a new plan_data.
// The AI can reference these account names when adding events.
export const DEFAULT_ACCOUNTS = [
  { name: 'Checking',              category: 'Cash',        growth: 'None',            rate: 0,    account_type: 'regular' },
  { name: 'Savings',               category: 'Cash',        growth: 'Daily Compound',  rate: 0.045, account_type: 'regular' },
  { name: '401k',                  category: 'Retirement',  growth: 'Yearly Compound', rate: 0.07, account_type: 'regular' },
  { name: 'Roth IRA',              category: 'Retirement',  growth: 'Yearly Compound', rate: 0.07, account_type: 'regular' },
  { name: 'Investment',            category: 'Investments', growth: 'Yearly Compound', rate: 0.07, account_type: 'regular' },
  // Tax tracking accounts (system-controlled; excluded from net worth)
  { name: 'Federal Withholdings',  category: 'Tax', growth: 'None', rate: 0, account_type: 'system-controlled' },
  { name: 'State Withholdings',    category: 'Tax', growth: 'None', rate: 0, account_type: 'system-controlled' },
  { name: 'Local Withholdings',    category: 'Tax', growth: 'None', rate: 0, account_type: 'system-controlled' },
  { name: 'Taxable Income',        category: 'Tax', growth: 'None', rate: 0, account_type: 'non-networth-account' },
];
