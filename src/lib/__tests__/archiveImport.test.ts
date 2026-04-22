import { describe, expect, it } from "vitest";
import { normalizeArchiveTweet, parseTwitterArchiveZip, stripJsAssignment } from "../archiveImport";

describe("stripJsAssignment", () => {
  it("removes the window.YTD assignment prefix", () => {
    const input = 'window.YTD.tweets.part0 = [{"tweet":{"id":"1"}}]';
    expect(stripJsAssignment(input)).toBe('[{"tweet":{"id":"1"}}]');
  });

  it("leaves already-json content alone", () => {
    const input = '[{"tweet":{"id":"1"}}]';
    expect(stripJsAssignment(input)).toBe(input);
  });
});

describe("normalizeArchiveTweet", () => {
  const baseTweet = {
    id_str: "1234567890",
    created_at: "Fri Mar 24 12:00:00 +0000 2017",
    full_text: "hello world",
    favorite_count: "3",
    retweet_count: 0,
    reply_count: 1,
    quote_count: 0
  };

  it("classifies a standard post", () => {
    const result = normalizeArchiveTweet({ tweet: { ...baseTweet } });
    expect(result).toMatchObject({
      providerPostId: "1234567890",
      type: "post",
      text: "hello world",
      likes: 3,
      replies: 1,
      hasMedia: false
    });
    expect(result?.postedAt.getUTCFullYear()).toBe(2017);
  });

  it("classifies replies when in_reply_to_status_id_str is present", () => {
    const result = normalizeArchiveTweet({
      tweet: { ...baseTweet, in_reply_to_status_id_str: "555" }
    });
    expect(result?.type).toBe("reply");
  });

  it("classifies reposts when full_text starts with RT @", () => {
    const result = normalizeArchiveTweet({
      tweet: { ...baseTweet, full_text: "RT @friend: original text" }
    });
    expect(result?.type).toBe("repost");
  });

  it("flags hasMedia when entities.media is populated", () => {
    const result = normalizeArchiveTweet({
      tweet: { ...baseTweet, entities: { media: [{ id: 1 }] } }
    });
    expect(result?.hasMedia).toBe(true);
  });

  it("rejects entries missing an id or created_at", () => {
    expect(normalizeArchiveTweet({ tweet: { id_str: "1" } })).toBeNull();
    expect(
      normalizeArchiveTweet({ tweet: { created_at: baseTweet.created_at } })
    ).toBeNull();
  });
});

describe("parseTwitterArchiveZip", () => {
  it("throws when the zip is empty or malformed", async () => {
    await expect(parseTwitterArchiveZip(Buffer.alloc(0))).rejects.toBeTruthy();
  });

  it("parses a hand-built zip containing data/tweets.js", async () => {
    const payload = [
      { tweet: { id_str: "1", created_at: "Fri Mar 24 12:00:00 +0000 2017", full_text: "a" } },
      { tweet: { id_str: "2", created_at: "Fri Mar 24 12:01:00 +0000 2017", full_text: "RT @x: b" } },
      { tweet: { id_str: "3", created_at: "Fri Mar 24 12:02:00 +0000 2017", full_text: "c", in_reply_to_status_id_str: "55" } }
    ];
    const fileBody = `window.YTD.tweets.part0 = ${JSON.stringify(payload)}`;
    const zipBuffer = buildZipWithOneFile("data/tweets.js", Buffer.from(fileBody, "utf8"));
    const tweets = await parseTwitterArchiveZip(zipBuffer);
    expect(tweets).toHaveLength(3);
    expect(tweets.map((t) => t.type)).toEqual(["post", "repost", "reply"]);
  });
});

// Minimal STORED (no compression) ZIP builder. Enough to feed yauzl a single-file archive.
function buildZipWithOneFile(name: string, data: Buffer): Buffer {
  const nameBuf = Buffer.from(name, "utf8");
  const crc = crc32(data);
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4); // version
  localHeader.writeUInt16LE(0, 6); // flags
  localHeader.writeUInt16LE(0, 8); // compression = stored
  localHeader.writeUInt16LE(0, 10); // mod time
  localHeader.writeUInt16LE(0, 12); // mod date
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(data.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const localEntry = Buffer.concat([localHeader, nameBuf, data]);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4); // version made by
  centralHeader.writeUInt16LE(20, 6); // version needed
  centralHeader.writeUInt16LE(0, 8); // flags
  centralHeader.writeUInt16LE(0, 10); // compression
  centralHeader.writeUInt16LE(0, 12); // mod time
  centralHeader.writeUInt16LE(0, 14); // mod date
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(data.length, 20);
  centralHeader.writeUInt32LE(data.length, 24);
  centralHeader.writeUInt16LE(nameBuf.length, 28);
  centralHeader.writeUInt16LE(0, 30); // extra
  centralHeader.writeUInt16LE(0, 32); // comment
  centralHeader.writeUInt16LE(0, 34); // disk
  centralHeader.writeUInt16LE(0, 36); // internal
  centralHeader.writeUInt32LE(0, 38); // external
  centralHeader.writeUInt32LE(0, 42); // local header offset

  const centralEntry = Buffer.concat([centralHeader, nameBuf]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(1, 8); // entries on disk
  eocd.writeUInt16LE(1, 10); // total entries
  eocd.writeUInt32LE(centralEntry.length, 12);
  eocd.writeUInt32LE(localEntry.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localEntry, centralEntry, eocd]);
}

const CRC32_TABLE: number[] = (() => {
  const table = new Array<number>(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}
