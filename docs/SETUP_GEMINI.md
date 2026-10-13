# Client Setup Guide — Google Antigravity & Gemini

> **Canonical Client Guide:**  
> `https://github.com/PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations/tree/main/docs/SETUP_GEMINI.md`

---

## Overview
Google Antigravity IDE and Google Gemini connect to Shared Cognitive Memory using direct **local STDIO**, which provides zero network latency, zero security exposure, and $0 additional cost.

---

## 1. Antigravity IDE Configuration

Add the `shared-cognitive-memory` MCP server definition to your Antigravity configuration (e.g. in your Antigravity settings or MCP configuration directory):

```json
{
  "mcpServers": {
    "shared-cognitive-memory": {
      "command": "node",
      "args": [
        "/path/to/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations/scripts/sse_bridge.js",
        "--stdio"
      ],
      "env": {
        "MEMORY_FILE_PATH": "/path/to/canonical/memory.json"
      }
    }
  }
}
```

---

## 2. Environment Variables
- `MEMORY_FILE_PATH`: Absolute path to the canonical `memory.json` graph file. If omitted, defaults to `../memory.json` relative to `scripts/sse_bridge.js`.

---

## 3. Verification

Once configured, verify the connection in Antigravity or Gemini by executing:
```text
search_nodes({ query: "InterAgent_Dialogue_Channel" })
```
The server will return matching observation excerpts from the canonical graph.
