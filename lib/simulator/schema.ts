// Event library access layer.
// Reads event_schema.json — the static source of truth for all valid event types.
// See STEERING.md → Simulator infrastructure → The event schema.

import eventSchemaJson from './event_schema.json';
import type { SimEvent } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = eventSchemaJson as any;

// ── Public types ───────────────────────────────────────────────────────────

export interface EventListItem {
  type: string;
  display_name: string;
  description: string;
  category: string;
  can_be_reoccurring: boolean;
}

export interface ParameterSpec {
  type: string;
  display_name: string;
  description: string;
  parameter_units: string; // usd | apy | date | envelope | days | years | percentage | enum | ...
  default?: string | number;
  editable?: boolean;
  advanced_option?: boolean;
}

export interface EventFunctionSpec {
  type: string;
  title: string;
  description: string;
  default_state: boolean;
}

export interface UpdatingEventSpec {
  type: string;
  display_name: string;
  description: string;
  parameters: ParameterSpec[];
}

export interface EventSchemaDetail {
  type: string;
  display_name: string;
  description: string;
  category: string;
  can_be_reoccurring: boolean;
  default_title: string;
  parameters: ParameterSpec[];
  updating_events: UpdatingEventSpec[];
  event_functions: EventFunctionSpec[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function stripParams(params: any[]): ParameterSpec[] {
  return (params ?? [])
    .filter((p: any) => p.editable !== false && p.do_not_display_to_user !== true)
    .map((p: any) => ({
      type: p.type,
      display_name: p.display_name ?? p.type,
      description: p.description ?? '',
      parameter_units: p.parameter_units ?? 'string',
      ...(p.default !== undefined ? { default: p.default } : {}),
      ...(p.advanced_option ? { advanced_option: true } : {}),
    }));
}

// ── Public API ─────────────────────────────────────────────────────────────

// All event types visible to users (display_event !== false).
export function getEventList(): EventListItem[] {
  return (raw.events as any[])
    .filter((e: any) => e.display_event !== false)
    .map((e: any) => ({
      type: e.type,
      display_name: e.display_type ?? e.type,
      description: e.description ?? '',
      category: e.category ?? '',
      can_be_reoccurring: e.can_be_reoccurring ?? false,
    }));
}

// Full schema for one event type. Returns null if the type doesn't exist.
export function getEventSchema(eventType: string): EventSchemaDetail | null {
  const event = (raw.events as any[]).find((e: any) => e.type === eventType);
  if (!event) return null;

  return {
    type: event.type,
    display_name: event.display_type ?? event.type,
    description: event.description ?? '',
    category: event.category ?? '',
    can_be_reoccurring: event.can_be_reoccurring ?? false,
    default_title: event.default_title ?? event.display_type ?? event.type,
    parameters: stripParams(event.parameters ?? []),
    updating_events: (event.updating_events ?? []).map((ue: any) => ({
      type: ue.type,
      display_name: ue.display_type ?? ue.type,
      description: ue.description ?? '',
      parameters: stripParams(ue.parameters ?? []),
    })),
    event_functions: (event.event_functions_parts ?? []).map((ef: any) => ({
      type: ef.type,
      title: ef.title,
      description: ef.description ?? '',
      default_state: ef.default_state ?? false,
    })),
  };
}

// Returns true if the event type exists in the schema.
export function isValidEventType(eventType: string): boolean {
  return (raw.events as any[]).some((e: any) => e.type === eventType);
}

// Compute the next available event ID for a plan's event list.
export function nextEventId(events: Pick<SimEvent, 'id'>[]): number {
  if (events.length === 0) return 1;
  return Math.max(...events.map((e) => e.id)) + 1;
}

// The full raw schema — used by schema-checker for validation.
export const rawSchema = raw;
