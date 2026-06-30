import * as XLSX from 'xlsx';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CapabilityNode {
  name: string;
  description: string;
  level: 1 | 2 | 3;
  strategic_importance: 'critical' | 'high' | 'medium' | 'low';
  is_ai_priority: boolean;
  children: CapabilityNode[];
}

export interface FlatCapability {
  id: string;
  name: string;
  description: string;
  level: number;
  parent_id: string | null;
  strategic_importance: string;
  is_ai_priority: boolean;
}

export interface MappingSuggestion {
  capability_id: string;
  capability_name: string;
  supporting_assets: {
    asset_id: string;
    asset_name: string;
    confidence: number;
    mapping_type: 'primary' | 'secondary' | 'enabling';
    rationale: string;
  }[];
}

export interface ParsedRow {
  l1: string;
  l2: string;
  l3: string;
  description?: string;
}

// ── File parsing ──────────────────────────────────────────────────────────────

function detectDelimiter(line: string): string {
  const counts = { ',': 0, '\t': 0, ';': 0 };
  for (const ch of line) {
    if (ch in counts) counts[ch as keyof typeof counts]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCSVLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Try to detect the column layout and return {l1, l2, l3, desc?} indices
function detectColumns(headers: string[]): { l1: number; l2: number; l3: number; desc: number } | null {
  const norm = headers.map(normaliseHeader);

  // Format A: explicit L1/L2/L3 columns
  const l1i = norm.findIndex(h => ['l1', 'level1', 'capability', 'domain'].includes(h));
  const l2i = norm.findIndex(h => ['l2', 'level2', 'subcapability', 'subdomain'].includes(h));
  const l3i = norm.findIndex(h => ['l3', 'level3', 'process', 'activity'].includes(h));
  if (l1i >= 0 && l2i >= 0) {
    const desc = norm.findIndex(h => ['description', 'desc', 'detail', 'notes'].includes(h));
    return { l1: l1i, l2: l2i, l3: l3i >= 0 ? l3i : -1, desc };
  }

  // Format B: first three columns are L1, L2, L3 (no header match needed)
  if (headers.length >= 2) {
    return { l1: 0, l2: 1, l3: headers.length >= 3 ? 2 : -1, desc: headers.length >= 4 ? 3 : -1 };
  }

  return null;
}

/** Parse CSV text into structured rows */
export function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const delim = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delim);
  const cols = detectColumns(headers);
  if (!cols) return [];

  const rows: ParsedRow[] = [];
  let lastL1 = '';
  let lastL2 = '';

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i], delim);
    const l1 = cols.l1 >= 0 ? (cells[cols.l1] ?? '').trim() : '';
    const l2 = cols.l2 >= 0 ? (cells[cols.l2] ?? '').trim() : '';
    const l3 = cols.l3 >= 0 ? (cells[cols.l3] ?? '').trim() : '';
    const desc = cols.desc >= 0 ? (cells[cols.desc] ?? '').trim() : '';

    // Fill down blanks (hierarchical CSV pattern)
    if (l1) lastL1 = l1;
    if (l2) lastL2 = l2;

    const resolvedL1 = l1 || lastL1;
    const resolvedL2 = l2 || lastL2;

    if (!resolvedL1) continue;

    rows.push({ l1: resolvedL1, l2: resolvedL2, l3, description: desc });
  }
  return rows;
}

/** Parse XLS/XLSX binary and return structured rows */
export function parseExcel(buffer: ArrayBuffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

  if (!raw.length) return [];
  const headers = Object.keys(raw[0]);
  const cols = detectColumns(headers);
  if (!cols) return [];

  const rows: ParsedRow[] = [];
  let lastL1 = '';
  let lastL2 = '';

  for (const row of raw) {
    const vals = Object.values(row) as string[];
    const l1 = (cols.l1 >= 0 ? String(vals[cols.l1] ?? '') : '').trim();
    const l2 = (cols.l2 >= 0 ? String(vals[cols.l2] ?? '') : '').trim();
    const l3 = (cols.l3 >= 0 ? String(vals[cols.l3] ?? '') : '').trim();
    const desc = (cols.desc >= 0 ? String(vals[cols.desc] ?? '') : '').trim();

    if (l1) lastL1 = l1;
    if (l2) lastL2 = l2;
    const resolvedL1 = l1 || lastL1;
    const resolvedL2 = l2 || lastL2;

    if (!resolvedL1) continue;
    rows.push({ l1: resolvedL1, l2: resolvedL2, l3, description: desc });
  }
  return rows;
}

/** Convert flat rows into a tree structure for preview */
export function rowsToTree(rows: ParsedRow[]): CapabilityNode[] {
  const l1Map = new Map<string, CapabilityNode>();
  const l2Map = new Map<string, CapabilityNode>();

  for (const row of rows) {
    if (!row.l1) continue;

    if (!l1Map.has(row.l1)) {
      const node: CapabilityNode = {
        name: row.l1, description: row.description ?? '', level: 1,
        strategic_importance: 'medium', is_ai_priority: false, children: [],
      };
      l1Map.set(row.l1, node);
    }

    if (row.l2) {
      const l2Key = `${row.l1}|${row.l2}`;
      if (!l2Map.has(l2Key)) {
        const node: CapabilityNode = {
          name: row.l2, description: row.description ?? '', level: 2,
          strategic_importance: 'medium', is_ai_priority: false, children: [],
        };
        l2Map.set(l2Key, node);
        l1Map.get(row.l1)!.children.push(node);
      }

      if (row.l3) {
        const l2Node = l2Map.get(l2Key)!;
        if (!l2Node.children.find(c => c.name === row.l3)) {
          l2Node.children.push({
            name: row.l3, description: row.description ?? '', level: 3,
            strategic_importance: 'medium', is_ai_priority: false, children: [],
          });
        }
      }
    }
  }

  return Array.from(l1Map.values());
}

