export interface RunRequest {
  id: number;
  base: string;
  input: string;
  database: { name: string; text: string };
  files?: Record<string, string>;
}
export interface RunResult {
  id: number;
  ok: boolean;
  rc: number;
  output: string;
  log: string;
  files: Record<string, string>;
  screen: string;
  errors: string;
  ms: number;
}
