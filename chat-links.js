const extensionOrigin = `chrome-extension://${chrome.runtime.id}`;
if (location.ancestorOrigins[0] === extensionOrigin) {
  let panelId;
  window.addEventListener("message", (event) => {
    if (event.origin === extensionOrigin && event.source === window.parent && event.data?.type === "messenger-panel-id") {
      panelId = event.data.panelId;
    }
  });
  window.parent.postMessage({ type: "request-messenger-panel-id" }, extensionOrigin);

  const routeChatLink = (event, previewPhase) => {
    if (!event.isTrusted || event.defaultPrevented) return;
    if (event.button !== (event.type === "auxclick" ? 1 : 0)) return;

    const link = event.composedPath().find((node) => node instanceof HTMLAnchorElement && node.hasAttribute("href"));
    if (!link) return;

    const url = URL.parse(link.href);
    if (url?.protocol !== "https:" && url?.protocol !== "http:") return;

    const isMetaRedirect = url.pathname === "/l.php" &&
      ["www.facebook.com", "l.facebook.com", "lm.facebook.com", "l.messenger.com"].includes(url.hostname);
    const imageUrl = isMetaRedirect
      ? URL.parse(url.searchParams.get("u") ?? "")
      : url;
    const isAttachment = imageUrl?.origin === location.origin && /^\/messenger_media\/?$/.test(imageUrl.pathname);
    const thumbnail = link.querySelector("img");
    const thumbnailUrl = URL.parse(thumbnail?.currentSrc || thumbnail?.src || "");
    const isPicture = imageUrl && ["http:", "https:"].includes(imageUrl.protocol) && (
      /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i.test(imageUrl.pathname) ||
      (thumbnailUrl?.origin === imageUrl.origin && thumbnailUrl.pathname === imageUrl.pathname)
    );
    // Let Messenger handle photos in its viewer before previewing a plain image link.
    if ((!isAttachment && Boolean(isPicture)) !== previewPhase) return;

    const isInboxLink = url.origin === location.origin && url.pathname.startsWith("/messages/");
    const background = event.button === 1 || event.ctrlKey || event.metaKey;
    const opensPreview = isAttachment || isPicture;
    if (!opensPreview && isInboxLink && link.target.toLowerCase() !== "_blank" && !background) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const message = opensPreview
      ? { type: "preview-chat-media", panelId, url: imageUrl.href }
      : { type: "open-chat-link", url: url.href, background };
    chrome.runtime.sendMessage(message).catch(console.error);
  };

  for (const type of ["click", "auxclick"]) {
    window.addEventListener(type, (event) => routeChatLink(event, false), true);
    window.addEventListener(type, (event) => routeChatLink(event, true));
  }
}
