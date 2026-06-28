import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Max characters extracted from any single document (keeps LLM context bounded)
const MAX_CONTENT_CHARS = 50_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

// ─────────────────────────────────────────────────────────────────────────────
// Fetch helpers per source type
// ─────────────────────────────────────────────────────────────────────────────

/** Strip HTML tags and collapse whitespace. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Fetch a GitHub file or README via the GitHub API (works for public repos; token needed for private). */
async function fetchGitHub(url: string, token?: string): Promise<string> {
  // Convert web URL to API URL if needed
  // e.g. https://github.com/org/repo/blob/main/README.md
  //  → https://api.github.com/repos/org/repo/contents/README.md?ref=main
  let apiUrl = url;
  const ghMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/);
  if (ghMatch) {
    const [, owner, repo, ref, path] = ghMatch;
    apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
  } else if (url.match(/github\.com\/([^/]+)\/([^/]+)\/?$/)) {
    const [, owner, repo] = url.match(/github\.com\/([^/]+)\/([^/]+)/)!;
    apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;
  }

  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "StratifyIT-DocFetch/1.0",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(apiUrl, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  if (data.content && data.encoding === "base64") {
    return atob(data.content.replace(/\n/g, ""));
  }
  return data.body ?? data.content ?? JSON.stringify(data);
}

/** Fetch a GitLab file via API. */
async function fetchGitLab(url: string, token?: string): Promise<string> {
  // Convert web URL to API URL
  // e.g. https://gitlab.com/group/repo/-/blob/main/README.md
  const glMatch = url.match(/gitlab\.com\/(.+)\/-\/blob\/([^/]+)\/(.+)/);
  if (glMatch) {
    const [, projectPath, ref, filePath] = glMatch;
    const encodedPath = encodeURIComponent(projectPath);
    const encodedFile = encodeURIComponent(filePath);
    const apiUrl = `https://gitlab.com/api/v4/projects/${encodedPath}/repository/files/${encodedFile}/raw?ref=${ref}`;
    const headers: Record<string, string> = { "User-Agent": "StratifyIT-DocFetch/1.0" };
    if (token) headers["PRIVATE-TOKEN"] = token;
    const res = await fetch(apiUrl, { headers });
    if (!res.ok) throw new Error(`GitLab API ${res.status}: ${await res.text()}`);
    return await res.text();
  }
  // Fallback: fetch as regular URL
  return fetchGenericUrl(url, token);
}

/** Generic HTTP fetch — works for Confluence, SharePoint public exports, any URL. */
async function fetchGenericUrl(url: string, token?: string): Promise<string> {
  const headers: Record<string, string> = {
    "User-Agent": "StratifyIT-DocFetch/1.0",
    "Accept": "text/html,text/plain,application/json,*/*",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);

  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();

  if (contentType.includes("text/html")) return htmlToText(raw);
  if (contentType.includes("application/json")) {
    // Try to pull text fields from JSON (Confluence REST API returns body.storage.value)
    try {
      const obj = JSON.parse(raw);
      const bodyHtml = obj?.body?.storage?.value ?? obj?.body?.view?.value ?? obj?.content ?? "";
      return bodyHtml ? htmlToText(bodyHtml) : raw.slice(0, MAX_CONTENT_CHARS);
    } catch { return raw.slice(0, MAX_CONTENT_CHARS); }
  }
  return raw;
}

/**
 * Handle file_upload source type.
 * The source_url is a Supabase Storage signed URL.
 * - PDF:  sent natively to Claude as a document (base64) — Claude extracts text
 * - DOCX/PPTX: extract text from Office Open XML embedded <w:t> / <a:t> elements
 * - TXT/MD/CSV: return raw text
 * - Other: attempt raw text, fall back to empty
 */
