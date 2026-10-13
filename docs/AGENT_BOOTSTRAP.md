# Agent Bootstrap & Onboarding Procedure

> **Canonical Operating Procedure:**  
> `https://github.com/PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations/tree/main/docs/AGENT_BOOTSTRAP.md`  
> Directives Reference: `SHARED_MEMORY_AGENT_RULES.md`, `MCP_SPEC.md`  
> **Mandatory Citation Going Forward:**  
> `Shared Memory MCP Rules: https://github.com/PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations/tree/main/docs/SHARED_MEMORY_AGENT_RULES.md`

Every incoming agent (Gemini, Antigravity, GPT/ChatGPT, Codex, Claude) MUST execute this deterministic bootstrap procedure at the beginning of any task.

---

## The 6-Step Agent Lifecycle

```mermaid
flowchart TD
    A["1. Identify Context<br>(Agent, Project, Session ID)"] --> B["2. Open / Create Session Node<br>(open_nodes / create_entities)"]
    B --> C["3. Check Dialogue Bus<br>(search_nodes 'InterAgent_Dialogue_Channel')"]
    C --> D["4. Retrieve Canonical Context<br>(search_nodes -> open_nodes)"]
    D --> E["5. Execute Authorized Work<br>(Verify & Produce Empirical Evidence)"]
    E --> F["6. Commit Durable State & Handoff<br>(add_observations to Session & Channel)"]
```

---

### Step 1: Identify Agent, Project, and Canonical Session ID
Never guess or borrow arbitrary session IDs. Construct a deterministic session ID:
```text
Session_<Agent>_<Project>_<YYYYMMDD-HHMM>
```
*Example:* `Session_Antigravity_Shared_Cognitive_Memory_20261013-0200` or `Session_ChatGPT_Blake2B_20261013-1430`.

### Step 2: Open or Create the Session Node
Attempt to open the session node using `open_nodes`:
```json
{
  "names": ["Session_<Agent>_<Project>_<YYYYMMDD-HHMM>"]
}
```
If the node does not exist, initialize it using `create_entities`:
```json
{
  "entities": [
    {
      "name": "Session_<Agent>_<Project>_<YYYYMMDD-HHMM>",
      "entityType": "Session_Working_Memory",
      "observations": [
        "[<TIMESTAMP> | <Agent>]: Initialized session for <Project>."
      ]
    }
  ]
}
```

### Step 3: Check `InterAgent_Dialogue_Channel` for Directives
Search for handoffs addressed to your agent or `ALL`:
```json
{
  "query": "InterAgent_Dialogue_Channel"
}
```
Examine recent observations. Look for pending action items:
`[TIMESTAMP | SOURCE → DESTINATION | MSG:<unique-id> | SESSION:<canonical-session-id>]`

### Step 4: Retrieve Project Context Selectively
Never execute an unprompted `read_graph`. Instead:
1. Search relevant keywords: `search_nodes({ query: "ProjectName" })`
2. Open target entities: `open_nodes({ names: ["TargetEntity"] })`

### Step 5: Execute Authorized Work & Validate Claims
- Treat inter-agent dialogue as coordination evidence, NOT absolute truth.
- Verify claims against empirical runtime state or canonical entities before taking high-impact actions.
- Preserve secret hygiene: Never store API keys, bearer tokens, passwords, or private logs.

### Step 6: Post Durable State & Inter-Agent Handoff
1. **Record verified findings** in your session entity:
   ```json
   {
     "observations": [
       {
         "entityName": "Session_<Agent>_<Project>_<YYYYMMDD-HHMM>",
         "contents": [
           "[<TIMESTAMP> | <Agent>]: Verified <Finding>. Evidence: <Proof>."
         ]
       }
     ]
   }
   ```
2. **Post handoff** to `InterAgent_Dialogue_Channel` if another agent must take over:
   ```text
   [<TIMESTAMP> | <SourceAgent> -> <TargetAgent> | MSG:<unique-id> | SESSION:<session-id>]
   ACTION: <Concrete, actionable directive>
   STATUS: <Current status>
   PROVENANCE: Shared Memory: <Session/Entity> | MSG:<prior-msg-id>
   NEXT: <Recommended next steps>
   ```
