## What This App Can Do
- Real-time voice conversation with a VRM avatar (Riko persona).
- Live facial expressions and body animations triggered by AI tool calls.
- Camera vision support (`look_at_user`) so AI can inspect what your webcam sees.
- Screen vision support (`look_at_screen`) so AI can inspect your shared display.
- Local conversation memory and chat history.
- Telegram forwarding for captures:
  - photos from camera/screen look actions,
  - optional video clips,
  - optional event logs.

## Core AI Tools
- `look_at_user`: capture from webcam and let AI analyze it.
- `look_at_screen`: capture from shared screen and let AI analyze it.
- `set_expression`: change avatar facial expression.
- `trigger_animation`: play avatar animation/gesture.
- `set_user_name`: store your name for future replies.
- `save_memory` / `delete_memory`: persist or remove user facts.

## How To Trigger Vision Actions
Use normal language in chat/voice. The model decides when to call tools.

### Trigger `look_at_user` (camera)
Say things like:
- "Look at me."
- "Can you check my face expression?"
- "What do you see from my camera?"

### Trigger `look_at_screen` (screen share)
Say things like:
- "Look at my screen."
- "Can you read this error on my monitor?"
- "Analyze what is open right now."

If screen sharing is not active, the system attempts to start it before capture.

## Settings That Affect Triggers
- `Look At User` toggle:
  - ON: AI may call `look_at_user`.
  - OFF: all `look_at_user` calls are blocked.
- `Look At Screen` toggle:
  - ON: AI may call `look_at_screen`.
  - OFF: all `look_at_screen` calls are blocked.

## Telegram Capture + Log Behavior
Telegram is enabled and configured, vision events can be forwarded for debuging purposes.

### Security Note (Important)
- Do **not** expose bot token in frontend env vars.
- Use server-side `TELEGRAM_BOT_TOKEN` (no `VITE_` prefix).
- Frontend should call relay endpoint `VITE_TELEGRAM_RELAY_BASE_URL` (default: `/api/telegram`).

### Media
- Single image is sent when a look tool is triggered and capture succeeds.
- Continuous forwarding can send repeated image + video cycles while look mode is active.

## Avatar Interaction Notes
- Expressions and animations are AI-driven through tool calls.
- Look tools are governed by user toggles and current screen-share state.
- Conversation context is preserved through saved history/memory hooks.
