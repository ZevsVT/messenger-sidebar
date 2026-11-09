chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "open-chat-link" || !sender.url?.startsWith("https://www.facebook.com/messages/")) return;

  const url = typeof message.url === "string" ? URL.parse(message.url) : null;
  if (url?.protocol !== "https:" && url?.protocol !== "http:") return;

  chrome.tabs.create({
    url: url.href,
    windowId: sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT,
    active: message.background !== true,
  }).catch(console.error);
});
