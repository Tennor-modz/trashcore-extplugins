# 📦 TRASHCORE ULTRA — External Plugin System

## How It Works

External plugins are **optional** add-ons that bot owners can install/remove 
without touching the core codebase. When installed, they inject themselves into 
an existing category file (e.g. `plugins/downloads/downloads.js`).

---

## Files Overview

| File | Purpose |
|------|---------|
| `extPluginManager.js` | Core engine — handles install/remove/list |
| `extPluginRegistry.json` | List of available plugins (name, URL, category) |
| `plugins/settings/extPlugins.js` | Bot commands: `.plug install/remove/list` |
| `ext_plugin_examples/lyrics.js` | Example of what an external plugin file looks like |

---

## Bot Commands (Owner Only)

```
.plug list              — Browse available plugins
.plug installed         — See what's installed
.plug install lyrics    — Install the lyrics plugin
.plug remove lyrics     — Remove the lyrics plugin
```

---

## How Install Works (Step by Step)

1. Owner runs `.plug install lyrics`
2. Bot looks up `lyrics` in `extPluginRegistry.json`
3. Downloads the plugin JS code from the URL in the registry
4. Finds the right category file (e.g. `plugins/downloads/downloads.js`)
5. Appends the code wrapped in marker comments:
   ```js
   // ──── EXT_PLUGIN_START:lyrics ────
   // ... plugin code ...
   // ──── EXT_PLUGIN_END:lyrics ────
   ```
6. `pluginStore`'s hot-reload watcher picks up the change automatically
7. The new `.lyrics` command is now live!

## How Remove Works

1. Owner runs `.plug remove lyrics`
2. Bot finds the marker block in the category file
3. Cuts it out cleanly, leaving the rest of the file untouched
4. Hot-reloads plugins — command disappears

---

## Writing an External Plugin

Your plugin file must:
1. Export an array: `module.exports = [pluginObject]`
2. Each plugin object needs: `command`, `desc`, `category`, `run`
3. Only use `require()` for packages already in the bot's `node_modules`

Example (see `ext_plugin_examples/lyrics.js`):
```js
const axios = require('axios');

const myPlugin = {
  command:  ['mycommand', 'alias'],
  desc:     'What this plugin does',
  category: 'Downloader',  // matches the folder category
  run: async ({ trashcore, m, args, text, xreply }) => {
    return xreply('Hello from external plugin!');
  }
};

module.exports = [myPlugin];
```

---

## Adding to the Registry

Edit `extPluginRegistry.json` and add an entry:
```json
{
  "id": "lyrics",
  "name": "Lyrics",
  "category": "downloads",
  "description": "Search and fetch song lyrics",
  "commands": ["lyrics", "lyric"],
  "aliases": ["lyrics"],
  "url": "https://raw.githubusercontent.com/YOU/repo/main/downloads/lyrics.js",
  "author": "You",
  "version": "1.0.0"
}
```

You can also host `extPluginRegistry.json` remotely and update the manager 
to fetch it from a URL for a live plugin store.

---

## Setup (Add to your bot)

1. Copy `extPluginManager.js` → bot root
2. Copy `extPluginRegistry.json` → bot root  
3. Copy `plugins/settings/extPlugins.js` → `plugins/settings/`
4. The `pluginStore` will auto-load `extPlugins.js` on next startup

No changes to `index.js` or `pluginStore.js` needed! ✅
