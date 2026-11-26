// Checks USER_PUNCH blocks for a mismatch between -headings and the values written by PUNCH,
// and fixes the heading list when the number of values can be read from the program text.
import { lineKeyword } from './keywords.ts';

export interface PunchCheck {
  line: number;            // 0-based line of the USER_PUNCH keyword
  label: string;           // e.g. "USER_PUNCH 1"
  headings: string[];
  values: number | null;   // null: depends on loops, jumps or conditions
  reason?: 'loop' | 'add_heading';
}

/** Splits on `sep` outside quotes and parentheses. */
function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, q = false, cur = '';
  for (const ch of s) {
    if (ch === '"') q = !q;
    else if (!q && ch === '(') depth++;
    else if (!q && ch === ')') depth = Math.max(0, depth - 1);
    else if (!q && depth === 0 && ch === sep) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** Counts values from the PUNCH statements of one BASIC line; null if the count cannot be known statically. */
function countLine(code: string): { n: number; dynamic?: 'loop' | 'add_heading' } {
  let n = 0;
  let dynamic: 'loop' | 'add_heading' | undefined;
  const noStrings = code.replace(/"[^"]*"/g, '""');
  if (/\bADD_HEADING\b/i.test(noStrings)) dynamic = 'add_heading';
  // REM / ' comments end the line
  const body = noStrings.replace(/(^|:)\s*(REM\b|').*$/i, '$1');
  if (/\b(FOR|NEXT|GOTO|GOSUB|WHILE|WEND|IF)\b/i.test(body) && /\bPUNCH\b/i.test(body)) dynamic ??= 'loop';
  for (const st of splitTop(code, ':')) {
    const m = st.match(/^\s*PUNCH\b(.*)$/i);
    if (m && m[1].trim()) n += splitTop(m[1], ',').filter(a => a.trim()).length;
  }
  return { n, dynamic };
}

export function checkUserPunch(input: string): PunchCheck[] {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const res: PunchCheck[] = [];
  let cur: PunchCheck | null = null;
  let hasJumps = false;
  const close = () => {
    if (cur) { if (hasJumps && cur.values != null) { cur.values = null; cur.reason ??= 'loop'; } res.push(cur); }
    cur = null; hasJumps = false;
  };
  lines.forEach((raw, i) => {
    const kw = lineKeyword(raw);
    if (kw) {
      close();
      if (kw === 'user_punch') cur = { line: i, label: raw.trim().split(/\s+/).slice(0, 2).join(' '), headings: [], values: 0 };
      return;
    }
    if (!cur) return;
    const opt = raw.match(/^\s*-([A-Za-z_]+)\s*(.*)$/);
    if (opt) {
      if (/^head/i.test(opt[1])) cur.headings.push(...opt[2].replace(/#.*$/, '').trim().split(/\s+/).filter(Boolean));
      return;
    }
    const num = raw.match(/^\s*\d+\s*(.*)$/);
    if (!num) return;
    const code = num[1];
    const noStr = code.replace(/"[^"]*"/g, '""');
    if (/\b(GOTO|GOSUB|NEXT|WEND)\b/i.test(noStr)) hasJumps = true;
    const c = countLine(code);
    if (c.dynamic) { cur.values = null; cur.reason = c.dynamic; }
    else if (cur.values != null) cur.values += c.n;
  });
  close();
  return res;
}

/** Blocks whose heading count can be shown to differ from the number of PUNCH values. */
export function punchMismatches(input: string) {
  return checkUserPunch(input).filter(c => c.values != null && c.values !== c.headings.length);
}

/**
 * Rewrites the -headings of mismatched USER_PUNCH blocks: missing names become value_N, extra names are removed.
 * The old -headings lines are replaced by one line written where the first one was (or right after the keyword).
 */
export function fixPunchHeadings(input: string): { text: string; fixed: number } {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const todo = punchMismatches(input);
  for (const c of [...todo].reverse()) {
    const n = c.values!;
    const names = c.headings.slice(0, n);
    while (names.length < n) names.push(`value_${names.length + 1}`);
    let end = lines.length;
    for (let j = c.line + 1; j < lines.length; j++) if (lineKeyword(lines[j])) { end = j; break; }
    let at = -1;
    for (let j = end - 1; j > c.line; j--) {
      if (/^\s*-head/i.test(lines[j])) { at = j; lines.splice(j, 1); }
    }
    const line = '    -headings ' + names.join(' ');
    if (at < 0) at = c.line + 1;
    if (names.length) lines.splice(at, 0, line);
  }
  return { text: lines.join('\n'), fixed: todo.length };
}
