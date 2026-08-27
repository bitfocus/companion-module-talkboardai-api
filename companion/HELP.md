# TalkBoard.ai Console Control

Fire your TalkBoard macros from Companion buttons.

TalkBoard is a console-control app for X32/M32, Yamaha CL/QL, and Allen &
Heath Qu desks. You build macros in it — multi-parameter moves, timed fades,
multi-stage sweeps — and this module lets a Companion button run them, so a
console change can sit on the same page as your video and lighting cues.

**The macro engine is deterministic.** Companion can run macros you already
saved; it cannot send arbitrary commands to the console.

## Setup

1. In TalkBoard, open **Settings → Companion Link** and switch it on.
   (Requires a Pro plan, since macros do.)
2. Copy the token shown there.
3. In Companion, add the **TalkBoard.ai Console Control** connection.
4. Pick your machine from the **TalkBoard** dropdown — it's discovered
   automatically over Bonjour. If your network blocks Bonjour, choose *Manual*
   and type the address and port TalkBoard shows.
5. Paste the token.

Your saved macros appear immediately in the **Run macro** action, and as
ready-made buttons under **Presets → Macros**.

If TalkBoard runs on a different machine from Companion, set *Reachable from*
to **This network** in TalkBoard. Your operating system may ask permission to
accept incoming connections the first time.

## Actions

| Action | What it does |
| --- | --- |
| **Run macro** | Pick a macro from the list. It updates as you save macros in TalkBoard. |
| **Run macro by name** | Matches the name as typed in TalkBoard, case-insensitively. Supports variables, so one button can fire whatever a custom variable currently names. |
| **Stop all fades** | Stops running ramps and any queued stages. |
| **Undo last change** | Same as TalkBoard's Undo. |

## Feedbacks

| Feedback | True when |
| --- | --- |
| **TalkBoard is reachable** | The app is running and the token is accepted. |
| **Console is connected** | TalkBoard is connected to the desk. Worth putting on every macro button — TalkBoard can be running perfectly while the console is unplugged. |
| **Macro is running** | From the moment the macro fires until TalkBoard reports its result, so a multi-stage fade stays lit while it ramps. |

## Variables

`console_status`, `console_type`, `console_model`, `macro_count`, `last_macro`,
`last_result`, `talkboard_version`.

`last_result` carries the same text TalkBoard shows in its own transcript —
e.g. *"Ran 6 commands."* or *"no console in Hall B is connected — nothing was
sent."*

## Troubleshooting

**"Connection failure"** — TalkBoard isn't running, Companion Link is switched
off, or the address is wrong. The connection recovers on its own once TalkBoard
is back; you don't need to restart anything.

**"Token rejected"** — the token was regenerated in TalkBoard. Copy the new one.

**Connection is yellow, not green** — TalkBoard is reachable but the console is
disconnected. Buttons will run but the macro will report that nothing was sent.

**A button does nothing and logs "That macro no longer exists"** — the macro was
deleted or renamed in TalkBoard. Pick it again in the action.

**Protocol mismatch** — TalkBoard and this module are different versions.
Update whichever is older.
