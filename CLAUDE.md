# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Client monorepo for Concrnt v2, a decentralized SNS. One repo produces both the mobile app (`app` + `src-tauri`, Tauri 2) and the web app (`web`). pnpm workspace, Node 22 (Volta), package manager `pnpm`.

## Commands

```sh
pnpm install
pnpm build              # builds all packages; required once before Tauri dev (libs must exist in dist/)
pnpm dev                # vite dev server for the mobile-app frontend (world-app)
pnpm --filter web dev   # vite dev server for the web app
pnpm tauri android dev  # / ios dev — mobile development (run `pnpm build` first)
pnpm tauri android build  # / ios build — production builds (need signing config, see README)
npx eslint <files>      # lint (flat config at root eslint.config.js); husky+lint-staged runs eslint --fix + prettier on commit
```

- During development a `pnpm dev` process is usually already running externally — don't start another one.
- There are no tests anywhere in the repo. CI (`build-check.yaml`) only runs `pnpm build` — that's the check to pass. Typechecking happens via `tsc` inside each package's build.
- After editing `client`, `worldlib`, or `ui`, run `pnpm build` (or the package's own `pnpm --filter <pkg> build`) so dependents pick up the compiled `dist/` output.
- `ui` has Storybook: `pnpm --filter @concrnt/ui storybook` (port 6006).

## Architecture

Layering (each layer only uses the one below):

```
app / web  →  @concrnt/ui  →  @concrnt/worldlib  →  @concrnt/client  →  Concrnt servers
app  →  src-tauri (Rust, via invoke)  →  plugins/ (custom Tauri plugins)
```

- **`client/`** (`@concrnt/client`) — low-level protocol library. `api.ts` (class `Api`: JWT signing, cached fetch layers, `getEntity`/`getDocument`/`commit`/`query`), `core.ts` (`CCURI` — `cckv://`/`ccfs://` addressing), `model.ts` (`Document`, `Entity`, IDs: CCID `con1…` user master key, CKID `cck1…` subkey, CSID `ccs1…` server), `socket.ts` (WebSocket subscriptions with auto-reconnect), `timelineReader.ts`/`chunkline/` (live chunked timelines), `crypto.ts` (secp256k1/Cosmos HD wallet, mnemonic EN+JA), `auth/` (`AuthProvider` interface — master key signs or delegates to subkeys), `cache/` (`KVS` interface: IndexedDB or in-memory). Builds dual CJS+ESM.
- **`worldlib/`** (`@concrnt/worldlib`) — SNS domain layer over client. `client.ts` (`Client` facade — the object apps instantiate; caches via `CachedPromise`), `message.ts`/`timeline.ts`/`user.ts`/`association.ts`/`list.ts`. `schemas.ts` maps schema names → `https://schema.concrnt.world/...` URLs; `schemas/*.ts` are **generated** by `collectSchemas.ts` (Deno + json-schema-to-typescript) — regenerate, never hand-edit (they're eslint-ignored). `signal/login.ts` implements QR cross-device login (another device signs a subkey).
- **`ui/`** (`@concrnt/ui`) — custom component primitives (Button, Dialog, TextField, Text, …) and theming (`contexts/Theme.tsx`, themes in `data/Themes.ts`). No external UI framework.
- **`app/` vs `web/`** — deliberately mirrored trees (`components/`, `views/`, `contexts/`, `hooks/`, …). Keep the code in the two as identical as possible; only platform-specific parts diverge:
  - **Routing**: `web` uses react-router-dom v7 (all routes in `web/src/main.tsx`, `LoginGuard.tsx` gates auth). `app` has no router — native-style navigation via `TabLayout`/`SidebarLayout`/`StackLayout` (`app/src/layouts/Stack.tsx`, push/pop stacks) composed in `app/src/views/Main.tsx`.
  - **Auth**: `web` keeps keys in localStorage with `InMemoryAuthProvider`. `app` never lets keys leave the OS keychain — `app/src/lib/authProvider.ts` (`TauriAuthProvider`) delegates signing to Rust via `invoke` (`get_session`, `sign_subkey`, `initialize_master`, `backup_masterkey`, …), implemented in `src-tauri/src/{commands,auth,session,backup}.rs`.
  - When changing shared behavior in one of `app`/`web`, apply the same change to the other.
- **State management** is React Context only (no Redux/Zustand): each concern is a provider in `*/src/contexts/` (Client, Theme, Composer, Drawer, Modal, …). `ClientProvider` builds the worldlib `Client` and is the data layer; live updates come from `TimelineReader`/`Socket` subscriptions.
- **`plugins/`** — custom Tauri plugins: `tauri-plugin-keychain` (OS keychain key storage), `tauri-plugin-file-saver`, `tauri-plugin-safari-scroll-killer` (iOS WKWebView bounce fix).

The README documents the `cckv://<owner>/concrnt.world/...` KV layout used for settings, profiles, and per-profile timelines/posts/lists.

## Coding rules (from AGENTS.md)

- Do NOT create utility functions to deduplicate code — duplication is accepted. Only consider a utility once the same code is used in 10+ places. Same for shared CSS style objects: make a component instead, or don't share at all.
- Use UI-library components raw. Only wrap a component to add functionality — never create a style-only wrapper; embed the CSS at each usage site instead.
- Never use hand-written `className` strings. Use the `style` prop with plain objects.
- For styles inline `style` cannot express (pseudo-classes, `@keyframes`), use a CSS Modules file paired 1:1 with the component (`Foo.module.css` next to `Foo.tsx`). No shared CSS files. Reference keyframe names via the CSS Modules export (`styles.spin`).
- Never embed `<style>` tags in JSX or inject style elements into `document.head`.
