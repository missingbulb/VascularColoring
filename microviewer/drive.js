// "Load from Google Drive": the user pastes the link of a stack or a folder shared as "Anyone with the
// link", with no sign-in. Google answers a page on another site only through the Drive API with an API
// key (MV_CONFIG.google.apiKey, written into config.js at deploy): its plain download link refuses any
// request a browser marks cross-site. Nothing is kept: the file is read like one from the computer.

const config = window.MV_CONFIG || {};
const key = (config.google || {}).apiKey || '';
const API = 'https://www.googleapis.com/drive/v3/files';

export const ready = !!key;
export const defaultLink = (config.drive || {}).defaultLink || '';

// {kind: "file" | "folder", id} from any Drive link; a bare id is looked up
export function parse(link) {
  const s = link.trim();
  let m = s.match(/\/folders\/([\w-]{10,})/);
  if (m) return { kind: 'folder', id: m[1] };
  m = s.match(/\/file\/d\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/) || s.match(/^([\w-]{20,})$/);
  return m ? { kind: 'file', id: m[1] } : null;
}

const need = () => { if (!key) throw new Error('this site has no Google API key yet'); };
const refused = (r, what) => new Error(r.status === 400
  ? `Google refused this site's API key (${r.status})`
  : `Drive refused the ${what} (${r.status}): is it shared as "Anyone with the link"?`);

// {name, bytes}, or {folder: true, id, name} when the link named a folder; onStart(name) runs once the
// download begins and onProgress(got, total) as pieces arrive, total null when Drive does not say
export async function file(id, name, onStart, onProgress) {
  need();
  const at = `${API}/${encodeURIComponent(id)}`;
  if (!name) {
    const r = await fetch(`${at}?fields=name,mimeType&key=${key}`);
    if (!r.ok) throw refused(r, 'file');
    const f = await r.json();
    if (f.mimeType === 'application/vnd.google-apps.folder') return { folder: true, id, name: f.name };
    name = f.name;
  }
  const r = await fetch(`${at}?alt=media&key=${key}`);
  if (!r.ok) throw refused(r, 'file');
  if (onStart) onStart(name);
  const total = +r.headers.get('content-length') || null;
  if (!r.body) return { name, bytes: await r.arrayBuffer() };
  let buf = new Uint8Array(total || 1 << 24), got = 0;
  for (const reader = r.body.getReader(); ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    if (got + value.length > buf.length) {
      const more = new Uint8Array(Math.max(2 * buf.length, got + value.length));
      more.set(buf.subarray(0, got)); buf = more;
    }
    buf.set(value, got); got += value.length;
    if (onProgress) onProgress(got, total);
  }
  return { name, bytes: got === buf.length ? buf.buffer : buf.buffer.slice(0, got) };
}

// [{id, name, folder, size, created}] in a public folder: its subfolders and its TIFF stacks; size in
// bytes (null for a folder), created a Date
export async function list(id) {
  need();
  const q = encodeURIComponent(`'${id}' in parents and trashed = false`);
  const r = await fetch(`${API}?q=${q}&fields=files(id,name,mimeType,size,createdTime)&pageSize=1000&orderBy=folder,name&key=${key}`);
  if (!r.ok) throw refused(r, 'folder');
  return (await r.json()).files
    .map((f) => ({ id: f.id, name: f.name, folder: f.mimeType === 'application/vnd.google-apps.folder',
      size: f.size == null ? null : +f.size, created: f.createdTime ? new Date(f.createdTime) : null }))
    .filter((f) => f.folder || /\.tiff?$/i.test(f.name));
}
