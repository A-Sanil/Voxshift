# Contributing to VoxShift

Thanks for wanting to help. VoxShift is a community project and we welcome contributions of all kinds — bug fixes, features, docs, and testing.

## Getting started

1. Fork the repo and clone it locally
2. Follow the **Quick start** in the README to get the dev environment running
3. Create a branch: `git checkout -b feat/your-feature` or `fix/your-bug`
4. Make your changes, test them, commit, and open a PR

## What to work on

Check the [issues](https://github.com/A-Sanil/Voxshift/issues) for open tasks. Issues tagged **good first issue** are ideal for first-time contributors.

The highest-impact work right now:
- **RVC inference integration** — wire the actual PyTorch/FAISS pipeline into `python/inference.py` and `python/audio.py`
- **Marketplace API** — connect the marketplace tab to voice-models.com (see section 9 of the design doc)
- **Preview audio** — add audio sample playback on marketplace cards
- **Installer / first-run wizard** — stub installer + virtual cable setup prompt

## Code style

- **TypeScript/React:** no any, functional components, Zustand for state. Keep components focused.
- **Python:** type hints everywhere, async by default, no global mutable state outside of the engine singletons.
- No AI-generated comments. If the code is unclear, rename the variable.

## Commit messages

Plain English, imperative mood:
```
Add pitch extraction algorithm picker to training wizard
Fix waveform bars not resetting when audio stops
```

Not `fix stuff` or `WIP`. Not a laundry list.

## Pull requests

- Keep PRs focused — one thing at a time
- Include a short description of what changed and why
- If you changed any UI, include a screenshot

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include your OS, GPU, and what you were doing when it broke.

## Code of conduct

Be direct, be respectful, and don't waste people's time. That's it.
