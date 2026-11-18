const facebookOrigins = ["https://www.facebook.com", "https://web.facebook.com"];
let inboxUrl = `${facebookOrigins[0]}/messages/`;
try {
  const savedOrigin = localStorage.getItem("inbox-origin");
  if (facebookOrigins.includes(savedOrigin)) inboxUrl = `${savedOrigin}/messages/`;
} catch (error) {
  console.warn("Couldn't read the preferred Facebook host.", error);
}
const frame = document.querySelector("#inbox");
const status = document.querySelector("#status");
const reload = document.querySelector("#reload");
const preview = document.querySelector("#image-preview");
const image = preview.querySelector("img");
const attachment = document.querySelector("#attachment");
const imageError = document.querySelector("#image-error");
const panelId = crypto.randomUUID();
let inboxTimeout;
let inboxRulesReady = false;

window.addEventListener("message", (event) => {
  if (event.source === frame.contentWindow && facebookOrigins.includes(event.origin) && event.data?.type === "request-messenger-panel-id") {
    event.source.postMessage({ type: "messenger-panel-id", panelId }, event.origin);
    clearTimeout(inboxTimeout);
    frame.hidden = false;
    status.hidden = true;
    inboxUrl = `${event.origin}/messages/`;
    try {
      localStorage.setItem("inbox-origin", event.origin);
    } catch (error) {
      console.warn("Couldn't remember the preferred Facebook host.", error);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "preview-chat-media" || message.panelId !== panelId) return;
  if (!facebookOrigins.some((origin) => sender.url?.startsWith(`${origin}/messages/`))) return;

  const url = typeof message.url === "string" ? URL.parse(message.url) : null;
  if (url?.protocol !== "https:" && url?.protocol !== "http:") return;

  const isAttachment = facebookOrigins.includes(url.origin) && /^\/messenger_media\/?$/.test(url.pathname);
  imageError.hidden = true;
  image.hidden = isAttachment;
  attachment.hidden = !isAttachment;
  if (isAttachment) {
    image.removeAttribute("src");
    attachment.src = url.href;
  } else {
    attachment.removeAttribute("src");
    image.src = url.href;
  }
  if (!preview.open) preview.showModal();
});

image.addEventListener("error", () => { imageError.hidden = false; });
preview.addEventListener("close", () => {
  image.removeAttribute("src");
  attachment.removeAttribute("src");
});

async function openInbox() {
  if (!inboxRulesReady) await configureInboxRules();

  frame.src = inboxUrl;
  // Chrome's iframe load event also fires for blocked pages. Wait for the inbox content script.
  inboxTimeout = setTimeout(() => {
    status.textContent = "Messenger didn’t open here. Use Open in tab to access Messages or sign in, then try Reload.";
  }, 15000);
}

async function configureInboxRules() {
  const extensionId = chrome.runtime.id;
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [1],
    addRules: [{
      id: 1,
      condition: {
        regexFilter: "^https://(www|web)\\.facebook\\.com/(messages/|messenger_media/?(\\?|$))",
        topDomains: [extensionId],
        resourceTypes: ["sub_frame"],
        requestMethods: ["get"],
      },
      action: {
        type: "modifyHeaders",
        // Facebook returns HTTP 400 when it receives an iframe destination.
        requestHeaders: [{ header: "sec-fetch-dest", operation: "set", value: "document" }],
        responseHeaders: [
          { header: "x-frame-options", operation: "remove" },
          {
            header: "content-security-policy",
            operation: "append",
            value: `frame-ancestors chrome-extension://${extensionId}`,
          },
        ],
      },
    }],
  });

  inboxRulesReady = true;
}

function showError(message, error) {
  console.error(error);
  status.textContent = message;
  status.hidden = false;
}

async function reloadInbox() {
  reload.disabled = true;
  clearTimeout(inboxTimeout);
  frame.hidden = true;
  status.textContent = "Opening Messenger…";
  status.hidden = false;

  try {
    await openInbox();
  } catch (error) {
    showError("Couldn't load the sidebar. Check Facebook site access or use Open in tab.", error);
  } finally {
    reload.disabled = false;
  }
}

reload.addEventListener("click", reloadInbox);
document.querySelector("#collapse").addEventListener("click", ({ currentTarget: button }) => {
  // Closing Chrome's panel unloads the inbox. Hide the live frame in place.
  const expanded = button.getAttribute("aria-expanded") === "false";
  button.setAttribute("aria-expanded", String(expanded));
  button.textContent = expanded ? "Collapse" : "Expand";
});
document.querySelector("#open-in-tab").addEventListener("click", async () => {
  try {
    await chrome.tabs.create({ url: inboxUrl });
  } catch (error) {
    showError("Couldn't open Messenger in a new tab.", error);
  }
});

reloadInbox();
