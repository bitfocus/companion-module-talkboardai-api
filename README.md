# companion-module-talkboardai-api

A [Bitfocus Companion](https://bitfocus.io/companion) module for
[TalkBoard](https://talkboard.ai) — run saved mixing-console macros from a
Companion button.

TalkBoard controls Behringer X32 / Midas M32, Yamaha QL/CL and Allen & Heath
Qu desks. You build macros in it — multi-parameter moves, timed
fades, multi-stage sweeps — and this module puts them on a button, so a console
change can sit on the same page as your video and lighting cues.

The module can only run macros the operator already saved. There is no
passthrough for raw console commands.

## Requirements

- Companion 5.0 or later
- TalkBoard with **TalkBoard Link** enabled (Settings → General), on a Pro or
  Unlimited plan

## Setup

See [`companion/HELP.md`](companion/HELP.md), which is also shown in Companion's
help panel.

TalkBoard advertises itself over Bonjour, so in most cases you pick it from a
dropdown and paste the token — there is no address to type.

## Actions, feedbacks and variables

| Actions | Feedbacks | Variables |
| --- | --- | --- |
| Run macro | TalkBoard is reachable | `console_status` |
| Run macro by name | Console is connected | `console_type` |
| Stop all fades | Macro is running | `console_model` |
| Undo last change | | `macro_count` |
| | | `last_macro` |
| | | `last_result` |
| | | `talkboard_version` |

Presets ship one ready-made button per saved macro, plus Stop Fades and Undo.

## Development

Requires Node 22 and yarn 4 (via corepack).

```bash
corepack enable
yarn install
yarn build      # tsc -> dist/
yarn test       # build, then exercise the API client against a stub TalkBoard
yarn package    # produce the .tgz Companion can import
```

To load it in Companion without packaging, put this folder inside your Companion
*Developer modules path* and enable developer modules.

## Licence

MIT — see [LICENSE](LICENSE).
