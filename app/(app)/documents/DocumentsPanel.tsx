"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { DocumentRecord } from "@/app/api/documents/route";

function FileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M6 7v5M10 7v5M5 4l.5 9h5L11 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 16V8M8 12l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function typeBadge(mimeType: string) {
  if (mimeType === "application/pdf") return { label: "PDF", color: "bg-red-50 text-red-600 border-red-100" };
  if (mimeType.startsWith("image/")) return { label: "Image", color: "bg-blue-50 text-blue-600 border-blue-100" };
  return { label: "Text", color: "bg-zinc-100 text-zinc-500 border-zinc-200" };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DocumentsPanel() {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    let cancelled = false;
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DocumentRecord[] = await res.json();
      if (!cancelled) setDocs(data);
    } catch (err) {
      if (!cancelled) setError((err as Error).message);
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const cancel = loadDocs();
    return () => { cancel.then((fn) => fn?.()); };
  }, [loadDocs]);

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const doc: DocumentRecord = await res.json();
      setDocs((prev) => [doc, ...prev]);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  async function deleteDoc(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {
      // silently fail — doc stays in list
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed px-6 py-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
          dragOver
            ? "border-teal bg-teal-light"
            : uploading
            ? "border-zinc-200 bg-zinc-50 cursor-wait"
            : "border-zinc-200 bg-zinc-50 hover:border-teal hover:bg-teal-light"
        }`}
      >
        <span className={uploading ? "text-zinc-300" : "text-zinc-400"}>
          <UploadIcon />
        </span>
        <div className="text-center">
          {uploading ? (
            <p className="text-sm font-semibold text-zinc-500">Uploading and summarising…</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-zinc-700">Drop a file or click to browse</p>
              <p className="text-xs text-zinc-400 mt-1">PDF, PNG, JPG, WEBP, or TXT · Max 50 MB</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
          className="hidden"
          onChange={handleFileInput}
          disabled={uploading}
        />
      </div>

      {uploadError && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-600">{uploadError}</p>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-zinc-100 px-5 py-4 shadow-sm flex items-center justify-between">
              <div className="flex flex-col gap-2">
                <div className="h-4 w-44 rounded bg-zinc-100" />
                <div className="h-3 w-28 rounded bg-zinc-100" />
              </div>
              <div className="h-3 w-16 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm font-semibold text-red-600">Could not load documents</p>
          <p className="text-xs text-red-400">{error}</p>
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-6 py-8 text-center">
          <p className="text-sm text-zinc-400">No documents yet. Upload a tax form, pay stub, or bank statement and Claude will summarise the key financial details.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {docs.map((doc) => {
            const badge = typeBadge(doc.fileType);
            const expanded = expandedId === doc.id;
            return (
              <div key={doc.id} className="rounded-2xl border border-zinc-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-zinc-400 shrink-0"><FileIcon /></span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{doc.name}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{formatDate(doc.createdAt)}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.summary && (
                      <button
                        onClick={() => setExpandedId(expanded ? null : doc.id)}
                        className="text-xs font-semibold text-teal hover:text-teal-dark transition-colors"
                      >
                        {expanded ? "Hide" : "Summary"}
                      </button>
                    )}
                    {!doc.summary && (
                      <span className="text-xs text-zinc-400 italic">No summary</span>
                    )}
                    <button
                      onClick={() => deleteDoc(doc.id)}
                      disabled={deletingId === doc.id}
                      className="p-1.5 rounded-lg text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
                      aria-label="Delete document"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                {expanded && doc.summary && (
                  <div className="border-t border-zinc-100 px-5 py-4 bg-zinc-50">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Claude's summary</p>
                    <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{doc.summary}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
