import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";

export interface DocumentRecord {
  id: string;
  name: string;
  fileType: string;
  storagePath: string;
  anthropicFileId: string | null;
  summary: string | null;
  createdAt: string;
}

function docFromRow(row: {
  id: string;
  name: string;
  file_type: string;
  storage_path: string;
  anthropic_file_id: string | null;
  summary: string | null;
  created_at: string;
}): DocumentRecord {
  return {
    id: row.id,
    name: row.name,
    fileType: row.file_type,
    storagePath: row.storage_path,
    anthropicFileId: row.anthropic_file_id,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json((data ?? []).map(docFromRow));
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Request must be multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const MAX_BYTES = 50 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File must be under 50 MB" }, { status: 400 });
  }

  const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"];
  if (!ALLOWED.includes(file.type)) {
    return Response.json({ error: "Unsupported file type. Upload PDF, PNG, JPG, WEBP, or TXT." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `${user.id}/${randomUUID()}.${ext}`;

  // 1. Upload to Supabase Storage
  const admin = createAdminClient();
  const { error: storageError } = await admin.storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: file.type });

  if (storageError) {
    return Response.json({ error: `Storage upload failed: ${storageError.message}` }, { status: 500 });
  }

  // 2. Upload to Anthropic Files API + summarize (best-effort — failures don't block save)
  let anthropicFileId: string | null = null;
  let summary: string | null = null;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const uploaded = await (anthropic.beta as unknown as {
        files: { upload: (args: { file: File }) => Promise<{ id: string }> }
      }).files.upload(
        { file: new File([buffer], file.name, { type: file.type }) },
      );
      anthropicFileId = uploaded.id;

      const isImage = file.type.startsWith("image/");
      // Files API uses beta content block types not yet in the stable SDK types
      const contentBlock = isImage
        ? { type: "image", source: { type: "file", file_id: anthropicFileId } }
        : { type: "document", source: { type: "file", file_id: anthropicFileId } };

      const msg = await (anthropic.messages.create as (args: unknown) => Promise<{ content: Array<{ type: string; text?: string }> }>)({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              contentBlock,
              {
                type: "text",
                text: "Extract and summarize all key financial information from this document. Include: dollar amounts, dates, account numbers (show last 4 digits only), income figures, tax data, interest rates, loan terms, balances, or any other financially relevant details. Format as a concise structured summary.",
              },
            ],
          },
        ],
        betas: ["files-api-2025-04-14"],
      });

      const textBlock = msg.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") summary = textBlock.text ?? null;
    } catch {
      // Summarization failed — document still saves, summary stays null
    }
  }

  // 3. Save record
  const { data: row, error: dbError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      name: file.name,
      file_type: file.type,
      storage_path: storagePath,
      anthropic_file_id: anthropicFileId,
      summary,
    })
    .select()
    .single();

  if (dbError || !row) {
    // Roll back storage upload on DB failure
    await admin.storage.from("documents").remove([storagePath]);
    return Response.json({ error: `Database save failed: ${dbError?.message}` }, { status: 500 });
  }

  return Response.json(docFromRow(row), { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json() as { id: string };
  if (!id) return Response.json({ error: "Document id required" }, { status: 400 });

  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });

  const admin = createAdminClient();
  await admin.storage.from("documents").remove([doc.storage_path]);

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return new Response(null, { status: 204 });
}
