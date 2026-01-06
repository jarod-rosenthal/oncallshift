# ChromaDB Setup for claude-mem Plugin

## Installation Complete

ChromaDB has been successfully installed in WSL using pipx.

## Starting the Chroma Server

To start the Chroma server, run this command in your terminal:

```bash
wsl -- bash -c "export PATH=\"$HOME/.local/bin:$PATH\" && chroma run --host localhost --port 8000"
```

Or, if you're already in a WSL session:

```bash
chroma run --host localhost --port 8000
```

## Server Configuration

- **Host**: localhost
- **Port**: 8000
- **Data Directory**: ./chroma (relative to where you start the server)
- **Connection URL**: http://localhost:8000

## Verifying Installation

Check ChromaDB version:
```bash
wsl -- bash -c "export PATH=\"$HOME/.local/bin:$PATH\" && chroma --version"
```

## Notes

- The PATH to pipx binaries (`~/.local/bin`) has been added to your WSL environment
- You may need to restart your WSL terminal for PATH changes to take full effect
- ChromaDB version 1.4.0 is installed with Chroma CLI version 1.3.0
- The server will create a `./chroma` directory in the current working directory to store data

## For claude-mem Plugin

Configure the claude-mem MCP plugin to connect to:
- URL: `http://localhost:8000`

Make sure the Chroma server is running before using the claude-mem plugin.
