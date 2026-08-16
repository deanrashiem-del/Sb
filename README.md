# 🛡️ ServerBlock

**Professional, production-ready Discord moderation bot** with a powerful persistent ServerBlock (SB) system.

Everything is configured **inside Discord**.  
The only credentials you need are a Bot Token and Client ID.

---

## Features

- **ServerBlock system** — block users with one or more roles
- **Persistent SQLite storage** — survives restarts, no external database
- **Multi-server support** — completely isolated data per guild
- **Prefix + Slash commands**
- **Interactive setup & config panels** (buttons, role/channel selects, modals)
- **Separate permission sets**: SB Staff / Accept Appeals / Deny Appeals
- **Customizable messages** (except the fixed success confirmation)
- **Case IDs** (`SB-000001`, …) with full timelines
- **Appeals** (accept / deny) with DMs and logging
- **Rejoin protection** — roles restored automatically
- **Staff notes**, reason editing, statistics, history, search
- **Configuration audit log**, export, and safe reset
- **Mobile-friendly flat project** — easy to edit on phone

---

## Requirements

- **Node.js 18+**
- A Discord Bot application

### Discord Developer Portal — Required Intents

In the [Discord Developer Portal](https://discord.com/developers/applications) → your application → **Bot**:

Enable these **Privileged Gateway Intents**:

1. **Server Members Intent**
2. **Message Content Intent**

Also enable the normal intents (they are requested by the bot):

- Guilds
- Guild Members
- Guild Messages
- Message Content

---

## Installation (5 minutes)

### 1. Install Node.js
Download from [nodejs.org](https://nodejs.org/) (LTS recommended).

### 2. Upload / clone the project
Keep the **flat** structure. Do not put files inside extra folders.

### 3. Install dependencies
```bash
npm install
```

### 4. Create `.env`
Copy `.env.example` to `.env` and fill in:

```env
TOKEN=YOUR_BOT_TOKEN
CLIENT_ID=YOUR_CLIENT_ID
```

**That is all.** No MongoDB, no Guild IDs, no role IDs, no webhooks.

### 5. Start the bot
```bash
npm start
```

### 6. Invite the bot
Use this invite link (replace `CLIENT_ID`):

```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=268443648&scope=bot%20applications.commands
```

Recommended permissions:
- Manage Roles
- Send Messages
- Embed Links
- View Channels
- Read Message History

**Important:** Place the bot’s highest role **above** any ServerBlock roles you configure.

### 7. Run setup
In any server the bot is in:

```
/setup
```

or

```
/config
```

Use **⚡ Quick Setup** for a one-click start, then fine-tune with the buttons.

---

## Quick Start After Setup

| Action | Command |
|--------|---------|
| ServerBlock a user | `?sb @user reason` or `/serverblock` |
| Remove SB | `?sbremove @user` |
| Accept appeal | `?sbackcept @user` or `/sbaccept` |
| Deny appeal | `?sbdeny @user [reason]` |
| View info | `?sbinfo @user` |
| History | `?sbhistory @user` / `?sbhistory all` |
| Case details | `?sbcase SB-000001` |
| Stats | `?sbstats` |
| Help | `?help` / `/help` |

Default prefix is `?`. Change it in `/config` → General.

---

## Fixed Success Message

When a ServerBlock succeeds, the bot **always** replies with exactly:

```
✔️ <@user> was successfully serverblocked.
```

or (if the user is not in the server):

```
✔️ 123456789012345678 was successfully serverblocked.
```

This message cannot be customized (by design).

---

## Permission System

Three independent role lists (configured via Role Select Menus):

| Category | Can use |
|----------|---------|
| 🛡️ SB Staff | `?sb`, `?sbremove`, `/serverblock`, … |
| ✅ Accept Staff | `?sbackcept` / `/sbaccept` |
| ❌ Deny Staff | `?sbdeny` / `/sbdeny` |

Server owners always have full access.  
Optional **Administrator bypass** can be toggled in General settings.

---

## Database

The bot automatically creates `serverblock.sqlite` in the same folder.

No manual setup required. All data (blocks, history, config, notes, audit log) is stored there and survives restarts.

---

## Project Structure (Flat)

```
ServerBlock/
├── index.js          # Entry point
├── config.js         # Env + defaults
├── database.js       # SQLite layer
├── commands.js       # Prefix + slash commands
├── events.js         # Event handlers + interactions
├── serverblock.js    # Core SB logic
├── permissions.js    # Permission checks
├── messages.js       # Message rendering
├── history.js        # History & timelines
├── setup.js          # Setup & config UI
├── logger.js         # Logging
├── utils.js          # Helpers
├── package.json
├── .env.example
├── .env              # (you create this)
└── README.md
```

No `src/`, no `commands/`, no TypeScript, no build step.

---

## Mobile-Friendly

Designed to be edited and run from mobile coding apps (e.g. Termux, Acode, etc.):

- Flat file list
- Only two required env vars
- All configuration done inside Discord after first start

---

## Support & Safety

- The bot never crashes on bad user input.
- Permissions are checked server-side on every command, button, select menu and modal.
- Staff notes are never sent to blocked users.
- Token and secrets are never exposed.

---

## License

MIT — free to use and modify.
