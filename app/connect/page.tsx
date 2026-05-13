import Link from "next/link";
import { baseURL } from "@/baseUrl";

const MCP_URL = `${baseURL}/api/mcp`;

export default function ConnectPage() {
  return (
    <div className="flex flex-col min-h-full bg-white">
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100">
        <Link href="/" className="text-xl font-black tracking-tight text-zinc-900 lowercase">lever</Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/dashboard" className="text-teal font-semibold">Dashboard</Link>
        </nav>
      </header>

      <main className="flex flex-col gap-8 px-8 py-10 max-w-2xl mx-auto w-full">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-teal mb-2">Setup</div>
          <h1 className="text-3xl font-black text-zinc-900">Connect lever to Claude</h1>
          <p className="text-zinc-500 mt-2 leading-relaxed">
            Add lever as a connector in Claude to update your plan, run what-if scenarios, and explore financial opportunities through conversation.
          </p>
        </div>

        {/* URL copy box */}
        <div className="rounded-2xl border border-teal-mid bg-teal-light p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-dark mb-2">Your lever MCP URL</p>
          <div className="flex items-center gap-3 bg-white rounded-xl border border-teal-mid px-4 py-3">
            <code className="text-sm font-mono text-zinc-800 flex-1 break-all">{MCP_URL}</code>
          </div>
          <p className="text-xs text-zinc-400 mt-2">You'll paste this URL into Claude in the steps below.</p>
        </div>

        {/* Instructions — Pro / Max */}
        <div className="rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
          <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-100">
            <p className="font-black text-zinc-900">Pro or Max plan (personal)</p>
            <p className="text-sm text-zinc-400 mt-0.5">Individual Claude accounts</p>
          </div>
          <div className="flex flex-col divide-y divide-zinc-100">
            {proSteps.map((step, i) => (
              <div key={i} className="flex gap-4 px-6 py-4">
                <div className="w-6 h-6 rounded-full bg-teal flex items-center justify-center text-white text-xs font-black shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{step.title}</p>
                  {step.detail && <p className="text-sm text-zinc-400 mt-0.5">{step.detail}</p>}
                  {step.code && (
                    <code className="inline-block mt-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-700 font-mono">
                      {step.code}
                    </code>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions — Team / Enterprise */}
        <div className="rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
          <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-100">
            <p className="font-black text-zinc-900">Team or Enterprise plan</p>
            <p className="text-sm text-zinc-400 mt-0.5">Admins set up the connector for the whole org</p>
          </div>
          <div className="flex flex-col divide-y divide-zinc-100">
            {teamSteps.map((step, i) => (
              <div key={i} className="flex gap-4 px-6 py-4">
                <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600 text-xs font-black shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{step.title}</p>
                  {step.detail && <p className="text-sm text-zinc-400 mt-0.5">{step.detail}</p>}
                  {step.code && (
                    <code className="inline-block mt-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-700 font-mono">
                      {step.code}
                    </code>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Using it */}
        <div className="rounded-2xl border border-zinc-100 p-6 shadow-sm">
          <h2 className="font-black text-zinc-900 mb-4">Once connected, try asking Claude</h2>
          <div className="flex flex-col gap-2">
            {prompts.map((p) => (
              <div key={p} className="flex items-start gap-3 rounded-xl bg-zinc-50 px-4 py-3">
                <span className="text-teal font-bold shrink-0">›</span>
                <p className="text-sm text-zinc-700 italic">"{p}"</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pb-4">
          <Link
            href="/dashboard"
            className="rounded-full bg-teal px-6 py-3 text-sm font-bold text-white hover:bg-teal-dark transition-colors"
          >
            Back to dashboard
          </Link>
          <a
            href="https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-zinc-200 px-6 py-3 text-sm font-semibold text-zinc-600 hover:border-teal hover:text-teal transition-colors"
          >
            Official docs ↗
          </a>
        </div>
      </main>
    </div>
  );
}

const proSteps = [
  {
    title: "Open Claude and click Customize",
    detail: "In the Claude sidebar or top menu, click Customize.",
  },
  {
    title: "Go to Connectors",
    detail: "Inside Customize, select the Connectors section.",
  },
  {
    title: "Add a custom connector",
    detail: 'Click the "+" button, then select "Add custom connector".',
  },
  {
    title: "Paste the lever MCP URL",
    detail: "Enter the URL below and click Add.",
    code: MCP_URL,
  },
  {
    title: "Enable it in a conversation",
    detail: 'Click the "+" in the chat input, select Connectors, and toggle lever on.',
  },
];

const teamSteps = [
  {
    title: "Open Organization settings",
    detail: "As an admin, go to Organization settings → Connectors.",
  },
  {
    title: "Add a connector",
    detail: 'Click "Add", hover over "Custom", then select "Web".',
  },
  {
    title: "Paste the lever MCP URL",
    detail: "Enter the URL and click Add.",
    code: MCP_URL,
  },
  {
    title: "Members connect individually",
    detail: "Each member goes to Customize → Connectors, finds lever, and clicks Connect.",
  },
];

const prompts = [
  "Show me my financial plan",
  "Run a what-if scenario for retiring at 60",
  "Update my monthly savings to $4,000",
  "What happens if market returns drop to 5%?",
];
