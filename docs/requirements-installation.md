# Requirements Installation

This project uses Python only to provide a project-local Node.js toolchain through `nodeenv`. The app itself is a Next.js and TypeScript application.

## Prerequisites

Install Python 3.9 or newer from [python.org](https://www.python.org/downloads/). On Windows, enable **Add python.exe to PATH** during installation.

No system-wide Node.js installation is required when using the project workflow below.

## Windows Git Bash

Run these commands from the repository root:

```bash
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
nodeenv -p --node=lts
node -v
npm -v
npm install
```

Use the virtual environment in every new terminal:

```bash
source .venv/Scripts/activate
```

To leave it:

```bash
deactivate
```

## Windows PowerShell

Activate the same environment with:

```powershell
.venv\\Scripts\\Activate.ps1
```

Then run the dependency commands from the previous section. If PowerShell blocks script activation, adjust the execution policy for your user according to your organization’s policy, or use Git Bash.

## What gets installed

- `requirements.txt` installs `nodeenv`.
- `nodeenv` installs a project-local Node.js LTS and npm inside `.venv`.
- `npm install` installs the dependencies declared in [package.json](../package.json).

Continue with [Website Initialization](website-initialization.md) after installation.
