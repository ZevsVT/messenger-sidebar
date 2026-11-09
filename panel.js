const facebookOrigin = "https://www.facebook.com";
const inboxUrl = `${facebookOrigin}/messages/`;
const frame = document.querySelector("#inbox");
const status = document.querySelector("#status");
const preview = document.querySelector("#image-preview");
const image = preview.querySelector("img");
const attachment = document.querySelector("#attachment");
const imageError = document.querySelector("#image-error");
const panelId = crypto.randomUUID();

window.addEventListener("message", (event) => {
  if (event.source === frame.contentWindow && event.origin === facebookOrigin && event.data?.type === "request-messenger-panel-id") {
    event.source.postMessage({ type: "messenger-panel-id", panelId }, facebookOrigin);
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "preview-chat-media" || message.panelId !== panelId) return;
  if (!sender.url?.startsWith(inboxUrl)) return;

  const url = typeof message.url === "string" ? URL.parse(message.url) : null;
  if (url?.protocol !== "https:" && url?.protocol !== "http:") return;

  const isAttachment = url.origin === facebookOrigin && /^\/messenger_media\/?$/.test(url.pathname);
  imageError.hidden = true;
  image.hidden = isAttachment;
  attachment.hidden = !isAttachment;
  if (isAttachment) attachment.src = url.href;
  else image.src = url.href;
  if (!preview.open) preview.showModal();
});

image.addEventListener("error", () => { imageError.hidden = false; });
preview.addEventListener("close", () => {
  image.removeAttribute("src");
  attachment.removeAttribute("src");
});

async function openInbox() {
  const extensionId = chrome.runtime.id;
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [1],
    addRules: [{
      id: 1,
      condition: {
        regexFilter: "^https://www\\.facebook\\.com/(messages/|messenger_media/?(\\?|$))",
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

  frame.src = inboxUrl;
  frame.hidden = false;
  status.hidden = true;
}

function showError(message, error) {
  console.error(error);
  status.textContent = message;
  status.hidden = false;
}

function reloadInbox() {
  openInbox().catch((error) => showError(
    "Couldn't load the sidebar. Check that the extension can access facebook.com, then reload.",
    error,
  ));
}

document.querySelector("#reload").addEventListener("click", reloadInbox);
document.querySelector("#collapse").addEventListener("click", ({ currentTarget: button }) => {
  // Closing Chrome's panel unloads the inbox. Hide the live frame in place.
  const expanded = button.getAttribute("aria-expanded") === "false";
  button.setAttribute("aria-expanded", String(expanded));
  button.textContent = expanded ? "Collapse" : "Expand";
});
document.querySelector("#sign-in").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.update(tab.id, { url: inboxUrl });
  } catch (error) {
    showError("Couldn't open sign-in in the current tab.", error);
  }
});

reloadInbox();