// ── Supabase persistence ──────────────────────────────────────────────────────

/** Bulk-insert a capability tree into Supabase, returning inserted count */
export async function importCapabilityTree(
  orgId: number,
  tree: CapabilityNode[],
  userId: string,
  replaceExisting = false,
): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase not configured');

  if (replaceExisting) {
    await supabase.from('business_capabilities').delete().eq('org_id', orgId);
  }

  let count = 0;

  const insertLevel = async (nodes: CapabilityNode[], parentId: string | null, sortOffset = 0) => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const { data, error } = await supabase!
        .from('business_capabilities')
        .insert({
          org_id: orgId,
          level: node.level,
          parent_id: parentId,
          name: node.name,
          description: node.description || null,
          is_ai_priority: node.is_ai_priority,
          strategic_importance: node.strategic_importance,
          sort_order: sortOffset + i,
          created_by: userId,
        })
        .select('id')
        .single();

      if (error) throw error;
      count++;

      if (node.children?.length) {
        await insertLevel(node.children, data.id, 0);
      }
    }
  };

  await insertLevel(tree, null, 0);
  return count;
}

// ── Edge Function calls ───────────────────────────────────────────────────────

async function callCapabilitiesFunction(payload: Record<string, unknown>): Promise<unknown> {
  if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase not configured');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const base = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${base}/functions/v1/ai-capabilities`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI capabilities function error ${res.status}: ${err}`);
  }
  return res.json();
}

export async function generateCapabilityModel(answers: {
  sector: string;
  org_size: string;
  business_model: string;
  customers: string;
  core_functions: string[];
  strategic_priorities: string;
  tech_challenges: string;
  mission: string;
  strategic_goals: string;
  existing_assets?: string[];
}): Promise<{ capabilities: CapabilityNode[] }> {
  const result = await callCapabilitiesFunction({ action: 'generate_model', ...answers }) as any;
  return result;
}

export async function getAssetMappingSuggestions(
  capabilities: FlatCapability[],
  assets: { id: string; name: string; type: string; description: string; tags: string[]; category: string }[],
): Promise<{ mappings: MappingSuggestion[] }> {
  // Replace UUIDs with short sequential IDs so the LLM reliably echoes them back.
  const capIdMap = new Map<string, string>(); // shortId → real UUID
  const assetIdMap = new Map<string, string>();

  const simpleCaps = capabilities.map((c, i) => {
    const sid = `c${i + 1}`;
    capIdMap.set(sid, c.id);
    return { ...c, id: sid };
  });

  const simpleAssets = assets.map((a, i) => {
    const sid = `a${i + 1}`;
    assetIdMap.set(sid, a.id);
    return { ...a, id: sid };
  });

  const result = await callCapabilitiesFunction({ action: 'map_assets', capabilities: simpleCaps, assets: simpleAssets }) as any;

  // Translate short IDs back to real UUIDs; drop any the LLM hallucinated.
  const mappings: MappingSuggestion[] = (result.mappings ?? [])
    .map((m: any) => {
      const realCapId = capIdMap.get(m.capability_id);
      if (!realCapId) return null;
      const supporting_assets = (m.supporting_assets ?? [])
        .map((a: any) => {
          const realAssetId = assetIdMap.get(a.asset_id);
          if (!realAssetId) return null;
          return { ...a, asset_id: realAssetId };
        })
        .filter(Boolean);
      return { ...m, capability_id: realCapId, supporting_assets };
    })
    .filter(Boolean);

  return { mappings };
}

// ── Asset mapping persistence ─────────────────────────────────────────────────

export async function saveAssetMappings(
  orgId: number,
  mappings: { assetId: string; capabilityId: string; confidence: number; mappingType: string; rationale: string }[],
  userId: string,
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase || !mappings.length) return;

  const rows = mappings.map(m => ({
    org_id: orgId,
    asset_id: m.assetId,
    capability_id: m.capabilityId,
    confidence_score: m.confidence,
    mapping_type: m.mappingType,
    rationale: m.rationale,
    created_by: userId,
  }));

  const { error } = await supabase
    .from('asset_capability_mappings')
    .upsert(rows, { onConflict: 'asset_id,capability_id' });

  if (error) throw error;
}

export async function getAssetMappingsForOrg(orgId: number) {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase
    .from('asset_capability_mappings')
    .select('*, business_capabilities(name,level), it_assets(name,type)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function clearAssetMappings(orgId: number): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase
    .from('asset_capability_mappings')
    .delete()
    .eq('org_id', orgId);
  if (error) throw error;
}

export async function deleteAssetMapping(id: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase
    .from('asset_capability_mappings')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function addSingleAssetMapping(
  orgId: number,
  assetId: string,
  capabilityId: string,
  relationshipType: 'primary' | 'secondary' | 'enabling',
  userId: string,
  rationale = '',
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase
    .from('asset_capability_mappings')
    .upsert(
      {
        org_id: orgId,
        asset_id: assetId,
        capability_id: capabilityId,
        mapping_type: 'manual',           // DB constraint: manual | ai_suggested | confirmed
        confidence_score: 1.0,
        rationale: `[${relationshipType}]${rationale ? ' ' + rationale : ''}`,
        created_by: userId,
      },
      { onConflict: 'asset_id,capability_id' },
    );
  if (error) throw error;
}
