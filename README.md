# Twitch Chat Widget Pro

<img width="658" height="517" alt="image" src="https://github.com/user-attachments/assets/e9bb3728-30a7-4499-84a8-90fb09d40e1f" />

Custom StreamElements widget for Twitch chat overlays.

## Files
- `index.html`: widget markup
- `styles.css`: widget styling
- `scripts.js`: widget logic
- `fields.json`: StreamElements editor fields

## What It Supports
- Twitch chat messages
- Badges, emotes, avatars
- Reply context
- Grouped consecutive messages
- Role styling and pills
- First chatter / returning chatter state
- Highlighted messages and announcements
- Moderation delete placeholders and bulk clear animation
- Theme, density, animation, and color controls
- Optional persisted chatter state with `SE_API.store`
- OBS-safe idle state when no messages are visible

## StreamElements Setup
1. Open StreamElements overlay editor.
2. Add a `Custom Widget`.
3. Replace the widget files with:
   - `index.html`
   - `styles.css`
   - `scripts.js`
   - `fields.json`
4. Save the overlay.
5. Configure the main fields first:
   - `themePreset`
   - `densityPreset`
   - `animationPreset`
   - `maxMessages`
   - `messageLifetime`
   - `showIdleState`

## OBS Setup
1. Copy the overlay URL from StreamElements. Use the live overlay URL, not the editor URL.
2. In OBS, add a `Browser Source`.
3. Paste the overlay URL.
4. Start with:
   - Width: `800`
   - Height: `600`
5. Recommended Browser Source options:
   - `Refresh browser when scene becomes active`: on
   - `Shutdown source when not visible`: off

## Expected Behavior
- In StreamElements editor:
  - preview messages should appear
  - idle state should stay hidden
- In OBS/live overlay:
  - no preview messages should appear
  - idle state should show until real chat arrives
  - real chat should replace the idle state

## Live Test Checklist
Send these in Twitch chat and confirm the result:
- Normal message:
  - username and text render correctly
- Message with emotes:
  - emotes render inline
- Reply message:
  - reply context appears above the text
- Repeated messages from same user:
  - messages group within the configured time window
- Command-style message like `!hello`:
  - hidden if command filtering is enabled
- Message from a bot-like username:
  - hidden if bot filtering is enabled
- Moderation delete:
  - deleted message becomes a temporary placeholder if enabled
- Bulk user delete:
  - user messages clear with moderation animation if enabled

## Important Notes
- Live Twitch chat messages arrive from StreamElements under `obj.detail.event.data`.
- The widget starts empty in OBS by design unless the idle state is enabled.
- Returning chatter state can persist across reloads if `persistSessionState` is enabled.
- `compactMode` is still supported for compatibility, but `densityPreset` is the preferred control.

## Troubleshooting
- Username shows `Unknown`:
  - verify the live overlay is using the current `scripts.js`
- Widget is blank in OBS:
  - confirm you used the live overlay URL
  - confirm `showIdleState` is enabled if you expect a placeholder before chat
  - send a real non-command chat message from Twitch
- Preview appears in editor but not in OBS:
  - expected behavior
- Returning chatter state seems reset:
  - confirm `persistSessionState` is enabled
  - confirm the `storeNamespace` matches the version you expect to use

## Recommended Defaults
- `themePreset`: `glass`
- `densityPreset`: `comfortable`
- `animationPreset`: `smooth`
- `maxMessages`: `6`
- `messageLifetime`: `20`
- `groupWindowSeconds`: `14`
- `sessionReturnThreshold`: `3`
- `showIdleState`: `yes`
