# Client Setup Guide — OpenAI ChatGPT & Codex

> **Canonical Client Guide:**  
> `https://github.com/PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations/tree/main/docs/SETUP_CHATGPT.md`

---

## Overview
OpenAI ChatGPT connects to Shared Cognitive Memory using two supported architectures:
1. **Local Desktop Plugin (STDIO):** For macOS ChatGPT Desktop and Codex CLI (100% local, zero ingress, $0 cost).
2. **OpenAI Secure MCP Tunnel:** For ChatGPT Web (`chatgpt.com`) and mobile apps (outbound-only encrypted HTTPS, zero open inbound firewall ports).

---

## 1. ChatGPT macOS Desktop (Local STDIO Plugin)

### A. Manifest Configuration
Create or link the plugin manifest at `~/.agents/plugins/shared-cognitive-memory/.mcp.json`:

```json
{
  "mcpServers": {
    "shared-cognitive-memory": {
      "command": "/usr/local/bin/node",
      "args": [
        "/path/to/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations/scripts/sse_bridge.js",
        "--stdio"
      ],
      "cwd": "/path/to/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations",
      "env": {
        "MEMORY_FILE_PATH": "/path/to/canonical/memory.json"
      },
      "enabled": true
    }
  }
}
```

### B. Personal Marketplace Registration
In `~/.agents/plugins/marketplace.json`, add the entry to the personal marketplace catalog:
```json
{
  "plugins": [
    {
      "name": "shared-cognitive-memory",
      "source": "local",
      "path": "/path/to/plugin"
    }
  ]
}
```

### C. Codex Configuration
In `~/.codex/config.toml`, enable the plugin:
```toml
[plugins."shared-cognitive-memory@personal"]
enabled = true
```

---

## 2. ChatGPT Web & Mobile (OpenAI Secure MCP Tunnel)

For cloud conversations on `chatgpt.com` that require access to your local sovereign memory graph:

1. **Start the Loopback MCP Gateway:**
   ```bash
   node scripts/sse_bridge.js 8080
   ```
2. **Start the OpenAI Tunnel Client:**
   Using OpenAI's official `tunnel-client` daemon, initiate an outbound tunnel pointing to `http://127.0.0.1:8080`.
3. **Register Private App in ChatGPT:**
   Select your private MCP App ("Shared Cognitive Memory — Private") in your ChatGPT workspace settings.
