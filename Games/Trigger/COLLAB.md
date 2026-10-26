# Trigger: two Claudes, one game

Two Claude sessions on two different accounts work on Trigger. They can't message each other directly, so they talk
through one pull request on this repository.

- **Lead**: Claude on the other account. It knows what Trigger should be and says what to build next.
- **Builder**: the Claude Code session working on the branch `claude/upbeat-curie-k2j6ms`. It changes the code, tests
  it, pushes and reports back.
- **The user** carries messages when a Claude can't reach GitHub, and has the last word on everything.

## The channel

The pull request for the branch `claude/upbeat-curie-k2j6ms` is the channel:

- **Its comments** are the conversation. A new comment wakes the builder, which replies there after each push.
- **Its description** shows where things stand: open requests, what's done, what's waiting on whom. The builder keeps
  it current.

The pull request is public, so the lead can read it with a web fetch at any time. The lead reads the description and
the latest comments before it writes a new request.

Both Claudes may post as the same GitHub user, so every message starts with who it is from:

```
**[Trigger] from: lead**
**[Trigger] from: builder**
**[Trigger] from: user**
```

If the lead can't post to GitHub, the user copies the lead's message into a comment on the pull request (the GitHub
app works), or pastes it into the builder's session.

## Requests

The lead numbers its requests so both sides can refer to them. One message may hold several.

```
**[Trigger] from: lead**

T-3: Shotgun spread
What: the shotgun fires 5 pellets in a 30° cone.
Done when: one shot at a wall leaves 5 hit marks.
```

The builder answers each by its number:

- **`T-3 done`** with the commit: what changed and how to try it.
- **`T-3 question`**: what's unclear. The builder waits for the answer instead of guessing on anything that changes
  how the game plays.
- **`T-3 can't`**: why not, and what it can do instead.

## The code

The game lives in `Games/Trigger/` on the branch `claude/upbeat-curie-k2j6ms`, and this folder is the one copy both
Claudes work from. If the lead has its own copy (in a claude.ai chat or project, or on the user's laptop), the first job
is to bring it here: the lead or the user pushes it, or the user uploads the files to the builder's session.

The lead reads the current code from GitHub before asking for a change:

- Browse: <https://github.com/iteatsthesalt/Game-Dev-Resources/tree/claude/upbeat-curie-k2j6ms/Games/Trigger>
- One file: `https://raw.githubusercontent.com/iteatsthesalt/Game-Dev-Resources/claude/upbeat-curie-k2j6ms/Games/Trigger/<path>`

This repository is public. Anyone can read what is pushed here or posted on the pull request.
