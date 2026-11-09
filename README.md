# Messenger Sidebar

Click the toolbar icon to open Facebook Messages in Chrome's native side panel. The panel stays beside your current tab as you browse.

## Install

1. In Chrome 145 or later, open `chrome://extensions`.
2. Turn on **Developer mode**, select **Load unpacked**, and choose the folder containing `manifest.json`.
3. Pin **Messenger Sidebar** from the browser's Extensions menu and click its icon.

Already installed? Click **Reload** on the extension's card at `chrome://extensions` and allow access to `www.facebook.com` if prompted. Then click the toolbar icon.

## Using Messenger

The panel uses your existing Facebook session. If you need to sign in, click **Sign in on current tab**, sign in on Facebook, and then click **Reload** in the sidebar.

Click **Collapse** to hide the chat while it keeps running, then click **Expand** to return to the same conversation. Chrome keeps the side panel at its current width. You can drag the divider to make it narrower. Using Chrome's own close button unloads the chat.

Messenger attachments and direct image links open inside the sidebar. Close the preview to return to the chat. Other web links open in a tab in the same browser window. Ctrl-click or middle-click opens a web link in the background.

Facebook rejects requests marked as iframes. The extension changes the destination header for Messages frames under its own origin, removes their frame-options header, and adds a policy limiting the frame to the extension. Existing Content Security Policy directives stay in place. Meta can change its requirements for the embedded inbox.
