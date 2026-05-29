#!/usr/bin/env npx tsx
// Track 2 — LLM integration tests.
// Uses the Claude API to validate the live MCP server end-to-end.
// Tests both the raw HTTP layer and Claude's ability to call tools correctly.
//
// Run: npx tsx scripts/test/llm-integration.ts
// Requires: ANTHROPIC_API_KEY in env, dev server running on localhost:3000,
//           a demo user token in LEVER_TEST_TOKEN env (or hardcoded below).

import Anthropic from '@anthropic-ai/sdk';

const MCP_BASE = 'http://localhost:3000/api/mcp';
// Set LEVER_TEST_TOKEN to the demo user's api_token from the profiles table
const TEST_TOKEN = process.env.LEVER_TEST_TOKEN ?? '023db807-4bad-4c94-bb25-66ce929768e4';
const MCP_URL = `${MCP_BASE}?token=${TEST_TOKEN}`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Test harness ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const findings: string[] = [];

function pass(name: string) {
  console.log(`  ✓ ${name}`);
  passed++;
}

function fail(name: string, detail: string) {
  console.log(`  ✗ ${name}`);
  console.log(`    ${detail}`);
  failed++;
  findings.push(`FAIL: ${name} — ${detail}`);
}

function section(name: string) {
  console.log(`\n── ${name} ──`);
}

// ── MCP HTTP helpers ───────────────────────────────────────────────────────

async function mcpCall(method: string, params: object = {}): Promise<any> {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const text = await res.text();
  // SSE response: find the data: line
  const dataLine = text.split('\n').find((l) => l.startsWith('data: '));
  if (!dataLine) throw new Error(`No data line in response: ${text.slice(0, 200)}`);
  return JSON.parse(dataLine.slice(6));
}

async function toolCall(name: string, args: object = {}): Promise<string> {
  const result = await mcpCall('tools/call', { name, arguments: args });
  const content = result?.result?.content?.[0]?.text;
  if (!content) throw new Error(`No content in tool response: ${JSON.stringify(result).slice(0, 300)}`);
  return content;
}

// ── Section 1: Protocol layer ──────────────────────────────────────────────

async function testProtocol() {
  section('Protocol layer (raw HTTP)');

  // Handshake
  try {
    const r = await mcpCall('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' },
    });
    r?.result?.protocolVersion === '2024-11-05'
      ? pass('MCP handshake returns correct protocolVersion')
      : fail('MCP handshake', `Expected protocolVersion 2024-11-05, got ${r?.result?.protocolVersion}`);
  } catch (e: any) {
    fail('MCP handshake', e.message);
  }

  // Tool list
  try {
    const r = await mcpCall('tools/list');
    const tools: string[] = (r?.result?.tools ?? []).map((t: any) => t.name);
    const required = ['get_event_schema', 'update_plan', 'get_plan_data', 'create_plan', 'get_onboarding_status'];
    for (const name of required) {
      tools.includes(name)
        ? pass(`Tool "${name}" is registered`)
        : fail(`Tool "${name}" registered`, `Not found in tool list: ${tools.join(', ')}`);
    }
    tools.length >= 14
      ? pass(`Total tool count is ${tools.length} (≥14 expected)`)
      : fail('Tool count', `Only ${tools.length} tools registered`);
  } catch (e: any) {
    fail('tools/list', e.message);
  }
}

// ── Section 2: Tool correctness ────────────────────────────────────────────

