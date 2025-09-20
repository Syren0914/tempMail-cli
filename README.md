# tempMail-cli

A tiny, single-file CLI to spin up a temporary email inbox, watch it live in a terminal UI, copy the address, preview messages (From/Subject/Date + body), and nuke the inbox when you're done.

## Quick Start

**Create & watch an inbox:** `tempmail create`

**Delete last inbox:** `tempmail delete`

Mouse support (click to select) or ↑/↓ + Enter

Press `c` anytime to copy the inbox address to your clipboard

## Features

- **One-liner UX:** `tempmail create`
- **Live TUI** (polling every 2s by default)
- **Preview header** shows From (full email), Subject, Date
- **Clipboard support:** Windows/WSL (clip.exe), macOS (pbcopy), Wayland (wl-copy), X11 (xclip/xsel)
- **Safe delete** with `tempmail delete`
- **Works on** Linux, macOS, and WSL

## Requirements

- **Python 3.8+**
- **TempMail.so via RapidAPI:**
  - `RAPIDAPI_KEY`
  - `TEMPMAIL_TOKEN`
- Main build uses `requests` (see "Install")
- No-dependency variant available (`tempmail-np`) that uses only the Python stdlib.

## Install

### Option A — Distro package (Debian/Ubuntu/WSL)
```bash
sudo apt-get update
sudo apt-get install -y python3-requests
```

### Option B — Virtualenv (any OS)
```bash
python3 -m venv ~/.venvs/tempmail
source ~/.venvs/tempmail/bin/activate
pip install requests
# (optional) deactivate when done
```

### Put the CLI on your PATH
```bash
mkdir -p ~/.local/bin
cp tempmail ~/.local/bin/tempmail
chmod +x ~/.local/bin/tempmail
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**Windows/WSL note:** if you copied the file from `C:\...`, convert line endings just in case:
```bash
sed -i 's/\r$//' ~/.local/bin/tempmail
```

## Credentials (env vars)

### Getting Your Tokens

To use this CLI, you'll need to obtain API credentials from [TempMail.so](https://tempmail.so):

1. **RAPIDAPI_KEY**: Get this from RapidAPI when you subscribe to the TempMail.so API
2. **TEMPMAIL_TOKEN**: Get this from your TempMail.so account dashboard

Visit [https://tempmail.so](https://tempmail.so) to sign up and get your tokens.

### Setting Up Environment Variables

```bash
# temporary for the current shell
export RAPIDAPI_KEY="YOUR_RAPIDAPI_KEY"
export TEMPMAIL_TOKEN="YOUR_TEMPMAIL_ACCOUNT_TOKEN"

# or persist for every shell:
cat > ~/.tempmail_env <<'EOF'
export RAPIDAPI_KEY="YOUR_RAPIDAPI_KEY"
export TEMPMAIL_TOKEN="YOUR_TEMPMAIL_ACCOUNT_TOKEN"
EOF
chmod 600 ~/.tempmail_env
echo 'source ~/.tempmail_env' >> ~/.bashrc
source ~/.bashrc
```

## Usage

```bash
# Create inbox, auto-copy address, open live TUI
tempmail create

# Useful options:
#   --minutes 10          lifespan (default 10)
#   --prefix mybox        custom local-part (random if omitted)
#   --domain example.com  choose a specific domain (first available if omitted)
#   --interval 2          poll seconds (default 2)
tempmail create --minutes 5 --prefix myproj --interval 2

# Delete the last-created inbox
tempmail delete
```

## TUI controls

- **Mouse:** click a message to preview
- **Keyboard:** ↑/↓ select, Enter refresh preview
- `r` = refresh, `c` = copy inbox address, `d` = delete inbox, `q` = quit

## No-dependency build (optional)

If you can't install `requests`, use the stdlib-only binary:

```bash
cp tempmail-np ~/.local/bin/tempmail
chmod +x ~/.local/bin/tempmail
tempmail create
```

## Troubleshooting

### `import: command not found` or `$'\r'` errors
The file likely has Windows CRLF line endings or a broken shebang. Fix:

```bash
sed -i 's/\r$//' ~/.local/bin/tempmail
sed -i '1s|^.*$|#!/usr/bin/env python3|' ~/.local/bin/tempmail
chmod +x ~/.local/bin/tempmail
```

As a fallback, wrap it:
```bash
mv ~/.local/bin/tempmail ~/.local/bin/tempmail.py
printf '#!/usr/bin/env bash\nexec python3 "$HOME/.local/bin/tempmail.py" "$@"\n' > ~/.local/bin/tempmail
chmod +x ~/.local/bin/tempmail ~/.local/bin/tempmail.py
```

### Clipboard not copying
Install a helper:
- **Wayland:** `sudo apt-get install wl-clipboard` → `wl-copy`
- **X11:** `sudo apt-get install xclip` or `xsel`
- **WSL/Windows:** ensure `clip.exe` exists (it does on recent Windows)

### Mouse doesn't select
Use ↑/↓ + Enter. (Some terminals don't forward mouse events.)

## Project layout

```
tempmail-cli/
├─ tempmail                # main Python script (executable)
├─ tempmail-np             # optional no-deps variant (urllib only)
├─ README.md
├─ LICENSE                 # MIT
├─ requirements.txt        # contains: requests
├─ assets/
│  └─ screenshot.png       # add your screenshot here
└─ .gitignore
```

### requirements.txt
```
requests
```

### .gitignore
```
__pycache__/
*.pyc
.venv/
.DS_Store
```

## Roadmap

- [ ] `y` to copy selected mail's text to clipboard
- [ ] Save/preview attachments
- [ ] Export message as `.eml`

## License

MIT — see [LICENSE](LICENSE)