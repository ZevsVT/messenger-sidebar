const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(__dirname + "/panel.js", "utf8");
const www = "https://www.facebook.com";
const web = "https://web.facebook.com";

async function createPanel(savedOrigin, storageFails = false, ruleFails = false) {
  const elements = new Map();
  const listeners = {};
  const timers = new Map();
  let mediaListener;
  let ruleUpdates = 0;
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, {
      events: {},
      addEventListener(type, handler) { this.events[type] = handler; },
      querySelector: element,
      removeAttribute(name) { delete this[name]; },
      showModal() { this.open = true; },
    });
    return elements.get(selector);
  };
  element("#inbox").contentWindow = { postMessage() {} };
  vm.runInNewContext(source, {
    document: { querySelector: element },
    window: { addEventListener(type, handler) { listeners[type] = handler; } },
    crypto: { randomUUID: () => "panel-id" },
    localStorage: {
      getItem() {
        if (storageFails) throw new Error("Storage unavailable");
        return savedOrigin;
      },
      setItem(key, value) {
        assert.equal(key, "inbox-origin");
        if (storageFails) throw new Error("Storage unavailable");
        savedOrigin = value;
      },
    },
    chrome: {
      runtime: { id: "test-extension", onMessage: { addListener(handler) { mediaListener = handler; } } },
      declarativeNetRequest: {
        async updateSessionRules() {
          ruleUpdates++;
          if (ruleFails && ruleUpdates === 1) throw new Error("Rule unavailable");
        },
      },
    },
    URL,
    console: { warn() {}, error() {} },
    setTimeout(handler) { const id = Symbol(); timers.set(id, handler); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  await new Promise(setImmediate);
  return {
    element,
    timers,
    reload: element("#reload").events.click,
    ruleUpdates: () => ruleUpdates,
    savedOrigin: () => savedOrigin,
    ready(origin) {
      listeners.message({
        source: element("#inbox").contentWindow,
        origin,
        data: { type: "request-messenger-panel-id" },
      });
    },
    preview(url) {
      mediaListener(
        { type: "preview-chat-media", panelId: "panel-id", url },
        { url: web + "/messages/t/123" },
      );
    },
  };
}

test("reuses the working host and rule when reloading", async () => {
  const panel = await createPanel();
  assert.equal(panel.element("#inbox").src, www + "/messages/");
  panel.ready(web);
  assert.equal(panel.savedOrigin(), web);
  assert.equal(panel.timers.size, 0);
  await panel.reload();
  assert.equal(panel.element("#inbox").src, web + "/messages/");
  assert.equal(panel.ruleUpdates(), 1);
  const reopened = await createPanel(panel.savedOrigin());
  assert.equal(reopened.element("#inbox").src, web + "/messages/");
  assert.equal(reopened.ruleUpdates(), 1);
});

test("rejects untrusted saved hosts and readiness messages", async () => {
  const panel = await createPanel("https://web.facebook.com.invalid");
  assert.equal(panel.element("#inbox").src, www + "/messages/");
  panel.ready("https://web.facebook.com.invalid");
  assert.equal(panel.element("#inbox").hidden, true);
  assert.equal(panel.timers.size, 1);
});

test("loads and reloads when preference storage is unavailable", async () => {
  const panel = await createPanel(undefined, true);
  panel.ready(web);
  assert.equal(panel.element("#status").hidden, true);
  await panel.reload();
  assert.equal(panel.element("#inbox").src, web + "/messages/");
});

test("retries failed rule setup before caching it", async () => {
  const panel = await createPanel(undefined, false, true);
  assert.equal(panel.element("#inbox").src, undefined);
  assert.equal(panel.element("#reload").disabled, false);
  await panel.reload();
  await panel.reload();
  assert.equal(panel.ruleUpdates(), 2);
  assert.equal(panel.element("#inbox").src, www + "/messages/");
});

test("unloads the previous media type and clears media on close", async () => {
  const panel = await createPanel();
  panel.preview(web + "/messenger_media?asset_id=123");
  assert(panel.element("#attachment").src);
  panel.preview("https://example.com/photo.jpg");
  assert.equal(panel.element("#attachment").src, undefined);
  assert(panel.element("img").src);
  panel.preview(web + "/messenger_media?asset_id=456");
  assert.equal(panel.element("img").src, undefined);
  panel.element("#image-preview").events.close();
  assert.equal(panel.element("#attachment").src, undefined);
});
