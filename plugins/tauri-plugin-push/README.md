# tauri-plugin-push

Native push notification registration for the concrnt mobile app (iOS/Android
only — no desktop support, matching this codebase's other mobile-only local
plugins).

## What it does

concrnt v2 servers only speak WebPush (RFC 8030, aes128gcm/VAPID). Native apps
can't receive WebPush directly, so a separate relay
([`webpush-relay`](../../webpush-relay)) re-emulates a WebPush endpoint and
forwards the still-encrypted payload to APNs/FCM. This plugin:

1. Generates an on-device P-256 keypair + 16-byte auth secret (the WebPush
   subscription's `keys.p256dh`/`keys.auth`) and never exposes the private key
   to JS.
2. Registers for native push (APNs device token via `UIApplication
   .registerForRemoteNotifications`, or FCM registration token via
   `FirebaseMessaging`) and returns the token so the app JS can build a
   `PushSubscription`-shaped object pointing at the relay
   (`https://<relay>/apns/<environment>/<token>` or
   `https://<relay>/fcm/<token>`) and register it with the concrnt server via
   `Api.subscribeNotification`.
3. On receipt (iOS Notification Service Extension / Android
   `FirebaseMessagingService`), decrypts the WebPush body (RFC 8291,
   verified against the official RFC 8291 §5 test vector — see
   `PushCryptoTest.kt`), parses the `concrnt.Event` payload, builds
   display text per association schema, and shows the notification.
4. Surfaces notification taps and cold-start launches back to JS
   (`notificationTapped` event / `get_launch_notification` command) with a
   deep-link target the app navigates to.

## Setup required before building for a real device

- **Android**: a Firebase project registered for application ID
  `world.concrnt.app`, with `google-services.json` placed at
  `src-tauri/gen/android/app/google-services.json` (gitignored — not
  committed; ask a maintainer or create your own Firebase project for local
  development). The Gradle wiring (`com.google.gms.google-services` plugin) is
  already in place in `src-tauri/gen/android/{build.gradle.kts,app/build.gradle.kts}`.
- **iOS**: an APNs `.p8` auth key configured on the relay (not this plugin);
  the app side just needs the Push Notifications capability + an App Group
  enabled on the app's App ID (see the NSE target notes in
  `../../world-app/src-tauri/gen/apple/project.yml`).

## Do not run `tauri android init` / `tauri ios init`

Both `gen/android` and `gen/apple` are committed, hand-edited generated
directories. Re-running plugin init would drop the google-services wiring
(Android) and the NotifyService extension target (iOS). If regeneration is
ever unavoidable, re-apply the diffs in this plugin's git history.
