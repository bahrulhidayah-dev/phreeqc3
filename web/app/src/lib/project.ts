// Project files (.aquos) and the browser autosave.
import type { ChartStyle } from '../components/chartStyle.ts';

export interface Project {
  app: 'aquos-geochemistry';
  version: 1;
  name: string;
  input: string;
  database: string;                 // manifest path, "@examples/<file>", or "@custom/<name>"
  customDatabase?: { name: string; text: string };
  files: Record<string, string>;    // data files the input reads (INCLUDE$, csv overlays, ...)
  charts: Record<string, ChartStyle>;
  updated: string;
}

export const STARTER = `TITLE My first model: calcite in contact with the atmosphere
SOLUTION 1  Rain water
    units      mg/L
    temp       25
    pH         5.6
    Ca         0.5
    Cl         0.7
    Alkalinity 0.2 as HCO3
EQUILIBRIUM_PHASES 1
    Calcite    0.0   10.0
    CO2(g)    -3.4   10.0
SELECTED_OUTPUT 1
    -file      results.sel
    -pH        true
    -totals    Ca C(4)
    -saturation_indices  Calcite  Aragonite
END
`;

export function newProject(name = ''): Project {
  return { app: 'aquos-geochemistry', version: 1, name, input: STARTER, database: 'phreeqc.dat', files: {}, charts: {}, updated: new Date().toISOString() };
}

export function serializeProject(p: Project): string {
  return JSON.stringify({ ...p, updated: new Date().toISOString() }, null, 1);
}

export function parseProject(text: string): Project | null {
  try {
    const o = JSON.parse(text);
    if (o?.app !== 'aquos-geochemistry' || typeof o.input !== 'string') return null;
    return { ...newProject(), ...o, files: o.files || {}, charts: o.charts || {} };
  } catch { return null; }
}

const KEY = 'aquos-project';
export function loadAutosave(): Project | null {
  try { const s = localStorage.getItem(KEY); return s ? parseProject(s) : null; } catch { return null; }
}
export function autosave(p: Project) {
  try { localStorage.setItem(KEY, serializeProject(p)); } catch { /* storage full or blocked */ }
}

export const prefs = {
  get(k: string, d = '') { try { return localStorage.getItem('aquos-' + k) ?? d; } catch { return d; } },
  set(k: string, v: string) { try { localStorage.setItem('aquos-' + k, v); } catch { /* ignore */ } },
};
