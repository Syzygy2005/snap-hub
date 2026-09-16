// A tiny ZIP writer, enough to hand Windows a folder it can open by double-clicking.
// Everything is stored uncompressed: the payload is a few KB of text, and stored entries
// keep this to one well-specified format with no dependency and nothing to go wrong.

export interface ZipEntry {
  name: string;
  /** Text is written as UTF-8. Keep it ASCII for files Windows tools will read. */
  content: string | Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS packed date and time, which is what the ZIP header stores. */
function dosStamp(at: Date): { time: number; date: number } {
  return {
    time: (at.getHours() << 11) | (at.getMinutes() << 5) | (Math.floor(at.getSeconds() / 2) & 0x1f),
    date: ((at.getFullYear() - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate(),
  };
}

export function zip(entries: ZipEntry[], at = new Date()): Buffer {
  const { time, date } = dosStamp(at);
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.content as Uint8Array);
    const sum = crc32(data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0); // local file header
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: names are UTF-8
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // no extra field
    name.copy(local, 30);
    locals.push(local, data);

    const entryHeader = Buffer.alloc(46 + name.length);
    entryHeader.writeUInt32LE(0x02014b50, 0); // central directory header
    entryHeader.writeUInt16LE(20, 4); // version made by
    entryHeader.writeUInt16LE(20, 6); // version needed
    entryHeader.writeUInt16LE(0x0800, 8);
    entryHeader.writeUInt16LE(0, 10);
    entryHeader.writeUInt16LE(time, 12);
    entryHeader.writeUInt16LE(date, 14);
    entryHeader.writeUInt32LE(sum, 16);
    entryHeader.writeUInt32LE(data.length, 20);
    entryHeader.writeUInt32LE(data.length, 24);
    entryHeader.writeUInt16LE(name.length, 28);
    entryHeader.writeUInt16LE(0, 30); // extra
    entryHeader.writeUInt16LE(0, 32); // comment
    entryHeader.writeUInt16LE(0, 34); // disk number
    entryHeader.writeUInt16LE(0, 36); // internal attributes
    entryHeader.writeUInt32LE(0, 38); // external attributes
    entryHeader.writeUInt32LE(offset, 42);
    name.copy(entryHeader, 46);
    central.push(entryHeader);

    offset += local.length + data.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory
  end.writeUInt16LE(0, 4); // this disk
  end.writeUInt16LE(0, 6); // disk with the directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // no comment

  return Buffer.concat([...locals, directory, end]);
}
