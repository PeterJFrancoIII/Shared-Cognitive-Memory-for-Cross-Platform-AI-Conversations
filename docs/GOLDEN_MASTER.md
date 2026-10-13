# Golden Master Registry — Shared Cognitive Memory

> **Canonical Golden Master Registry:**  
> `https://github.com/PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations/tree/main/docs/GOLDEN_MASTER.md`  
> Directives Reference: `SHARED_MEMORY_AGENT_RULES.md`, `MCP_SPEC.md`

---

## 1. Governance & Lineage Overview

The Shared Cognitive Memory program enforces strict change control. Golden Master baselines serve as verified, known-good reference points. Agents must never silently redefine or overturn baseline architecture without formal supersession records and empirical evidence.

---

## 2. Release History & Baselines

### Release 3.0 — Dedicated Repository Golden Master (2026-10-13)
* **Status:** **CURRENT AUTHORITATIVE GOLDEN MASTER**
* **Repository:** `PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations`
* **Authority:** Human Operator Directive (`MSG:scm-separate-github-repository-directive-20261013-gpt-01`)
* **Key Advancements:**
  1. Complete architectural independence: Terminal-to-Gemini Bridge retained in original repository; Shared Cognitive Memory granted dedicated public home.
  2. Native multi-client support: Verified configurations for Antigravity, Gemini, ChatGPT Desktop (local STDIO plugin), and ChatGPT Web (OpenAI Secure MCP Tunnel).
  3. Expanded 8-tool contract with static source inspection allowlist.
  4. 22/22 automated regression tests passing (`tests/mcp_runtime.test.js`).

### Release 2.0 — Local STDIO & Mutex Concurrency (2026-10-08)
* **Status:** Superseded by Release 3.0
* **Repository:** Historical (`Gemini_To_Terminal_CLI_Remote_Agent/docs/shared-cognitive-memory`)
* **Key Advancements:**
  1. Complete retirement and decommissioning of third-party public tunnels (ngrok).
  2. Introduction of atomic tempfile replacement and `O_EXCL` file locking (`memory.json.lock`).
  3. Bidirectional inter-agent verification ping/pong between Antigravity and ChatGPT Desktop.

### Release 1.0 — Initial Program Golden Master (2026-09-15)
* **Status:** Historical Baseline Reference
* **Repository:** Historical (`Gemini_To_Terminal_CLI_Remote_Agent` @ commit `7208a34a07bdb2d8de00b327cbb012feb0d3b74c`)
* **Locked Files:**
  - `AGENT_BOOTSTRAP.md` (`blob:6a7ea93bf268ad6175dab830abf11ebbd736665b`)
  - `MCP_SPEC.md` (`blob:279f5902ab23d32ed944d025432f6f393b8f0c74`)
  - `README.md` (`blob:614440461bc8a6eba47bbd3d1746582409728629`)
  - `SHARED_MEMORY_AGENT_RULES.md` (`blob:18d91498b44ea6c20b63aa0755aa1bf0096072e0`)

---

## 3. Change Control Protocol

1. Any future modifications to core MCP behavior must be accompanied by updated automated regression tests.
2. Changes must explicitly cite the prior Golden Master and declare supersession:
   `SUPERSEDES: <Prior Golden Master Release>`
3. No breaking changes may be introduced to the 6 cognitive-memory tools without consensus recorded in Shared Memory.
