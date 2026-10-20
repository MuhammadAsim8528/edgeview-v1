# Browser authorization diagnosis — 2026-10-20

This is a browser-authorization finding, not an EdgeView networking defect.
No app port, networking policy or security protection was changed for access.

## Supported steps actually attempted

- Read Computer Use and OpenAI Docs skill guidance; fetched official browser and
  extension permission documentation and the browser troubleshooting reference.
- Supported browser inventory identified Chrome connection 10, profile **Asim
  Hassan**, with EdgeView tab 2115918294 at http://127.0.0.1:3901/.
  Two ChatGPT tabs were listed in that profile. No contents of unrelated chats
  were read. Edge connection 9 had no EdgeView tab; it was not used as a bypass.
- The in-app browser connection 2 had no tabs. A supported
  createBrowserTab request for the exact production URL with visible=true was
  made explicitly to request access/show the app.
- Returned result:

> Browser Use rejected this action due to browser security policy. Reason: A saved user permission setting blocks this action. Browser use could not acquire authority to trigger network egress. The origin approval gate did not grant access for http://127.0.0.1:3901. A saved permission or managed policy denies access.

The result additionally forbids alternate browser surfaces, raw CDP, indirect
execution and policy circumvention. None was attempted. There is no evidence
that an interactive approval prompt was created. The narrower generic message
"Browser control requires your permission" is not the actual returned result of
this attempt. No native app windows were exposed, so a prompt in another desktop
window could not be observed or ruled out. No screenshot of a permission dialog
is available, and no visible button was falsely claimed.

## Documented user controls, not visually verified settings

- Desktop app: Settings → Computer Use → **Manage** beside Google Chrome.
  Review allowed/blocked websites; remove the blocked localhost entry to permit
  a new request. Browser enable toggles are not the site permission control.
- In-app browser: Settings → Browser → **Agent permissions**; review the custom
  permission for http://127.0.0.1:3901. Removing a custom permission restores the
  default. Managed policy can still restrict these controls.
- No broad "allow every website" or developer/debugging access is needed.

Official sources:
https://learn.chatgpt.com/docs/chrome-extension
https://learn.chatgpt.com/docs/browser

After an actual supported permission change, reacquire the same origin, confirm
the profile/tab and inspect rendered production behavior before claiming visual
QA. Listing a tab or receiving health JSON is not visual evidence. If the saved
denial persists, report it as an app/browser authorization integration issue;
do not change EdgeView or switch surfaces to evade the restriction.
