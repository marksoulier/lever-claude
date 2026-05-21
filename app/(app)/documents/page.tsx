import DocumentsPanel from "./DocumentsPanel";

export const metadata = { title: "Documents — Lever" };

export default function DocumentsPage() {
  return (
    <div className="flex flex-col gap-6 px-8 py-8 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-base font-black text-zinc-900">Financial documents</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Upload tax forms, pay stubs, bank statements, or mortgage docs. Claude reads each file and extracts the key financial details so it has full context when building your plan.
        </p>
      </div>
      <DocumentsPanel />
    </div>
  );
}
