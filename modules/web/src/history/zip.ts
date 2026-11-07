// Reads the files in a zip without a library: the central directory says where each file is, and
// the browser's DecompressionStream inflates it. Enough for Spotify's export (no zip64, no encryption).

export type ZipFile = { name: string; read: () => Promise<string> };

const endSignature = 0x06054b50;
const centralSignature = 0x02014b50;

const findEnd = (view: DataView): number => {
  for (let at = view.byteLength - 22; at >= Math.max(0, view.byteLength - 65_557); at--) {
    if (view.getUint32(at, true) === endSignature) return at;
  }

  throw new Error('That file isn’t a zip, or it’s damaged.');
};

const inflate = async (bytes: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> =>
  new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();

const reader =
  (buffer: ArrayBuffer, view: DataView, entry: { method: number; size: number; localAt: number }): (() => Promise<string>) =>
  async () => {
    const nameLength = view.getUint16(entry.localAt + 26, true);
    const extraLength = view.getUint16(entry.localAt + 28, true);
    const start = entry.localAt + 30 + nameLength + extraLength;
    const bytes = new Uint8Array(buffer, start, entry.size);

    if (entry.method !== 0 && entry.method !== 8) throw new Error('The zip uses a compression this page can’t read.');

    return new TextDecoder().decode(entry.method === 0 ? bytes : await inflate(bytes));
  };

export const readZip = async (file: Blob): Promise<ZipFile[]> => {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const end = findEnd(view);
  const count = view.getUint16(end + 10, true);
  const files: ZipFile[] = [];
  let at = view.getUint32(end + 16, true);

  for (let index = 0; index < count && view.getUint32(at, true) === centralSignature; index++) {
    const nameLength = view.getUint16(at + 28, true);
    const name = new TextDecoder().decode(new Uint8Array(buffer, at + 46, nameLength));
    const entry = { method: view.getUint16(at + 10, true), size: view.getUint32(at + 20, true), localAt: view.getUint32(at + 42, true) };

    files.push({ name, read: reader(buffer, view, entry) });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }

  return files;
};
