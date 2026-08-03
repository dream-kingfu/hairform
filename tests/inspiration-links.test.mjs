import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  HAIR_INSPIRATION_LINKS,
  getHairInspirationLinks,
  isAllowedHairInspirationUrl,
} from "../lib/hair/inspiration.ts";

const EXPECTED_FIELDS = ["creatorDisplayName", "id", "platform", "styleId", "summaryZh", "url", "verifiedAt"];

test("covers all 15 hairstyle ids with fail-closed inspiration links", async () => {
  const catalog = await readFile(new URL("../lib/hair/catalog.ts", import.meta.url), "utf8");
  const styleSection = catalog.slice(0, catalog.indexOf("HAIR_COLOR_CATALOG"));
  const styleIds = [...styleSection.matchAll(/\{ id: "([a-z_]+)", zh:/g)].map((match) => match[1]);

  assert.equal(styleIds.length, 15);
  for (const styleId of styleIds) {
    const links = getHairInspirationLinks(styleId);
    assert.ok(links.length >= 1, `${styleId} should have at least one verified reference`);
    assert.ok(links.length <= 2, `${styleId} should expose at most two references`);
  }
  assert.deepEqual(getHairInspirationLinks("not_in_catalog"), []);
});

test("stores only minimal source metadata and canonical official links", () => {
  assert.equal(new Set(HAIR_INSPIRATION_LINKS.map((item) => item.id)).size, HAIR_INSPIRATION_LINKS.length);
  assert.equal(new Set(HAIR_INSPIRATION_LINKS.map((item) => item.url)).size, HAIR_INSPIRATION_LINKS.length);

  for (const item of HAIR_INSPIRATION_LINKS) {
    assert.deepEqual(Object.keys(item).sort(), EXPECTED_FIELDS);
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.match(item.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(item.creatorDisplayName.length > 0 && item.creatorDisplayName.length <= 32);
    assert.ok(item.summaryZh.length >= 12 && item.summaryZh.length <= 42);
    assert.ok(isAllowedHairInspirationUrl(item.url, item.platform), item.url);
    assert.doesNotMatch(JSON.stringify(item), /image|thumbnail|cover|noteText|comment|followers|粉丝|评论/i);
  }
});

test("accepts supported official post shapes and rejects short links or tracking", () => {
  assert.equal(isAllowedHairInspirationUrl("https://www.douyin.com/video/7306788552791100724", "douyin"), true);
  assert.equal(isAllowedHairInspirationUrl("https://jingxuan.douyin.com/m/video/7622162277878024659", "douyin"), true);
  assert.equal(isAllowedHairInspirationUrl("https://www.xiaohongshu.com/explore/64d102c7000000001203abcd", "xiaohongshu"), true);
  assert.equal(isAllowedHairInspirationUrl("https://v.douyin.com/example", "douyin"), false);
  assert.equal(isAllowedHairInspirationUrl("https://xhslink.com/example", "xiaohongshu"), false);
  assert.equal(isAllowedHairInspirationUrl("https://www.douyin.com/video/7306788552791100724?source=share", "douyin"), false);
  assert.equal(isAllowedHairInspirationUrl("https://www.xiaohongshu.com/explore/64d102c7000000001203abcd#comments", "xiaohongshu"), false);
  assert.equal(isAllowedHairInspirationUrl("https://douyin.example/video/7306788552791100724", "douyin"), false);
});

test("renders references only in positive web cards and keeps them out of reports", async () => {
  const [app, report, styles] = await Promise.all([
    readFile(new URL("../app/HairApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/client/report.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /recommendation\.slot !== "less_suitable" && <HairInspirationLinks styleId=\{recommendation\.styleId\}/);
  assert.match(app, /target="_blank"/);
  assert.match(app, /rel="noopener noreferrer nofollow external"/);
  assert.match(app, /referrerPolicy="no-referrer"/);
  assert.match(app, /原帖内容归作者及平台所有，非合作或代言，仅作发型灵感参考/);
  assert.match(styles, /hair-inspiration/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.hair-inspiration-list > a \{ grid-template-columns: 1fr; \}/);
  assert.doesNotMatch(report, /inspiration|抖音|小红书|真实发型灵感/i);
});
