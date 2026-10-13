# Security Architecture & Secret Hygiene Policy

> **Canonical Security Policy:**  
> `https://github.com/PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations/tree/main/docs/SECURITY.md`  
> Directives Reference: `SHARED_MEMORY_AGENT_RULES.md`, `MCP_SPEC.md`

---

## 1. Core Security Tenets

1. **Zero Secret Storage:** API keys, passwords, bearer tokens, SSH keys, private certificates, and session cookies are strictly prohibited from being persisted in the knowledge graph (`memory.json`) or committed to Git repositories.
2. **Abstract Secret References:** When agents must record configuration requiring authentication, they MUST use abstract references:
   - Environment variables: `env:ANTHROPIC_API_KEY` or `env:OPENAI_API_KEY`
   - Local protected files: `file:~/.config/credentials.json`
3. **Fail-Closed by Design:** Any operation that encounters malformed syntax, unauthorized file access, or credential-shaped content fails closed immediately without mutating graph state.

---

## 2. Hardened Tool Boundaries

The MCP server enforces strict capability containment:

| Threat Vector | Mitigation Strategy | Enforcement Mechanism |
| :--- | :--- | :--- |
| **Arbitrary File Deletion** | No `delete_*` tools exist in the protocol. | Permanently removed from MCP tool registry. |
| **Arbitrary Command Execution** | Zero shell, eval, or exec capabilities exposed. | No process spawning APIs exposed via MCP. |
| **Path Traversal Attacks** | Rejection of `..`, absolute paths, and NUL bytes. | `isPathTraversalOrEscape()` validation check. |
| **Symlink Escapes** | Canonical path resolution check. | `fs.realpathSync()` verified against project root. |
| **Credential Exfiltration** | Strict allowlist for source inspection. | `ALLOWED_PROJECT_FILES` denies access to `memory.json`, `.token`, `.key`, `.log`, and `.bak`. |
| **Context Exhaustion DoS** | Capped search responses and observation length. | Search matches capped at 96 KB; observation excerpts capped at 2,000 characters. |

---

## 3. Network Transport Isolation

1. **Direct STDIO Transport:**
   - Default operating mode for all local agents.
   - Spawns as a sub-process communicating exclusively through POSIX pipes (`stdin` / `stdout`).
   - Zero exposed network interfaces, zero attack surface.

2. **OpenAI Secure MCP Tunnel:**
   - Employs an outbound-only HTTPS connection over port 443.
   - Requires zero router port forwarding and zero inbound open ports.
   - External requests are mediated through cryptographic channel signatures.

3. **Loopback HTTP Bridge:**
   - Binds strictly to `127.0.0.1`.
   - Requires valid `Authorization: Bearer <TOKEN>` header on every incoming request.
   - Tokens are stored in a restricted host file with `0600` permissions.
