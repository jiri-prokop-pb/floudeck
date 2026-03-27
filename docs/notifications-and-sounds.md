# Notifications & Sounds in Tauri v2

## Native notifications (macOS)

Tauri v2 has a built-in `notification` plugin using `UNUserNotificationCenter`.

```bash
cargo tauri add notification
```

```ts
import { requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

await requestPermission();
sendNotification({ title: "Block finished", body: "Daily standup summary is ready" });
```

- Shows in macOS Notification Center
- User controls appearance (banners vs alerts) in System Settings
- Supports `sound` field: `"default"` or named macOS sounds like `"Ping"`, `"Glass"`, `"Hero"`

## Playing sounds

### Option A: Notification sound

Set `sound` on the notification payload — plays when the notification fires.

### Option B: Web Audio (frontend)

For UI event sounds without a notification:

```ts
const audio = new Audio("/assets/done.mp3");
audio.play();
```

Simplest approach. Works as long as the webview is active.

### Option C: Rust-side audio (rodio)

Use the `rodio` crate in a Tauri command for sounds even when the webview is hidden/inactive. Only needed if background sound playback is required.

## Recommendation for Floudeck

- **Background/minimized**: Native notification with `sound` — covers block completion, errors, reminders
- **Foreground**: `new Audio()` in the webview for immediate UI feedback
- Both should be configurable per block (see TODO: Notifications item)
