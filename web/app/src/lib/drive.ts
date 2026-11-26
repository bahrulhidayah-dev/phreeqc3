// Google Drive storage through Google Identity Services, with the narrow "drive.file" scope:
// the app can only see files it created or that the user opened with it.
// The host must set VITE_GOOGLE_CLIENT_ID (an OAuth web client ID) at build time.

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export const driveConfigured = () => !!CLIENT_ID;

type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void };
declare global {
  interface Window {
    google?: { accounts: { oauth2: {
      initTokenClient: (o: { client_id: string; scope: string; callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void }) => TokenClient;
      revoke: (token: string, cb?: () => void) => void;
    } } };
  }
}

let token = '';
let expires = 0;

function loadGIS(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error('Google sign-in could not be loaded'));
    document.head.appendChild(s);
  });
}

export async function connectDrive(): Promise<void> {
  if (!CLIENT_ID) throw new Error('not-configured');
  if (token && Date.now() < expires) return;
  await loadGIS();
  await new Promise<void>((res, rej) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPE,
      callback: r => {
        if (r.error || !r.access_token) return rej(new Error(r.error || 'no token'));
        token = r.access_token;
        expires = Date.now() + ((r.expires_in ?? 3600) - 60) * 1000;
        res();
      },
    });
    client.requestAccessToken({ prompt: token ? '' : 'consent' });
  });
}

export function driveConnected() { return !!token && Date.now() < expires; }

export function disconnectDrive() {
  if (token && window.google) window.google.accounts.oauth2.revoke(token);
  token = ''; expires = 0;
}

async function api(url: string, init: RequestInit = {}) {
  await connectDrive();
  const r = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Google Drive: ${r.status} ${await r.text().catch(() => '')}`.slice(0, 300));
  return r;
}

export interface DriveFile { id: string; name: string; modifiedTime: string }

export async function listProjects(): Promise<DriveFile[]> {
  const q = encodeURIComponent("name contains '.aquos' and trashed = false");
  const r = await api(`${API}/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=50`);
  return (await r.json()).files || [];
}

export async function readFile(id: string): Promise<string> {
  return (await api(`${API}/files/${encodeURIComponent(id)}?alt=media`)).text();
}

/** Creates the file, or updates it when an id is given. Returns the file id. */
export async function saveFile(name: string, content: string, id?: string): Promise<string> {
  const boundary = 'aquos' + Math.random().toString(36).slice(2);
  const meta = id ? {} : { name, mimeType: 'application/json' };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
  const url = id ? `${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=multipart&fields=id` : `${UPLOAD}/files?uploadType=multipart&fields=id`;
  const r = await api(url, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  return (await r.json()).id;
}