async function testTools() {
  section('Tool correctness (direct calls)');

  // get_event_schema — no args
  try {
    const text = await toolCall('get_event_schema', {});
    text.includes('event types available')
      ? pass('get_event_schema (no args) returns event list')
      : fail('get_event_schema no args', `Unexpected response: ${text.slice(0, 100)}`);
    text.includes('get_job')
      ? pass('get_event_schema lists get_job event')
      : fail('get_event_schema lists get_job', 'get_job not found in response');
  } catch (e: any) {
    fail('get_event_schema no args', e.message);
  }

  // get_event_schema — specific type
  try {
    const text = await toolCall('get_event_schema', { event_type: 'get_job' });
    const schema = JSON.parse(text);
    schema.type === 'get_job'
      ? pass('get_event_schema(get_job) returns correct type')
      : fail('get_event_schema(get_job) type', `Expected get_job, got ${schema.type}`);
    Array.isArray(schema.parameters) && schema.parameters.length > 0
      ? pass('get_event_schema(get_job) has parameters')
      : fail('get_event_schema(get_job) parameters', 'No parameters returned');
    schema.parameters?.some((p: any) => p.type === 'salary')
      ? pass('get_event_schema(get_job) includes salary parameter')
      : fail('get_event_schema(get_job) salary param', 'salary parameter not found');
  } catch (e: any) {
    fail('get_event_schema(get_job)', e.message);
  }

  // get_event_schema — invalid type
  try {
    const text = await toolCall('get_event_schema', { event_type: 'not_real' });
    text.includes('Unknown event type')
      ? pass('get_event_schema returns error for unknown type')
      : fail('get_event_schema unknown type', `Expected error message, got: ${text.slice(0, 80)}`);
  } catch (e: any) {
    fail('get_event_schema unknown type', e.message);
  }

  // get_plan_data
  try {
    const text = await toolCall('get_plan_data', {});
    const isNoData = text.includes('no plan_data yet');
    const hasData = text.includes('birth_date') || text.includes('events');
    isNoData || hasData
      ? pass('get_plan_data returns plan or graceful empty message')
      : fail('get_plan_data', `Unexpected response: ${text.slice(0, 120)}`);
  } catch (e: any) {
    fail('get_plan_data', e.message);
  }

  // update_plan — add a valid event
  try {
    const text = await toolCall('update_plan', {
      op: 'add_event',
      event_type: 'inflow',
      title: 'LLM Test Inflow',
      is_recurring: true,
      parameters: [
        { type: 'start_time',     value: '2025-01-01' },
        { type: 'end_time',       value: '2030-01-01' },
        { type: 'amount',         value: 1000 },
        { type: 'frequency_days', value: 30 },
        { type: 'to_key',         value: 'Checking' },
      ],
    });
    text.includes('add_event applied')
      ? pass('update_plan(add_event) succeeds')
      : fail('update_plan add_event', `Unexpected response: ${text.slice(0, 120)}`);
    text.includes('Simulation ran over')
      ? pass('update_plan triggers simulation run')
      : fail('update_plan triggers simulation', 'No simulation output in response');
    text.includes('Projected balance')
      ? pass('update_plan returns projected balance after simulation')
      : fail('update_plan projected balance', 'Projected balance not in response');
  } catch (e: any) {
    fail('update_plan add_event', e.message);
  }

  // update_plan — invalid event type
  try {
    const text = await toolCall('update_plan', {
      op: 'add_event',
      event_type: 'fake_event_type',
      parameters: [],
    });
    text.toLowerCase().includes('unknown event type') || text.toLowerCase().includes('unknown')
      ? pass('update_plan rejects unknown event type')
      : fail('update_plan unknown type', `Expected rejection, got: ${text.slice(0, 80)}`);
  } catch (e: any) {
    fail('update_plan unknown type', e.message);
  }

  // update_plan — missing required fields
  try {
    const text = await toolCall('update_plan', { op: 'remove_event' });
    text.includes('requires event_id')
      ? pass('update_plan(remove_event) requires event_id')
      : fail('update_plan remove_event validation', `Expected error, got: ${text.slice(0, 80)}`);
  } catch (e: any) {
    fail('update_plan remove_event validation', e.message);
  }

  // get_onboarding_status
  try {
    const text = await toolCall('get_onboarding_status', {});
    const status = JSON.parse(text);
    typeof status.authenticated === 'boolean'
      ? pass('get_onboarding_status returns authenticated field')
      : fail('get_onboarding_status', 'Missing authenticated field');
    Array.isArray(status.completedSteps)
      ? pass('get_onboarding_status returns completedSteps array')
      : fail('get_onboarding_status completedSteps', 'completedSteps not an array');
  } catch (e: any) {
    fail('get_onboarding_status', e.message);
  }
}

// ── Section 3: LLM tool selection ─────────────────────────────────────────
// Verifies Claude calls the RIGHT tool when prompted naturally.

async function testLLMToolSelection() {
  section('LLM tool selection (Claude calls our tools)');

  const MCP_TOOL_DEFS = [
    {
      name: 'get_event_schema',
      description: 'Browse the financial event library or get schema for a specific event type.',
      input_schema: { type: 'object' as const, properties: { event_type: { type: 'string' } } },
    },
    {
      name: 'get_plan_data',
      description: "Read the user's current financial plan.",
      input_schema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'update_plan',
      description: 'Add, remove, or update events in the financial plan.',
      input_schema: {
        type: 'object' as const,
        properties: {
          op: { type: 'string', enum: ['add_event', 'remove_event', 'update_field'] },
          event_type: { type: 'string' },
          parameters: { type: 'array' },
        },
        required: ['op'],
      },
    },
  ];

  async function assertToolCalled(prompt: string, expectedTool: string, testName: string) {
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        tools: MCP_TOOL_DEFS,
        messages: [{ role: 'user', content: prompt }],
      });
      const toolUse = response.content.find((b) => b.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        fail(testName, `Claude did not call any tool (stop_reason: ${response.stop_reason})`);
        return;
      }
      toolUse.name === expectedTool
        ? pass(`${testName} → called ${toolUse.name}`)
        : fail(testName, `Expected ${expectedTool}, Claude called ${toolUse.name}`);
    } catch (e: any) {
      fail(testName, e.message);
    }
  }

  await assertToolCalled(
    'What financial events are available for me to add to my plan?',
    'get_event_schema',
    'Browsing event library',
  );

  await assertToolCalled(
    'Show me my current financial plan.',
    'get_plan_data',
    'Reading plan data',
  );

  await assertToolCalled(
    'Add a monthly rent payment of $1,200 to my plan starting January 2025.',
    'update_plan',
    'Adding an event to plan',
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Track 2 — LLM Integration Tests');
  console.log(`MCP server: ${MCP_URL}`);
  console.log('');

  await testProtocol();
  await testTools();

  if (process.env.ANTHROPIC_API_KEY) {
    await testLLMToolSelection();
  } else {
    console.log('\n── LLM tool selection (skipped — no ANTHROPIC_API_KEY) ──');
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (findings.length > 0) {
    console.log('\nFindings to address:');
    findings.forEach((f) => console.log(`  ${f}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