async function fetchStorageFile(url: string, llmKey?: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Storage fetch ${res.status}: ${await res.text()}`);

  const ct = res.headers.get("content-type") ?? "";

  // PDF → send to Gemini natively for text extraction
  if (ct.includes("application/pdf") || url.includes(".pdf")) {
    if (!llmKey) {
      return "[PDF file — LLM key required for text extraction]";
    }
    const bytes = await res.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${llmKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: "application/pdf", data: b64 } },
            { text: "Extract all text content from this document. Return only the extracted text, preserving structure where possible. No commentary." },
          ],
        }],
        generationConfig: { maxOutputTokens: 4096 },
      }),
    });
    if (!geminiRes.ok) throw new Error(`Gemini PDF extraction ${geminiRes.status}: ${await geminiRes.text()}`);
    const geminiData = await geminiRes.json();
    return geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  // DOCX / PPTX — Office Open XML: extract text from <w:t> and <a:t> tags
  if (
    ct.includes("officedocument.wordprocessingml") ||
    ct.includes("officedocument.presentationml") ||
    url.match(/\.(docx|pptx)(\?|$)/i)
  ) {
    const text = await res.text();
    // Extract text nodes from Office XML
    const extracted = (text.match(/<[wa]:t[^>]*>([^<]*)<\/[wa]:t>/g) ?? [])
      .map(m => m.replace(/<[^>]+>/g, ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return extracted || text.slice(0, MAX_CONTENT_CHARS);
  }

  // TXT / MD / CSV / other text formats
  const raw = await res.text();
  return raw;
}

async function fetchContent(sourceType: string, url: string, token?: string, llmKey?: string): Promise<string> {
  let raw: string;
  switch (sourceType) {
    case "github":      raw = await fetchGitHub(url, token); break;
    case "gitlab":      raw = await fetchGitLab(url, token); break;
    case "file_upload": raw = await fetchStorageFile(url, llmKey); break;
    case "confluence":
    case "sharepoint":
    case "url":
    default:            raw = await fetchGenericUrl(url, token); break;
  }
  return raw.slice(0, MAX_CONTENT_CHARS);
}

// ─────────────────────────────────────────────────────────────────────────────
// AI summarisation
// ─────────────────────────────────────────────────────────────────────────────
async function summarise(content: string, title: string): Promise<string> {
  const llmKey = Deno.env.get("LLM_API_KEY");
  if (!llmKey || content.length < 100) return "";

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${llmKey}`;
  const res = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: `Summarise the following document titled "${title}" in 2-3 sentences, focusing on architecture, design decisions, and technical constraints that would be useful for an IT rationalization review.\n\n${content.slice(0, 8000)}` }],
      }],
      generationConfig: { maxOutputTokens: 300 },
    }),
  });

  if (!res.ok) return "";
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // Auth — accept both user JWT (frontend calls) and service role key (triggered by edge function)
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceRole = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    isServiceRole
      ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      : Deno.env.get("SUPABASE_ANON_KEY")!,
    isServiceRole ? {} : { global: { headers: { Authorization: authHeader } } }
  );

  if (!isServiceRole) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ success: false, error: "UNAUTHORIZED" }, 401);
  }

  const body = await req.json() as { document_id: string };
  const { document_id } = body;

  if (!document_id) return json({ success: false, error: "document_id is required" }, 400);

  // Load the document record
  const { data: doc, error: fetchErr } = await supabase
    .from("it_asset_documents")
    .select("*")
    .eq("id", document_id)
    .single();

  if (fetchErr || !doc) return json({ success: false, error: "Document not found" }, 404);

  // Already completed — return cached content
  if (doc.fetch_status === "completed" && doc.content) {
    return json({ success: true, data: { content: doc.content, summary: doc.summary, word_count: doc.word_count } });
  }

  // Skip fetch for paste_text — content should already be stored
  if (doc.source_type === "paste_text") {
    await supabase.from("it_asset_documents").update({
      fetch_status: "completed",
      word_count: doc.content ? doc.content.split(/\s+/).length : 0,
      updated_at: new Date().toISOString(),
    }).eq("id", document_id);
    return json({ success: true, data: { content: doc.content, summary: doc.summary } });
  }

  if (!doc.source_url) return json({ success: false, error: "No source_url on document" }, 400);

  // Mark as fetching
  await supabase.from("it_asset_documents").update({
    fetch_status: "fetching",
    updated_at: new Date().toISOString(),
  }).eq("id", document_id);

  try {
    const llmKey = Deno.env.get("LLM_API_KEY");
    const content = await fetchContent(doc.source_type, doc.source_url, doc.access_token ?? undefined, llmKey);
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const summary = await summarise(content, doc.title);

    await supabase.from("it_asset_documents").update({
      content,
      summary,
      word_count: wordCount,
      fetch_status: "completed",
      fetch_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", document_id);

    return json({ success: true, data: { content: content.slice(0, 500), summary, word_count: wordCount } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("it_asset_documents").update({
      fetch_status: "failed",
      fetch_error: msg,
      updated_at: new Date().toISOString(),
    }).eq("id", document_id);
    return json({ success: false, error: msg }, 500);
  }
});
