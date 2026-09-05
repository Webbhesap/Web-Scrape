/**
 * Minimal ZIP (STORE / no compression) writer.
 */
(function (root, factory) {
  const result = factory();
  if (typeof module === 'object' && module.exports) module.exports = result;
  if (root) root.SimpleZip = result;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function strToBytes(str) {
    return new TextEncoder().encode(str);
  }

  function u16(n) { return new Uint8Array([n & 255, (n >>> 8) & 255]); }
  function u32(n) {
    return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
  }

  function concat(parts) {
    const len = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    parts.forEach((p) => { out.set(p, o); o += p.length; });
    return out;
  }

  async function build(files) {
    const list = Array.isArray(files) ? files : [];
    // The classic ZIP end-of-central-directory record stores the entry count
    // and the offsets as 16/32-bit integers. Past 65535 entries (or a 4 GiB
    // archive) those fields silently wrap and the resulting file is corrupt —
    // every extractor reports "unexpected end of archive" with no hint about
    // the real cause. Fail loudly instead: a gallery ZIP of a large scrape can
    // genuinely reach these limits.
    if (list.length > 0xFFFF) {
      throw new Error(`Too many files for a single ZIP archive: ${list.length} (max 65535). Split the selection into smaller batches.`);
    }
    let totalBytes = 0;
    for (const file of list) {
      const size = (file && file.data) ? (file.data.byteLength !== undefined ? file.data.byteLength : file.data.length) : 0;
      totalBytes += size;
    }
    if (totalBytes > 0xFFFFFFFF) {
      throw new Error(`Archive too large for the ZIP format: ${totalBytes} bytes (max 4 GiB). Split the selection into smaller batches.`);
    }

    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const file of list) {
      const name = strToBytes(file.name.replace(/\\/g, '/'));
      const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
      const crc = crc32(data);
      const local = concat([
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0),
        name, data
      ]);
      const central = concat([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(offset), name
      ]);
      locals.push(local);
      centrals.push(central);
      offset += local.length;
    }
    const centralDir = concat(centrals);
    const end = concat([
      u32(0x06054b50), u16(0), u16(0), u16(list.length), u16(list.length),
      u32(centralDir.length), u32(offset), u16(0)
    ]);
    return concat([...locals, centralDir, end]);
  }

  return { build: build };
}));
