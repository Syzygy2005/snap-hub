import { describe, expect, it } from "vitest";
import { crc32, zip } from "./zip";

describe("crc32", () => {
  // The standard check value for CRC-32/ISO-HDLC.
  it("matches the published check value", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
    expect(crc32(Buffer.from(""))).toBe(0);
  });
});

describe("zip", () => {
  const archive = zip([
    { name: "a.txt", content: "hello" },
    { name: "folder/b.txt", content: "second file" },
  ]);

  it("starts with a local file header and ends with the central directory record", () => {
    expect(archive.readUInt32LE(0)).toBe(0x04034b50);
    expect(archive.readUInt32LE(archive.length - 22)).toBe(0x06054b50);
  });

  it("records both entries", () => {
    expect(archive.readUInt16LE(archive.length - 14)).toBe(2);
    expect(archive.readUInt16LE(archive.length - 12)).toBe(2);
  });

  it("points the central directory at a real offset inside the archive", () => {
    const size = archive.readUInt32LE(archive.length - 10);
    const at = archive.readUInt32LE(archive.length - 6);
    expect(at + size).toBe(archive.length - 22);
    expect(archive.readUInt32LE(at)).toBe(0x02014b50);
  });

  it("stores the content uncompressed and intact", () => {
    expect(archive.includes(Buffer.from("hello"))).toBe(true);
    expect(archive.includes(Buffer.from("second file"))).toBe(true);
  });

  it("writes an empty archive without entries", () => {
    const empty = zip([]);
    expect(empty).toHaveLength(22);
    expect(empty.readUInt32LE(0)).toBe(0x06054b50);
  });
});
