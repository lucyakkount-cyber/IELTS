# Quantum VRM - English Documentation

## Overview
Quantum VRM is a real-time 3D avatar assistant built with Vue + Three.js + VRM + Gemini Live Audio.

It supports:

- live voice conversation
- avatar animations and expressions
- optional camera/screen vision tools
- safety reporting flow
- multilingual UI (English, Uzbek, Russian)

## New Features (Current State)

- Full UI i18n with language switch in Settings.
- Localized built-in personas in UI.
- AI language behavior is a soft preference, not a strict rule.
- Built-in persona prompts are sent to AI in English for stable behavior.
- Improved animation loading:
  - catalog-based loading
  - batch loading with progress
  - background loading
  - local-first with remote fallback
  - lazy on-demand loading by name

## Requirements

- Node.js `^20.19.0 || >=22.12.0`
- npm
- Gemini API key

## Setup and Run

### 1) Install

```bash
npm install
```

### 2) Configure `.env`

Minimum required:

```env
VITE_API_KEY=your_gemini_key
```

Optional Telegram relay settings are available, but keep secrets private and never commit tokens.

### 3) Start development

```bash
npm run dev
```

### 4) Build for production

```bash
npm run build
```

### 5) Preview production build

```bash
npm run preview
```

## Testing Guide

### Automated checks

Run lint:

```bash
npm run lint
```

Run production build:

```bash
npm run build
```

If the repository has pre-existing lint issues in unrelated files, run focused lint on changed files:

```bash
npx eslint src/App.vue src/components/*.vue managers/index.js managers/animationManager.js src/i18n/ui.js
```

### Manual smoke test checklist

1. App boots and loader reaches 100%.
2. Default avatar appears or custom VRM loads correctly.
3. Connect/disconnect voice session works.
4. Change language in Settings and confirm UI text updates.
5. Change persona and reconnect; behavior updates.
6. Trigger animations and verify fallback to idle.
7. Toggle camera/screen options and confirm behavior.
8. Open chat and verify transcript updates and timestamps.

## Animation Handling

### Where animations are defined

- File: `managers/animationManager.js`
- Catalog method: `getAnimationCatalog()`
- Assets path: `public/animations/*.vrma`

### Built-in animation names

- `HappyIdle`
- `wave`
- `Macarena_dance`
- `dance`
- `clap`
- `thumbs_up`
- `shrug`
- `pointing`
- `laugh`
- `salute`
- `angry`
- `backflip`
- `acknowledging`
- `blow_kiss`
- `bored`
- `looking_around`
- `cutthroat`

### How to add a new animation

1. Put the `.vrma` file into `public/animations/`.
2. Add a catalog entry in `getAnimationCatalog()`:
   - `name`
   - `path`
   - `loop`
3. Use `triggerNamedAnimation('your_name')` to test.
4. Confirm:
   - clip loads
   - plays correctly
   - returns to idle if non-loop action finishes

### Expression handling

- Use `set_expression` tool with expression names from the expression map.
- Duration is supported (commonly 3s to 10s).
- Neutral reset happens after duration timeout.

## Persona Handling

- Built-in personas are localized in UI and treated as system personas.
- Built-in personas are not editable/deletable.
- User-created personas are editable/deletable.
- Built-in prompts are sent in English.
- Custom persona prompts are sent as authored by user.

## Language Behavior

- UI can be switched between `en`, `uz`, `ru`.
- Language selector is in Settings.
- AI receives language preference as an English instruction.
- Instruction is soft: AI should prefer selected language, but can adapt to user language changes.

## Key Files

- `src/App.vue` - app state, language/persona/session flow
- `src/i18n/ui.js` - UI translations and language hint builders
- `managers/index.js` - runtime orchestration and system prompt assembly
- `managers/animationManager.js` - animation/expression logic
- `src/components/SettingsPanel.vue` - settings UI (language, scale, vision)
- `src/components/PersonaManagerDialog.vue` - persona UI management


