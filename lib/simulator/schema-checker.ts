// Plan validation against the event schema.
// Run before every update_plan operation to catch structural errors
// before they reach the simulator.
// Port of modal-canvas-flow/src/hooks/schemaChecker.ts — React dependencies removed.

import { rawSchema, isValidEventType } from './schema';
import type { PlanData, SimEvent, UpdatingEvent } from './types';

// ── Schema extraction ──────────────────────────────────────────────────────

interface SchemaParamMap {
  params: any[];
  updating_events: Record<string, any[]>;
}

// Build a lookup map from event_schema.json for fast validation.
export function extractSchemaMap(): Record<string, SchemaParamMap> {
  const result: Record<string, SchemaParamMap> = {};

  for (const event of (rawSchema.events as any[])) {
    result[event.type] = {
      params: event.parameters ?? [],
      updating_events: {},
    };

    for (const ue of (event.updating_events ?? [])) {
      result[event.type].updating_events[ue.type] = ue.parameters ?? [];
    }
  }

  return result;
}

// ── Validation ─────────────────────────────────────────────────────────────

export interface ValidationError {
  severity: 'error' | 'warning';
  message: string;
}

// Validate a single event's parameters against the schema.
function validateEvent(
  event: SimEvent | UpdatingEvent,
  schemaParams: any[],
  context: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  const providedTypes = new Set(event.parameters.map((p) => p.type));

  // Required params: editable, not hidden, no default
  const requiredTypes = schemaParams
    .filter((p: any) => p.editable !== false && p.do_not_display_to_user !== true && p.default === undefined)
    .map((p: any) => p.type as string);

  for (const required of requiredTypes) {
    if (!providedTypes.has(required)) {
      errors.push({ severity: 'error', message: `${context}: missing required parameter "${required}"` });
    }
  }

  // Duplicate IDs
  const ids = event.parameters.map((p) => p.id);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupIds.length > 0) {
    errors.push({ severity: 'error', message: `${context}: duplicate parameter IDs: ${dupIds.join(', ')}` });
  }

  return errors;
}

// Event types in the schema that have no registered handler in runner.ts.
// Claude can add these to plans; they appear in the event list but produce
// no simulation effect. Listed here so the validator can warn about them.
const UNHANDLED_EVENT_TYPES = new Set([
  'life_event', 'purchase', 'gift', 'marriage', 'divorce', 'pass_away',
  'have_kid', 'moving_costs', 'buy_groceries', 'receive_government_aid',
  'retirement', 'buy_life_insurance', 'buy_health_insurance',
  'income_with_changing_parameters', 'start_business',
]);

// Validate the full plan_data structure. Returns an array of errors (empty = valid).
export function validatePlan(planData: PlanData): ValidationError[] {
  const errors: ValidationError[] = [];
  const schemaMap = extractSchemaMap();

  const eventIds = planData.events.map((e) => e.id);
  const dupEventIds = eventIds.filter((id, i) => eventIds.indexOf(id) !== i);
  if (dupEventIds.length > 0) {
    errors.push({ severity: 'error', message: `Duplicate event IDs: ${dupEventIds.join(', ')}` });
  }

  const accountNames = new Set(planData.accounts.map((a) => a.name));

  for (const event of planData.events) {
    if (event.hide) continue;

    if (!isValidEventType(event.type)) {
      errors.push({ severity: 'error', message: `Unknown event type "${event.type}" (event id ${event.id})` });
      continue;
    }

    if (UNHANDLED_EVENT_TYPES.has(event.type)) {
      errors.push({
        severity: 'warning',
        message: `Event "${event.title ?? event.type}" (id ${event.id}): type "${event.type}" has no simulator handler — it will appear in the plan but produce no financial effect`,
      });
    }

    const eventSchema = schemaMap[event.type];
    const context = `Event "${event.title ?? event.type}" (id ${event.id})`;

    errors.push(...validateEvent(event, eventSchema.params, context));

    // Validate account key references
    for (const param of event.parameters) {
      if (
        (param.type.endsWith('_key') || param.type === 'to_key' || param.type === 'from_key') &&
        typeof param.value === 'string' &&
        param.value !== '' &&
        !accountNames.has(param.value)
      ) {
        errors.push({
          severity: 'warning',
          message: `${context}: parameter "${param.type}" references account "${param.value}" which does not exist in plan accounts`,
        });
      }
    }

    // Validate updating events
    for (const ue of event.updating_events ?? []) {
      const ueSchema = eventSchema.updating_events[ue.type];
      if (!ueSchema) {
        errors.push({ severity: 'warning', message: `${context}: unknown updating event type "${ue.type}"` });
        continue;
      }
      errors.push(...validateEvent(ue, ueSchema, `${context} → updating event "${ue.type}"`));
    }
  }

  return errors;
}

// Returns only hard errors (severity === 'error').
export function getHardErrors(planData: PlanData): string[] {
  return validatePlan(planData)
    .filter((e) => e.severity === 'error')
    .map((e) => e.message);
}
