# PocketFlow — local planner

A small Expo / React Native personal organizer with expenses, daily and regular todos, notes, reminders, charts, and JSON backup/restore.

## Run it

```bash
npm i
npx expo start
```

Open the QR code with Expo Go, or press `a` / `i` for an installed emulator. Use a current Expo Go build that supports **Expo SDK 58**.

## What's included

- **Expenses:** monthly totals, deposits, editable history, long-press delete.
- **Tasks:** filterable regular todos, colored two-column cards, daily checklist with a date-based reset.
- **Plans:** six note themes, editable checklist blocks, local image attachments, fullscreen image preview, hidden-until-revealed secret text.
- **Stats:** local reminders, expense and task charts, 7/14-day activity graph, JSON backup and restore.
- **Storage:** all records are kept locally with AsyncStorage; there is no backend or account.

## Data keys

`transactions`, `tasks`, `dailyTasks`, `notes`, `reminders`, and `activityLog` (reserved for future activity events).

## Notes

- Reminder notifications are local device notifications. The operating system may still restrict delivery according to its notification settings and battery policies.
- Image-picker results are saved as local device URIs in the note record. If you move to a new device, keep the original images available if you need those attachments; a JSON backup does not bundle the image files themselves.
- Backup creates a JSON file and opens the system share sheet. Restore selects a previously exported JSON file.
- `nativewind` v4 is configured through `global.css`, `babel.config.js`, and `metro.config.js`.

## UI refinements

- Safe-area-aware top spacing keeps page content below the phone status bar and bottom navigation clear of the gesture area.
- Screen entrances use a light fade/slide transition; save feedback uses a spring-animated toast.
- Ionicons are used consistently across tabs, actions, cards, and chart sections.
- Expense and deposit forms use a selectable category picker (including an optional uncategorized choice).
- Statistics includes a donut chart with category totals and percentage shares, alongside the monthly and task charts.
