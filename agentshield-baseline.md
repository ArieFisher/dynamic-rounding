# AgentShield Security Report

**Date:** 2026-05-29T03:16:15.186Z
**Target:** /Users/ariefisher/.claude
**Grade:** D (54/100)

## Summary

| Metric | Value |
|--------|-------|
| Files scanned | 770 |
| Total findings | 1010 |
| Critical | 0 |
| High | 57 |
| Medium | 280 |
| Low | 636 |
| Info | 37 |
| Auto-fixable | 9 |

## Skill Health

| Metric | Value |
|--------|-------|
| Skills discovered | 255 |
| Instrumented | 0 |
| Versioned | 0 |
| Rollback-ready | 0 |
| With history | 0 |

## Score Breakdown

| Category | Score |
|----------|-------|
| Secrets | 100/100 |
| Permissions | 0/100 |
| Hooks | 100/100 |
| MCP Servers | 70/100 |
| Agents | 0/100 |

## Findings

### 🟡 CLAUDE.md contains auto-run instruction

- **Severity:** high
- **Category:** injection
- **File:** `CLAUDE.md:44`
- **Description:** Found "without asking" — Bypasses confirmation. If this CLAUDE.md is in a cloned repository, a malicious repo could use this to run arbitrary commands when a developer opens it with Claude Code.
- **Evidence:** `without asking`

### 🟡 Agent has Bash access: agents/chief-of-staff.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/chief-of-staff.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: agents/chief-of-staff.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/chief-of-staff.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Edit, Write + Bash`

### 🟡 Agent has Bash access: agents/code-simplifier.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/code-simplifier.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: agents/code-simplifier.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/code-simplifier.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🟡 Agent has Bash access: agents/gan-evaluator.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/gan-evaluator.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: agents/gan-evaluator.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/gan-evaluator.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write + Bash`

### 🟡 Agent has Bash access: agents/gan-generator.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/gan-generator.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: agents/gan-generator.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/gan-generator.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🟡 Agent has Bash access: agents/harness-optimizer.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/harness-optimizer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: agents/harness-optimizer.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/harness-optimizer.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Edit + Bash`

### 🟡 Agent has Bash access: agents/loop-operator.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/loop-operator.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: agents/loop-operator.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/loop-operator.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Edit + Bash`

### 🟡 Agent has Bash access: agents/network-troubleshooter.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/network-troubleshooter.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has Bash access: agents/opensource-forker.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/opensource-forker.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: agents/opensource-forker.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/opensource-forker.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🟡 Agent has Bash access: agents/opensource-packager.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/opensource-packager.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: agents/opensource-packager.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/opensource-packager.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🟡 Agent has Bash access: agents/opensource-sanitizer.md

- **Severity:** high
- **Category:** agents
- **File:** `agents/opensource-sanitizer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Skill tampering or unsigned skill loading instruction

- **Severity:** high
- **Category:** injection
- **File:** `plugins/cache/claude-plugins-official/superpowers/5.1.0/CLAUDE.md:90`
- **Description:** Found "modify skill content" — Instructs agent to modify skill definitions — runtime skill tampering. Reference: OpenClaw skill verification gate (vgzotta PR #14893).
- **Evidence:** `modify skill content`

### 🟡 Skill tampering or unsigned skill loading instruction

- **Severity:** high
- **Category:** injection
- **File:** `plugins/cache/claude-plugins-official/superpowers/f2cbfbefebbf/CLAUDE.md:90`
- **Description:** Found "modify skill content" — Instructs agent to modify skill definitions — runtime skill tampering. Reference: OpenClaw skill verification gate (vgzotta PR #14893).
- **Evidence:** `modify skill content`

### 🟡 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/chief-of-staff.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/chief-of-staff.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/chief-of-staff.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/chief-of-staff.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Edit, Write + Bash`

### 🟡 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/code-simplifier.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/code-simplifier.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/code-simplifier.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/code-simplifier.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🟡 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/gan-evaluator.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/gan-evaluator.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/gan-evaluator.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/gan-evaluator.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write + Bash`

### 🟡 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/gan-generator.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/gan-generator.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/gan-generator.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/gan-generator.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🟡 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/harness-optimizer.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/harness-optimizer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/harness-optimizer.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/harness-optimizer.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Edit + Bash`

### 🟡 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/loop-operator.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/loop-operator.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/loop-operator.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/loop-operator.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Edit + Bash`

### 🟡 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/network-troubleshooter.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/network-troubleshooter.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/opensource-forker.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/opensource-forker.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/opensource-forker.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/opensource-forker.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🟡 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/opensource-packager.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/opensource-packager.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/opensource-packager.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/opensource-packager.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🟡 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/opensource-sanitizer.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/opensource-sanitizer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has Bash access: plugins/marketplaces/ecc/agents/chief-of-staff.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/chief-of-staff.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/marketplaces/ecc/agents/chief-of-staff.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/chief-of-staff.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Edit, Write + Bash`

### 🟡 Agent has Bash access: plugins/marketplaces/ecc/agents/code-simplifier.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/code-simplifier.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/marketplaces/ecc/agents/code-simplifier.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/code-simplifier.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🟡 Agent has Bash access: plugins/marketplaces/ecc/agents/gan-evaluator.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/gan-evaluator.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/marketplaces/ecc/agents/gan-evaluator.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/gan-evaluator.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write + Bash`

### 🟡 Agent has Bash access: plugins/marketplaces/ecc/agents/gan-generator.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/gan-generator.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/marketplaces/ecc/agents/gan-generator.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/gan-generator.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🟡 Agent has Bash access: plugins/marketplaces/ecc/agents/harness-optimizer.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/harness-optimizer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/marketplaces/ecc/agents/harness-optimizer.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/harness-optimizer.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Edit + Bash`

### 🟡 Agent has Bash access: plugins/marketplaces/ecc/agents/loop-operator.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/loop-operator.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/marketplaces/ecc/agents/loop-operator.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/loop-operator.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Edit + Bash`

### 🟡 Agent has Bash access: plugins/marketplaces/ecc/agents/network-troubleshooter.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/network-troubleshooter.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has Bash access: plugins/marketplaces/ecc/agents/opensource-forker.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/opensource-forker.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/marketplaces/ecc/agents/opensource-forker.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/opensource-forker.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🟡 Agent has Bash access: plugins/marketplaces/ecc/agents/opensource-packager.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/opensource-packager.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🟡 Agent has full escalation chain: plugins/marketplaces/ecc/agents/opensource-packager.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/opensource-packager.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🟡 Agent has Bash access: plugins/marketplaces/ecc/agents/opensource-sanitizer.md

- **Severity:** high
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/opensource-sanitizer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Missing deny rule: SSH connections from agent

- **Severity:** medium
- **Category:** permissions
- **File:** `settings.json`
- **Description:** The deny list does not block "ssh". Consider adding it to prevent ssh connections from agent.

### 🔵 Missing deny rule: Writing to device files

- **Severity:** medium
- **Category:** permissions
- **File:** `settings.json`
- **Description:** The deny list does not block "> /dev/". Consider adding it to prevent writing to device files.

### 🔵 Missing deny rule: SSH connections from agent

- **Severity:** medium
- **Category:** permissions
- **Runtime Confidence:** project-local optional
- **File:** `settings.local.json`
- **Description:** The deny list does not block "ssh". Consider adding it to prevent ssh connections from agent.

### 🔵 Missing deny rule: Writing to device files

- **Severity:** medium
- **Category:** permissions
- **Runtime Confidence:** project-local optional
- **File:** `settings.local.json`
- **Description:** The deny list does not block "> /dev/". Consider adding it to prevent writing to device files.

### 🔵 Agent definition effective size is 5349 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/a11y-architect.md`
- **Description:** The agent definition at agents/a11y-architect.md has an effective size of 5349 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5349 effective characters (7351 raw)`

### 🔵 Agent definition effective size is 6505 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/architect.md`
- **Description:** The agent definition at agents/architect.md has an effective size of 6505 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6505 effective characters (7284 raw)`

### 🔵 Agent has Bash access: agents/build-error-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/build-error-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/build-error-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/build-error-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent definition effective size is 5191 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/chief-of-staff.md`
- **Description:** The agent definition at agents/chief-of-staff.md has an effective size of 5191 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5191 effective characters (6566 raw)`

### 🔵 Agent has Bash access: agents/code-architect.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/code-architect.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: agents/code-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/code-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 11265 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/code-reviewer.md`
- **Description:** The agent definition at agents/code-reviewer.md has an effective size of 11265 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `11265 effective characters (13787 raw)`

### 🔵 Agent has Bash access: agents/cpp-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/cpp-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/cpp-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/cpp-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/cpp-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/cpp-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: agents/csharp-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/csharp-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 5242 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/csharp-reviewer.md`
- **Description:** The agent definition at agents/csharp-reviewer.md has an effective size of 5242 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5242 effective characters (5652 raw)`

### 🔵 Agent has Bash access: agents/dart-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/dart-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/dart-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/dart-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/database-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/database-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/database-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/database-reviewer.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/django-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/django-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/django-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/django-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/django-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/django-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 6943 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/django-reviewer.md`
- **Description:** The agent definition at agents/django-reviewer.md has an effective size of 6943 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6943 effective characters (7967 raw)`

### 🔵 Agent has Bash access: agents/doc-updater.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/doc-updater.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/doc-updater.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/doc-updater.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/e2e-runner.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/e2e-runner.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/e2e-runner.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/e2e-runner.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/fastapi-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/fastapi-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: agents/flutter-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/flutter-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 14220 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/flutter-reviewer.md`
- **Description:** The agent definition at agents/flutter-reviewer.md has an effective size of 14220 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `14220 effective characters (15033 raw)`

### 🔵 Agent has Bash access: agents/fsharp-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/fsharp-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 5218 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/fsharp-reviewer.md`
- **Description:** The agent definition at agents/fsharp-reviewer.md has an effective size of 5218 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5218 effective characters (5628 raw)`

### 🔵 Agent has Bash access: agents/go-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/go-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/go-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/go-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/go-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/go-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: agents/harmonyos-app-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/harmonyos-app-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/harmonyos-app-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/harmonyos-app-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent definition effective size is 8931 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/harmonyos-app-resolver.md`
- **Description:** The agent definition at agents/harmonyos-app-resolver.md has an effective size of 8931 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `8931 effective characters (9397 raw)`

### 🔵 Agent has Bash access: agents/java-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/java-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/java-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/java-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/java-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/java-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 12262 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/java-reviewer.md`
- **Description:** The agent definition at agents/java-reviewer.md has an effective size of 12262 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `12262 effective characters (13267 raw)`

### 🔵 Agent has Bash access: agents/kotlin-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/kotlin-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/kotlin-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/kotlin-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/kotlin-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/kotlin-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 6214 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/kotlin-reviewer.md`
- **Description:** The agent definition at agents/kotlin-reviewer.md has an effective size of 6214 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6214 effective characters (7605 raw)`

### 🔵 Agent definition effective size is 6588 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/marketing-agent.md`
- **Description:** The agent definition at agents/marketing-agent.md has an effective size of 6588 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6588 effective characters (7226 raw)`

### 🔵 Agent has Bash access: agents/mle-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/mle-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 9551 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/mle-reviewer.md`
- **Description:** The agent definition at agents/mle-reviewer.md has an effective size of 9551 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `9551 effective characters (10263 raw)`

### 🔵 Agent definition effective size is 5088 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/opensource-packager.md`
- **Description:** The agent definition at agents/opensource-packager.md has an effective size of 5088 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5088 effective characters (7933 raw)`

### 🔵 Agent has Bash access: agents/performance-optimizer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/performance-optimizer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/performance-optimizer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/performance-optimizer.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/pr-test-analyzer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/pr-test-analyzer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: agents/python-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/python-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: agents/pytorch-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/pytorch-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/pytorch-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/pytorch-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/react-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/react-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/react-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/react-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent definition effective size is 5900 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/react-build-resolver.md`
- **Description:** The agent definition at agents/react-build-resolver.md has an effective size of 5900 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5900 effective characters (11183 raw)`

### 🔵 Agent has Bash access: agents/react-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/react-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 9749 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/react-reviewer.md`
- **Description:** The agent definition at agents/react-reviewer.md has an effective size of 9749 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `9749 effective characters (11409 raw)`

### 🔵 Agent has Bash access: agents/refactor-cleaner.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/refactor-cleaner.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/refactor-cleaner.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/refactor-cleaner.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/rust-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/rust-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/rust-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/rust-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/rust-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/rust-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 5309 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/rust-reviewer.md`
- **Description:** The agent definition at agents/rust-reviewer.md has an effective size of 5309 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5309 effective characters (5640 raw)`

### 🔵 Agent has Bash access: agents/security-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/security-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/security-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/security-reviewer.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/silent-failure-hunter.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/silent-failure-hunter.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: agents/swift-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/swift-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/swift-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/swift-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/swift-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/swift-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 6915 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/swift-reviewer.md`
- **Description:** The agent definition at agents/swift-reviewer.md has an effective size of 6915 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6915 effective characters (7335 raw)`

### 🔵 Agent has Bash access: agents/tdd-guide.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/tdd-guide.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: agents/tdd-guide.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/tdd-guide.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: agents/typescript-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `agents/typescript-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 8465 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `agents/typescript-reviewer.md`
- **Description:** The agent definition at agents/typescript-reviewer.md has an effective size of 8465 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `8465 effective characters (9034 raw)`

### 🔵 Template defines risky MCP server: filesystem

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. Filesystem MCP grants read/write access to the file system. Restrict to specific directories using allowedDirectories config.

### 🔵 Template defines risky MCP server: playwright

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. Browser automation MCP can navigate to arbitrary URLs and run JavaScript. Restrict to specific domains and disable script running where possible.

### 🔵 Template defines risky MCP server: browserbase

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. Browser automation MCP can navigate to arbitrary URLs and run JavaScript. Restrict to specific domains and disable script running where possible.

### 🔵 Template defines risky MCP server: browser-use

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. Browser automation MCP can navigate to arbitrary URLs and run JavaScript. Restrict to specific domains and disable script running where possible.

### 🔵 Template MCP server "vercel" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "vercel" uses URL transport connecting to "https://mcp.vercel.com". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://mcp.vercel.com`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "cloudflare-docs" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "cloudflare-docs" uses URL transport connecting to "https://docs.mcp.cloudflare.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://docs.mcp.cloudflare.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "cloudflare-workers-builds" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "cloudflare-workers-builds" uses URL transport connecting to "https://builds.mcp.cloudflare.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://builds.mcp.cloudflare.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "cloudflare-workers-bindings" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "cloudflare-workers-bindings" uses URL transport connecting to "https://bindings.mcp.cloudflare.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://bindings.mcp.cloudflare.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "cloudflare-observability" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "cloudflare-observability" uses URL transport connecting to "https://observability.mcp.cloudflare.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://observability.mcp.cloudflare.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "clickhouse" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "clickhouse" uses URL transport connecting to "https://mcp.clickhouse.cloud/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://mcp.clickhouse.cloud/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "browser-use" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "browser-use" uses URL transport connecting to "https://api.browser-use.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://api.browser-use.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "laraplugins" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "laraplugins" uses URL transport connecting to "https://laraplugins.io/mcp/plugins". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://laraplugins.io/mcp/plugins`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 No permissions block configured

- **Severity:** medium
- **Category:** permissions
- **File:** `plugins/cache/claude-plugins-official/chrome-devtools-mcp/1.1.0/.gemini/settings.json`
- **Description:** settings.json has configuration but no permissions section. Without explicit allow/deny lists, the agent relies on default permissions which may be too broad. Add a permissions block to restrict tool access.
- **Fix:** Add a permissions block with scoped allow and deny lists

### 🔵 No PreToolUse security hooks configured

- **Severity:** medium
- **Category:** misconfiguration
- **File:** `plugins/cache/claude-plugins-official/chrome-devtools-mcp/1.1.0/.gemini/settings.json`
- **Description:** No PreToolUse hooks are defined. These hooks can catch dangerous operations before they run, providing an essential security layer.
- **Fix:** Add PreToolUse hooks for security-sensitive operations

### 🔵 No PreToolUse security hooks configured

- **Severity:** medium
- **Category:** misconfiguration
- **File:** `plugins/cache/claude-plugins-official/superpowers/5.1.0/hooks/hooks-cursor.json`
- **Description:** No PreToolUse hooks are defined. These hooks can catch dangerous operations before they run, providing an essential security layer.
- **Fix:** Add PreToolUse hooks for security-sensitive operations

### 🔵 No PreToolUse security hooks configured

- **Severity:** medium
- **Category:** misconfiguration
- **File:** `plugins/cache/claude-plugins-official/superpowers/f2cbfbefebbf/hooks/hooks-cursor.json`
- **Description:** No PreToolUse hooks are defined. These hooks can catch dangerous operations before they run, providing an essential security layer.
- **Fix:** Add PreToolUse hooks for security-sensitive operations

### 🔵 Agent definition effective size is 5349 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/a11y-architect.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/a11y-architect.md has an effective size of 5349 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5349 effective characters (7351 raw)`

### 🔵 Agent definition effective size is 6505 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/architect.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/architect.md has an effective size of 6505 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6505 effective characters (7284 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/build-error-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/build-error-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/build-error-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/build-error-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent definition effective size is 5191 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/chief-of-staff.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/chief-of-staff.md has an effective size of 5191 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5191 effective characters (6566 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/code-architect.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/code-architect.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/code-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/code-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 11265 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/code-reviewer.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/code-reviewer.md has an effective size of 11265 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `11265 effective characters (13787 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/cpp-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/cpp-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/cpp-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/cpp-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/cpp-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/cpp-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/csharp-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/csharp-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 5242 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/csharp-reviewer.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/csharp-reviewer.md has an effective size of 5242 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5242 effective characters (5652 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/dart-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/dart-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/dart-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/dart-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/database-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/database-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/database-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/database-reviewer.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/django-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/django-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/django-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/django-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/django-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/django-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 6943 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/django-reviewer.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/django-reviewer.md has an effective size of 6943 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6943 effective characters (7967 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/doc-updater.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/doc-updater.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/doc-updater.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/doc-updater.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/e2e-runner.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/e2e-runner.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/e2e-runner.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/e2e-runner.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/fastapi-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/fastapi-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/flutter-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/flutter-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 14220 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/flutter-reviewer.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/flutter-reviewer.md has an effective size of 14220 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `14220 effective characters (15033 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/fsharp-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/fsharp-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 5218 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/fsharp-reviewer.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/fsharp-reviewer.md has an effective size of 5218 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5218 effective characters (5628 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/go-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/go-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/go-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/go-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/go-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/go-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/harmonyos-app-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/harmonyos-app-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/harmonyos-app-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/harmonyos-app-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent definition effective size is 8931 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/harmonyos-app-resolver.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/harmonyos-app-resolver.md has an effective size of 8931 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `8931 effective characters (9397 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/java-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/java-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/java-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/java-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/java-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/java-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 12262 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/java-reviewer.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/java-reviewer.md has an effective size of 12262 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `12262 effective characters (13267 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/kotlin-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/kotlin-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/kotlin-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/kotlin-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/kotlin-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/kotlin-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 6214 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/kotlin-reviewer.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/kotlin-reviewer.md has an effective size of 6214 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6214 effective characters (7605 raw)`

### 🔵 Agent definition effective size is 6588 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/marketing-agent.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/marketing-agent.md has an effective size of 6588 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6588 effective characters (7226 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/mle-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/mle-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 9551 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/mle-reviewer.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/mle-reviewer.md has an effective size of 9551 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `9551 effective characters (10263 raw)`

### 🔵 Agent definition effective size is 5088 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/opensource-packager.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/opensource-packager.md has an effective size of 5088 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5088 effective characters (7933 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/performance-optimizer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/performance-optimizer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/performance-optimizer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/performance-optimizer.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/pr-test-analyzer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/pr-test-analyzer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/python-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/python-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/pytorch-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/pytorch-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/pytorch-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/pytorch-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/react-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/react-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/react-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/react-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent definition effective size is 5900 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/react-build-resolver.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/react-build-resolver.md has an effective size of 5900 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5900 effective characters (11183 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/react-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/react-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 9749 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/react-reviewer.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/react-reviewer.md has an effective size of 9749 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `9749 effective characters (11409 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/refactor-cleaner.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/refactor-cleaner.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/refactor-cleaner.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/refactor-cleaner.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/rust-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/rust-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/rust-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/rust-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/rust-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/rust-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 5309 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/rust-reviewer.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/rust-reviewer.md has an effective size of 5309 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5309 effective characters (5640 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/security-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/security-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/security-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/security-reviewer.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/silent-failure-hunter.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/silent-failure-hunter.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/swift-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/swift-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/swift-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/swift-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/swift-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/swift-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 6915 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/swift-reviewer.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/swift-reviewer.md has an effective size of 6915 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6915 effective characters (7335 raw)`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/tdd-guide.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/tdd-guide.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/tdd-guide.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/tdd-guide.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/cache/ecc/ecc/2.0.0-rc.1/agents/typescript-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/typescript-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 8465 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/typescript-reviewer.md`
- **Description:** The agent definition at plugins/cache/ecc/ecc/2.0.0-rc.1/agents/typescript-reviewer.md has an effective size of 8465 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `8465 effective characters (9034 raw)`

### 🔵 Template defines risky MCP server: filesystem

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. Filesystem MCP grants read/write access to the file system. Restrict to specific directories using allowedDirectories config.

### 🔵 Template defines risky MCP server: playwright

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. Browser automation MCP can navigate to arbitrary URLs and run JavaScript. Restrict to specific domains and disable script running where possible.

### 🔵 Template defines risky MCP server: browserbase

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. Browser automation MCP can navigate to arbitrary URLs and run JavaScript. Restrict to specific domains and disable script running where possible.

### 🔵 Template defines risky MCP server: browser-use

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. Browser automation MCP can navigate to arbitrary URLs and run JavaScript. Restrict to specific domains and disable script running where possible.

### 🔵 Template MCP server "vercel" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "vercel" uses URL transport connecting to "https://mcp.vercel.com". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://mcp.vercel.com`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "cloudflare-docs" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "cloudflare-docs" uses URL transport connecting to "https://docs.mcp.cloudflare.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://docs.mcp.cloudflare.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "cloudflare-workers-builds" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "cloudflare-workers-builds" uses URL transport connecting to "https://builds.mcp.cloudflare.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://builds.mcp.cloudflare.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "cloudflare-workers-bindings" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "cloudflare-workers-bindings" uses URL transport connecting to "https://bindings.mcp.cloudflare.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://bindings.mcp.cloudflare.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "cloudflare-observability" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "cloudflare-observability" uses URL transport connecting to "https://observability.mcp.cloudflare.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://observability.mcp.cloudflare.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "clickhouse" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "clickhouse" uses URL transport connecting to "https://mcp.clickhouse.cloud/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://mcp.clickhouse.cloud/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "browser-use" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "browser-use" uses URL transport connecting to "https://api.browser-use.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://api.browser-use.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "laraplugins" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "laraplugins" uses URL transport connecting to "https://laraplugins.io/mcp/plugins". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://laraplugins.io/mcp/plugins`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 No permissions block configured

- **Severity:** medium
- **Category:** permissions
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/.vscode/settings.json`
- **Description:** settings.json has configuration but no permissions section. Without explicit allow/deny lists, the agent relies on default permissions which may be too broad. Add a permissions block to restrict tool access.
- **Fix:** Add a permissions block with scoped allow and deny lists

### 🔵 No PreToolUse security hooks configured

- **Severity:** medium
- **Category:** misconfiguration
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/.vscode/settings.json`
- **Description:** No PreToolUse hooks are defined. These hooks can catch dangerous operations before they run, providing an essential security layer.
- **Fix:** Add PreToolUse hooks for security-sensitive operations

### 🔵 No permissions block configured

- **Severity:** medium
- **Category:** permissions
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/.zed/settings.json`
- **Description:** settings.json has configuration but no permissions section. Without explicit allow/deny lists, the agent relies on default permissions which may be too broad. Add a permissions block to restrict tool access.
- **Fix:** Add a permissions block with scoped allow and deny lists

### 🔵 No PreToolUse security hooks configured

- **Severity:** medium
- **Category:** misconfiguration
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/.zed/settings.json`
- **Description:** No PreToolUse hooks are defined. These hooks can catch dangerous operations before they run, providing an essential security layer.
- **Fix:** Add PreToolUse hooks for security-sensitive operations

### 🔵 Agent definition effective size is 5349 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/a11y-architect.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/a11y-architect.md has an effective size of 5349 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5349 effective characters (7351 raw)`

### 🔵 Agent definition effective size is 6505 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/architect.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/architect.md has an effective size of 6505 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6505 effective characters (7284 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/build-error-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/build-error-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/build-error-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/build-error-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent definition effective size is 5191 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/chief-of-staff.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/chief-of-staff.md has an effective size of 5191 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5191 effective characters (6566 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/code-architect.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/code-architect.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/code-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/code-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 11265 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/code-reviewer.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/code-reviewer.md has an effective size of 11265 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `11265 effective characters (13787 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/cpp-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/cpp-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/cpp-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/cpp-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/cpp-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/cpp-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/csharp-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/csharp-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 5242 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/csharp-reviewer.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/csharp-reviewer.md has an effective size of 5242 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5242 effective characters (5652 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/dart-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/dart-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/dart-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/dart-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/database-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/database-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/database-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/database-reviewer.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/django-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/django-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/django-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/django-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/django-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/django-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 6943 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/django-reviewer.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/django-reviewer.md has an effective size of 6943 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6943 effective characters (7967 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/doc-updater.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/doc-updater.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/doc-updater.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/doc-updater.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/e2e-runner.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/e2e-runner.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/e2e-runner.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/e2e-runner.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/fastapi-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/fastapi-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/flutter-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/flutter-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 14220 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/flutter-reviewer.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/flutter-reviewer.md has an effective size of 14220 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `14220 effective characters (15033 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/fsharp-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/fsharp-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 5218 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/fsharp-reviewer.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/fsharp-reviewer.md has an effective size of 5218 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5218 effective characters (5628 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/go-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/go-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/go-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/go-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/go-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/go-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/harmonyos-app-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/harmonyos-app-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/harmonyos-app-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/harmonyos-app-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent definition effective size is 8931 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/harmonyos-app-resolver.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/harmonyos-app-resolver.md has an effective size of 8931 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `8931 effective characters (9397 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/java-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/java-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/java-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/java-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/java-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/java-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 12262 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/java-reviewer.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/java-reviewer.md has an effective size of 12262 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `12262 effective characters (13267 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/kotlin-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/kotlin-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/kotlin-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/kotlin-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/kotlin-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/kotlin-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 6214 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/kotlin-reviewer.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/kotlin-reviewer.md has an effective size of 6214 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6214 effective characters (7605 raw)`

### 🔵 Agent definition effective size is 6588 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/marketing-agent.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/marketing-agent.md has an effective size of 6588 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6588 effective characters (7226 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/mle-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/mle-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 9551 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/mle-reviewer.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/mle-reviewer.md has an effective size of 9551 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `9551 effective characters (10263 raw)`

### 🔵 Agent definition effective size is 5088 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/opensource-packager.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/opensource-packager.md has an effective size of 5088 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5088 effective characters (7933 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/performance-optimizer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/performance-optimizer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/performance-optimizer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/performance-optimizer.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/pr-test-analyzer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/pr-test-analyzer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/python-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/python-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/pytorch-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/pytorch-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/pytorch-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/pytorch-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/react-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/react-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/react-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/react-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent definition effective size is 5900 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/react-build-resolver.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/react-build-resolver.md has an effective size of 5900 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5900 effective characters (11183 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/react-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/react-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 9749 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/react-reviewer.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/react-reviewer.md has an effective size of 9749 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `9749 effective characters (11409 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/refactor-cleaner.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/refactor-cleaner.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/refactor-cleaner.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/refactor-cleaner.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/rust-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/rust-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/rust-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/rust-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/rust-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/rust-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 5309 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/rust-reviewer.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/rust-reviewer.md has an effective size of 5309 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `5309 effective characters (5640 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/security-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/security-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/security-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/security-reviewer.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/silent-failure-hunter.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/silent-failure-hunter.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/swift-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/swift-build-resolver.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/swift-build-resolver.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/swift-build-resolver.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep, Glob + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/swift-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/swift-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 6915 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/swift-reviewer.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/swift-reviewer.md has an effective size of 6915 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `6915 effective characters (7335 raw)`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/tdd-guide.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/tdd-guide.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent has full escalation chain: plugins/marketplaces/ecc/agents/tdd-guide.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/tdd-guide.md`
- **Description:** This agent has discovery tools (Glob/Grep), Read, Write/Edit, AND Bash access. This forms a complete escalation chain: find files → read contents → modify code → execute commands. Consider whether it truly needs all four capabilities, or if it can be split into narrower roles.
- **Evidence:** `Discovery: Grep + Read + Write: Write, Edit + Bash`

### 🔵 Agent has Bash access: plugins/marketplaces/ecc/agents/typescript-reviewer.md

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/typescript-reviewer.md`
- **Description:** This agent has Bash tool access, allowing arbitrary command running. Consider if it truly needs shell access, or if Read/Write/Edit would suffice.

### 🔵 Agent definition effective size is 8465 characters (>5000 threshold)

- **Severity:** medium
- **Category:** agents
- **File:** `plugins/marketplaces/ecc/agents/typescript-reviewer.md`
- **Description:** The agent definition at plugins/marketplaces/ecc/agents/typescript-reviewer.md has an effective size of 8465 characters after discounting fenced code blocks and markdown tables. Unusually large agent definitions may contain hidden malicious instructions buried in legitimate-looking text. Review the full content carefully, especially any instructions near the end of the file.
- **Evidence:** `8465 effective characters (9034 raw)`

### 🔵 Template defines risky MCP server: filesystem

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. Filesystem MCP grants read/write access to the file system. Restrict to specific directories using allowedDirectories config.

### 🔵 Template defines risky MCP server: playwright

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. Browser automation MCP can navigate to arbitrary URLs and run JavaScript. Restrict to specific domains and disable script running where possible.

### 🔵 Template defines risky MCP server: browserbase

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. Browser automation MCP can navigate to arbitrary URLs and run JavaScript. Restrict to specific domains and disable script running where possible.

### 🔵 Template defines risky MCP server: browser-use

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. Browser automation MCP can navigate to arbitrary URLs and run JavaScript. Restrict to specific domains and disable script running where possible.

### 🔵 Template MCP server "vercel" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "vercel" uses URL transport connecting to "https://mcp.vercel.com". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://mcp.vercel.com`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "cloudflare-docs" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "cloudflare-docs" uses URL transport connecting to "https://docs.mcp.cloudflare.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://docs.mcp.cloudflare.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "cloudflare-workers-builds" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "cloudflare-workers-builds" uses URL transport connecting to "https://builds.mcp.cloudflare.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://builds.mcp.cloudflare.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "cloudflare-workers-bindings" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "cloudflare-workers-bindings" uses URL transport connecting to "https://bindings.mcp.cloudflare.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://bindings.mcp.cloudflare.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "cloudflare-observability" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "cloudflare-observability" uses URL transport connecting to "https://observability.mcp.cloudflare.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://observability.mcp.cloudflare.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "clickhouse" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "clickhouse" uses URL transport connecting to "https://mcp.clickhouse.cloud/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://mcp.clickhouse.cloud/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "browser-use" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "browser-use" uses URL transport connecting to "https://api.browser-use.com/mcp". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://api.browser-use.com/mcp`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 Template MCP server "laraplugins" connects to external URL

- **Severity:** medium
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "laraplugins" uses URL transport connecting to "https://laraplugins.io/mcp/plugins". External MCP connections send all tool calls and results over the network, potentially exposing code, secrets, and session data to a remote server. Prefer local stdio-based MCP servers.
- **Evidence:** `https://laraplugins.io/mcp/plugins`
- **Fix:** Use a local stdio-based MCP server instead

### 🔵 No permissions block configured

- **Severity:** medium
- **Category:** permissions
- **File:** `plugins/marketplaces/ecc/.vscode/settings.json`
- **Description:** settings.json has configuration but no permissions section. Without explicit allow/deny lists, the agent relies on default permissions which may be too broad. Add a permissions block to restrict tool access.
- **Fix:** Add a permissions block with scoped allow and deny lists

### 🔵 No PreToolUse security hooks configured

- **Severity:** medium
- **Category:** misconfiguration
- **File:** `plugins/marketplaces/ecc/.vscode/settings.json`
- **Description:** No PreToolUse hooks are defined. These hooks can catch dangerous operations before they run, providing an essential security layer.
- **Fix:** Add PreToolUse hooks for security-sensitive operations

### 🔵 No permissions block configured

- **Severity:** medium
- **Category:** permissions
- **File:** `plugins/marketplaces/ecc/.zed/settings.json`
- **Description:** settings.json has configuration but no permissions section. Without explicit allow/deny lists, the agent relies on default permissions which may be too broad. Add a permissions block to restrict tool access.
- **Fix:** Add a permissions block with scoped allow and deny lists

### 🔵 No PreToolUse security hooks configured

- **Severity:** medium
- **Category:** misconfiguration
- **File:** `plugins/marketplaces/ecc/.zed/settings.json`
- **Description:** No PreToolUse hooks are defined. These hooks can catch dangerous operations before they run, providing an essential security layer.
- **Fix:** Add PreToolUse hooks for security-sensitive operations

### ⚪ No Stop hooks for session-end verification

- **Severity:** low
- **Category:** misconfiguration
- **File:** `settings.json`
- **Description:** Hooks are configured but no Stop hooks exist. Stop hooks run when a session ends and are useful for final verification — checking for uncommitted secrets, ensuring console.log statements were removed, or auditing file changes.
- **Fix:** Add a Stop hook for session-end checks

### ⚪ No Stop hooks for session-end verification

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** project-local optional
- **File:** `settings.local.json`
- **Description:** Hooks are configured but no Stop hooks exist. Stop hooks run when a session ends and are useful for final verification — checking for uncommitted secrets, ensuring console.log statements were removed, or auditing file changes.
- **Fix:** Add a Stop hook for session-end checks

### ⚪ Read-only agent uses expensive model "opus": agents/architect.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `agents/architect.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "opus" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": agents/code-explorer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `agents/code-explorer.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": agents/comment-analyzer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `agents/comment-analyzer.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": agents/conversation-analyzer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `agents/conversation-analyzer.md`
- **Description:** This agent only has read-only tools (Read, Grep) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "opus": agents/healthcare-reviewer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `agents/healthcare-reviewer.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "opus" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": agents/homelab-architect.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `agents/homelab-architect.md`
- **Description:** This agent only has read-only tools (Read, Grep) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": agents/network-architect.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `agents/network-architect.md`
- **Description:** This agent only has read-only tools (Read, Grep) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": agents/network-config-reviewer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `agents/network-config-reviewer.md`
- **Description:** This agent only has read-only tools (Read, Grep) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "opus": agents/planner.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `agents/planner.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "opus" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": agents/type-design-analyzer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `agents/type-design-analyzer.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Template MCP server "supabase" uses npx -y (auto-install)

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "supabase" uses "npx -y" which automatically installs packages without confirmation. A typosquatting or supply chain attack could run malicious code.
- **Fix:** Remove -y flag so npx prompts before installing, or install the package explicitly
- **Auto-fixable:** Yes

### ⚪ Template MCP server "filesystem" uses npx -y (auto-install)

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "filesystem" uses "npx -y" which automatically installs packages without confirmation. A typosquatting or supply chain attack could run malicious code.
- **Fix:** Remove -y flag so npx prompts before installing, or install the package explicitly
- **Auto-fixable:** Yes

### ⚪ Template MCP server "playwright" uses npx -y (auto-install)

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "playwright" uses "npx -y" which automatically installs packages without confirmation. A typosquatting or supply chain attack could run malicious code.
- **Fix:** Remove -y flag so npx prompts before installing, or install the package explicitly
- **Auto-fixable:** Yes

### ⚪ Template MCP server "github" uses unversioned package: @modelcontextprotocol/server-github

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "github" uses "@modelcontextprotocol/server-github" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @modelcontextprotocol/server-github`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "supabase" uses unversioned package: @supabase/mcp-server-supabase@latest

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "supabase" uses "@supabase/mcp-server-supabase@latest" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @supabase/mcp-server-supabase@latest`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "memory" uses unversioned package: @modelcontextprotocol/server-memory

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "memory" uses "@modelcontextprotocol/server-memory" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @modelcontextprotocol/server-memory`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "sequential-thinking" uses unversioned package: @modelcontextprotocol/server-sequential-thinking

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "sequential-thinking" uses "@modelcontextprotocol/server-sequential-thinking" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @modelcontextprotocol/server-sequential-thinking`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "railway" uses unversioned package: @railway/mcp-server

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "railway" uses "@railway/mcp-server" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @railway/mcp-server`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "context7" uses unversioned package: @upstash/context7-mcp@latest

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "context7" uses "@upstash/context7-mcp@latest" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @upstash/context7-mcp@latest`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "magic" uses unversioned package: @magicuidesign/mcp@latest

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "magic" uses "@magicuidesign/mcp@latest" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @magicuidesign/mcp@latest`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "filesystem" uses unversioned package: @modelcontextprotocol/server-filesystem

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "filesystem" uses "@modelcontextprotocol/server-filesystem" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @modelcontextprotocol/server-filesystem`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "playwright" uses unversioned package: @playwright/mcp

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "playwright" uses "@playwright/mcp" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @playwright/mcp`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "browserbase" uses unversioned package: @browserbasehq/mcp-server-browserbase

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "browserbase" uses "@browserbasehq/mcp-server-browserbase" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @browserbasehq/mcp-server-browserbase`
- **Fix:** Pin to a specific version

### ⚪ Template MCP config: 29 MCP servers configured — large attack surface

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. This configuration has 29 MCP servers. Each server expands the attack surface through supply chain risk, environment variable exposure, and additional capabilities granted to the agent. Consider removing servers that are not actively needed.

### ⚪ Template MCP server "supabase" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "supabase" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "supabase" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "memory" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "memory" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "memory" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "omega-memory" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "omega-memory" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "omega-memory" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "longhand" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "longhand" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "longhand" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "sequential-thinking" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "sequential-thinking" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "sequential-thinking" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "railway" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "railway" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "railway" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "context7" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "context7" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "context7" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "magic" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "magic" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "magic" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "filesystem" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "filesystem" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "filesystem" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "playwright" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "playwright" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "playwright" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "token-optimizer" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "token-optimizer" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "token-optimizer" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "squish" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "squish" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "squish" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template high-risk MCP server "filesystem" has no timeout

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "filesystem" (npx) has no timeout configuration. Without a timeout, a malfunctioning or compromised server could hang indefinitely, consuming resources and blocking the agent. Add a timeout to limit execution time.
- **Evidence:** `Server "filesystem" has no timeout, requestTimeout, or connectionTimeout`
- **Fix:** Add a timeout configuration

### ⚪ Template high-risk MCP server "playwright" has no timeout

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "playwright" (npx) has no timeout configuration. Without a timeout, a malfunctioning or compromised server could hang indefinitely, consuming resources and blocking the agent. Add a timeout to limit execution time.
- **Evidence:** `Server "playwright" has no timeout, requestTimeout, or connectionTimeout`
- **Fix:** Add a timeout configuration

### ⚪ Template high-risk MCP server "browserbase" has no timeout

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "browserbase" (npx) has no timeout configuration. Without a timeout, a malfunctioning or compromised server could hang indefinitely, consuming resources and blocking the agent. Add a timeout to limit execution time.
- **Evidence:** `Server "browserbase" has no timeout, requestTimeout, or connectionTimeout`
- **Fix:** Add a timeout configuration

### ⚪ Template high-risk MCP server "browser-use" has no timeout

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** template/example
- **File:** `mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "browser-use" (unknown command) has no timeout configuration. Without a timeout, a malfunctioning or compromised server could hang indefinitely, consuming resources and blocking the agent. Add a timeout to limit execution time.
- **Evidence:** `Server "browser-use" has no timeout, requestTimeout, or connectionTimeout`
- **Fix:** Add a timeout configuration

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/aside.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "aside" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/aside.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "aside" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/auto-update.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "auto-update" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/auto-update.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "auto-update" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/build-fix.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "build-fix" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/build-fix.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "build-fix" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/checkpoint.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "checkpoint" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/checkpoint.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "checkpoint" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/code-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "code-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/code-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "code-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/cost-report.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cost-report" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/cost-report.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cost-report" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/cpp-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/cpp-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/cpp-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/cpp-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/cpp-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/cpp-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/ecc-guide.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "ecc-guide" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/ecc-guide.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "ecc-guide" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/evolve.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "evolve" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/evolve.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "evolve" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/fastapi-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "fastapi-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/fastapi-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "fastapi-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/feature-dev.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-dev" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/feature-dev.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-dev" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/flutter-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/flutter-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/flutter-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/flutter-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/flutter-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/flutter-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/gan-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gan-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/gan-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gan-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/gan-design.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gan-design" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/gan-design.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gan-design" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/go-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/go-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/go-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/go-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/go-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/go-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/gradle-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gradle-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/gradle-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gradle-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/harness-audit.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "harness-audit" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/harness-audit.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "harness-audit" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/hookify-configure.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-configure" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/hookify-configure.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-configure" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/hookify-help.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-help" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/hookify-help.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-help" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/hookify-list.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-list" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/hookify-list.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-list" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/hookify.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/hookify.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/instinct-export.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-export" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/instinct-export.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-export" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/instinct-import.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-import" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/instinct-import.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-import" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/instinct-status.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-status" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/instinct-status.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-status" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/jira.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "jira" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/jira.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "jira" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/kotlin-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/kotlin-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/kotlin-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/kotlin-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/kotlin-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/kotlin-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/learn-eval.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "learn-eval" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/learn-eval.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "learn-eval" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/learn.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "learn" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/learn.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "learn" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/loop-start.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "loop-start" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/loop-start.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "loop-start" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/loop-status.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "loop-status" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/loop-status.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "loop-status" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/marketing-campaign.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "marketing-campaign" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/marketing-campaign.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "marketing-campaign" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/model-route.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "model-route" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/model-route.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "model-route" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/multi-backend.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-backend" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/multi-backend.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-backend" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/multi-execute.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-execute" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/multi-execute.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-execute" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/multi-frontend.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-frontend" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/multi-frontend.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-frontend" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/multi-plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-plan" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/multi-plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-plan" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/multi-workflow.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-workflow" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/multi-workflow.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-workflow" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/plan-prd.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "plan-prd" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/plan-prd.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "plan-prd" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "plan" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "plan" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/pm2.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "pm2" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/pm2.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "pm2" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "pr" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "pr" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/project-init.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "project-init" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/project-init.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "project-init" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/projects.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "projects" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/projects.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "projects" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/promote.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "promote" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/promote.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "promote" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/prp-commit.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-commit" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/prp-commit.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-commit" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/prp-implement.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-implement" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/prp-implement.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-implement" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/prp-plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-plan" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/prp-plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-plan" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/prp-pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-pr" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/prp-pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-pr" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/prp-prd.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-prd" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/prp-prd.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-prd" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/prune.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prune" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/prune.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prune" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/python-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "python-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/python-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "python-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/quality-gate.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "quality-gate" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/quality-gate.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "quality-gate" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/react-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/react-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/react-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/react-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/react-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/react-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/refactor-clean.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "refactor-clean" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/refactor-clean.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "refactor-clean" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/resume-session.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "resume-session" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/resume-session.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "resume-session" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/review-pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "review-pr" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/review-pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "review-pr" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/rust-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/rust-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/rust-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/rust-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/rust-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/rust-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/santa-loop.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "santa-loop" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/santa-loop.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "santa-loop" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/save-session.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "save-session" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/save-session.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "save-session" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/security-scan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "security-scan" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/security-scan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "security-scan" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/sessions.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "sessions" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/sessions.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "sessions" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/setup-pm.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "setup-pm" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/setup-pm.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "setup-pm" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/skill-create.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "skill-create" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/skill-create.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "skill-create" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/skill-health.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "skill-health" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/skill-health.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "skill-health" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/test-coverage.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "test-coverage" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/test-coverage.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "test-coverage" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/update-codemaps.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "update-codemaps" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/update-codemaps.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "update-codemaps" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/update-docs.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "update-docs" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `commands/update-docs.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "update-docs" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ No Stop hooks for session-end verification

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/cache/claude-plugins-official/superpowers/5.1.0/hooks/hooks-cursor.json`
- **Description:** Hooks are configured but no Stop hooks exist. Stop hooks run when a session ends and are useful for final verification — checking for uncommitted secrets, ensuring console.log statements were removed, or auditing file changes.
- **Fix:** Add a Stop hook for session-end checks

### ⚪ Plugin hook manifest: No Stop hooks for session-end verification

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** plugin manifest
- **File:** `plugins/cache/claude-plugins-official/superpowers/5.1.0/hooks/hooks.json`
- **Description:** This finding comes from a declarative hook manifest. Review the referenced hook implementation to confirm the exact runtime behavior. Hooks are configured but no Stop hooks exist. Stop hooks run when a session ends and are useful for final verification — checking for uncommitted secrets, ensuring console.log statements were removed, or auditing file changes.
- **Fix:** Add a Stop hook for session-end checks

### ⚪ No Stop hooks for session-end verification

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/cache/claude-plugins-official/superpowers/f2cbfbefebbf/hooks/hooks-cursor.json`
- **Description:** Hooks are configured but no Stop hooks exist. Stop hooks run when a session ends and are useful for final verification — checking for uncommitted secrets, ensuring console.log statements were removed, or auditing file changes.
- **Fix:** Add a Stop hook for session-end checks

### ⚪ Plugin hook manifest: No Stop hooks for session-end verification

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** plugin manifest
- **File:** `plugins/cache/claude-plugins-official/superpowers/f2cbfbefebbf/hooks/hooks.json`
- **Description:** This finding comes from a declarative hook manifest. Review the referenced hook implementation to confirm the exact runtime behavior. Hooks are configured but no Stop hooks exist. Stop hooks run when a session ends and are useful for final verification — checking for uncommitted secrets, ensuring console.log statements were removed, or auditing file changes.
- **Fix:** Add a Stop hook for session-end checks

### ⚪ Read-only agent uses expensive model "opus": plugins/cache/ecc/ecc/2.0.0-rc.1/agents/architect.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/architect.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "opus" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": plugins/cache/ecc/ecc/2.0.0-rc.1/agents/code-explorer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/code-explorer.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": plugins/cache/ecc/ecc/2.0.0-rc.1/agents/comment-analyzer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/comment-analyzer.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": plugins/cache/ecc/ecc/2.0.0-rc.1/agents/conversation-analyzer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/conversation-analyzer.md`
- **Description:** This agent only has read-only tools (Read, Grep) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "opus": plugins/cache/ecc/ecc/2.0.0-rc.1/agents/healthcare-reviewer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/healthcare-reviewer.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "opus" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": plugins/cache/ecc/ecc/2.0.0-rc.1/agents/homelab-architect.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/homelab-architect.md`
- **Description:** This agent only has read-only tools (Read, Grep) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": plugins/cache/ecc/ecc/2.0.0-rc.1/agents/network-architect.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/network-architect.md`
- **Description:** This agent only has read-only tools (Read, Grep) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": plugins/cache/ecc/ecc/2.0.0-rc.1/agents/network-config-reviewer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/network-config-reviewer.md`
- **Description:** This agent only has read-only tools (Read, Grep) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "opus": plugins/cache/ecc/ecc/2.0.0-rc.1/agents/planner.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/planner.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "opus" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": plugins/cache/ecc/ecc/2.0.0-rc.1/agents/type-design-analyzer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/agents/type-design-analyzer.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Template MCP server "supabase" uses npx -y (auto-install)

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "supabase" uses "npx -y" which automatically installs packages without confirmation. A typosquatting or supply chain attack could run malicious code.
- **Fix:** Remove -y flag so npx prompts before installing, or install the package explicitly
- **Auto-fixable:** Yes

### ⚪ Template MCP server "filesystem" uses npx -y (auto-install)

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "filesystem" uses "npx -y" which automatically installs packages without confirmation. A typosquatting or supply chain attack could run malicious code.
- **Fix:** Remove -y flag so npx prompts before installing, or install the package explicitly
- **Auto-fixable:** Yes

### ⚪ Template MCP server "playwright" uses npx -y (auto-install)

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "playwright" uses "npx -y" which automatically installs packages without confirmation. A typosquatting or supply chain attack could run malicious code.
- **Fix:** Remove -y flag so npx prompts before installing, or install the package explicitly
- **Auto-fixable:** Yes

### ⚪ Template MCP server "github" uses unversioned package: @modelcontextprotocol/server-github

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "github" uses "@modelcontextprotocol/server-github" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @modelcontextprotocol/server-github`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "supabase" uses unversioned package: @supabase/mcp-server-supabase@latest

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "supabase" uses "@supabase/mcp-server-supabase@latest" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @supabase/mcp-server-supabase@latest`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "memory" uses unversioned package: @modelcontextprotocol/server-memory

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "memory" uses "@modelcontextprotocol/server-memory" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @modelcontextprotocol/server-memory`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "sequential-thinking" uses unversioned package: @modelcontextprotocol/server-sequential-thinking

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "sequential-thinking" uses "@modelcontextprotocol/server-sequential-thinking" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @modelcontextprotocol/server-sequential-thinking`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "railway" uses unversioned package: @railway/mcp-server

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "railway" uses "@railway/mcp-server" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @railway/mcp-server`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "context7" uses unversioned package: @upstash/context7-mcp@latest

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "context7" uses "@upstash/context7-mcp@latest" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @upstash/context7-mcp@latest`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "magic" uses unversioned package: @magicuidesign/mcp@latest

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "magic" uses "@magicuidesign/mcp@latest" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @magicuidesign/mcp@latest`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "filesystem" uses unversioned package: @modelcontextprotocol/server-filesystem

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "filesystem" uses "@modelcontextprotocol/server-filesystem" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @modelcontextprotocol/server-filesystem`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "playwright" uses unversioned package: @playwright/mcp

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "playwright" uses "@playwright/mcp" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @playwright/mcp`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "browserbase" uses unversioned package: @browserbasehq/mcp-server-browserbase

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "browserbase" uses "@browserbasehq/mcp-server-browserbase" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @browserbasehq/mcp-server-browserbase`
- **Fix:** Pin to a specific version

### ⚪ Template MCP config: 29 MCP servers configured — large attack surface

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. This configuration has 29 MCP servers. Each server expands the attack surface through supply chain risk, environment variable exposure, and additional capabilities granted to the agent. Consider removing servers that are not actively needed.

### ⚪ Template MCP server "supabase" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "supabase" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "supabase" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "memory" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "memory" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "memory" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "omega-memory" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "omega-memory" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "omega-memory" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "longhand" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "longhand" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "longhand" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "sequential-thinking" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "sequential-thinking" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "sequential-thinking" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "railway" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "railway" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "railway" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "context7" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "context7" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "context7" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "magic" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "magic" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "magic" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "filesystem" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "filesystem" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "filesystem" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "playwright" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "playwright" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "playwright" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "token-optimizer" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "token-optimizer" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "token-optimizer" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "squish" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "squish" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "squish" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template high-risk MCP server "filesystem" has no timeout

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "filesystem" (npx) has no timeout configuration. Without a timeout, a malfunctioning or compromised server could hang indefinitely, consuming resources and blocking the agent. Add a timeout to limit execution time.
- **Evidence:** `Server "filesystem" has no timeout, requestTimeout, or connectionTimeout`
- **Fix:** Add a timeout configuration

### ⚪ Template high-risk MCP server "playwright" has no timeout

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "playwright" (npx) has no timeout configuration. Without a timeout, a malfunctioning or compromised server could hang indefinitely, consuming resources and blocking the agent. Add a timeout to limit execution time.
- **Evidence:** `Server "playwright" has no timeout, requestTimeout, or connectionTimeout`
- **Fix:** Add a timeout configuration

### ⚪ Template high-risk MCP server "browserbase" has no timeout

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "browserbase" (npx) has no timeout configuration. Without a timeout, a malfunctioning or compromised server could hang indefinitely, consuming resources and blocking the agent. Add a timeout to limit execution time.
- **Evidence:** `Server "browserbase" has no timeout, requestTimeout, or connectionTimeout`
- **Fix:** Add a timeout configuration

### ⚪ Template high-risk MCP server "browser-use" has no timeout

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** template/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "browser-use" (unknown command) has no timeout configuration. Without a timeout, a malfunctioning or compromised server could hang indefinitely, consuming resources and blocking the agent. Add a timeout to limit execution time.
- **Evidence:** `Server "browser-use" has no timeout, requestTimeout, or connectionTimeout`
- **Fix:** Add a timeout configuration

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/aside.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "aside" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/aside.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "aside" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/auto-update.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "auto-update" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/auto-update.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "auto-update" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/build-fix.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "build-fix" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/build-fix.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "build-fix" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/checkpoint.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "checkpoint" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/checkpoint.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "checkpoint" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/code-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "code-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/code-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "code-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/cost-report.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cost-report" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/cost-report.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cost-report" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/cpp-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/cpp-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/cpp-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/cpp-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/cpp-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/cpp-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/ecc-guide.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "ecc-guide" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/ecc-guide.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "ecc-guide" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/evolve.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "evolve" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/evolve.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "evolve" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/fastapi-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "fastapi-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/fastapi-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "fastapi-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/feature-dev.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-dev" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/feature-dev.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-dev" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/flutter-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/flutter-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/flutter-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/flutter-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/flutter-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/flutter-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/gan-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gan-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/gan-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gan-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/gan-design.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gan-design" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/gan-design.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gan-design" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/go-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/go-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/go-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/go-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/go-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/go-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/gradle-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gradle-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/gradle-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gradle-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/harness-audit.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "harness-audit" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/harness-audit.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "harness-audit" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/hookify-configure.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-configure" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/hookify-configure.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-configure" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/hookify-help.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-help" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/hookify-help.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-help" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/hookify-list.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-list" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/hookify-list.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-list" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/hookify.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/hookify.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/instinct-export.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-export" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/instinct-export.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-export" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/instinct-import.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-import" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/instinct-import.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-import" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/instinct-status.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-status" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/instinct-status.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-status" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/jira.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "jira" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/jira.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "jira" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/kotlin-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/kotlin-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/kotlin-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/kotlin-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/kotlin-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/kotlin-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/learn-eval.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "learn-eval" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/learn-eval.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "learn-eval" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/learn.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "learn" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/learn.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "learn" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/loop-start.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "loop-start" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/loop-start.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "loop-start" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/loop-status.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "loop-status" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/loop-status.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "loop-status" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/marketing-campaign.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "marketing-campaign" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/marketing-campaign.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "marketing-campaign" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/model-route.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "model-route" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/model-route.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "model-route" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/multi-backend.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-backend" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/multi-backend.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-backend" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/multi-execute.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-execute" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/multi-execute.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-execute" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/multi-frontend.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-frontend" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/multi-frontend.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-frontend" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/multi-plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-plan" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/multi-plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-plan" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/multi-workflow.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-workflow" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/multi-workflow.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-workflow" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/plan-prd.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "plan-prd" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/plan-prd.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "plan-prd" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "plan" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "plan" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/pm2.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "pm2" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/pm2.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "pm2" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "pr" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "pr" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/project-init.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "project-init" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/project-init.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "project-init" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/projects.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "projects" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/projects.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "projects" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/promote.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "promote" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/promote.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "promote" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/prp-commit.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-commit" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/prp-commit.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-commit" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/prp-implement.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-implement" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/prp-implement.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-implement" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/prp-plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-plan" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/prp-plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-plan" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/prp-pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-pr" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/prp-pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-pr" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/prp-prd.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-prd" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/prp-prd.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-prd" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/prune.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prune" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/prune.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prune" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/python-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "python-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/python-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "python-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/quality-gate.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "quality-gate" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/quality-gate.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "quality-gate" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/react-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/react-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/react-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/react-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/react-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/react-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/refactor-clean.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "refactor-clean" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/refactor-clean.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "refactor-clean" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/resume-session.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "resume-session" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/resume-session.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "resume-session" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/review-pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "review-pr" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/review-pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "review-pr" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/rust-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/rust-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/rust-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/rust-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/rust-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/rust-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/santa-loop.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "santa-loop" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/santa-loop.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "santa-loop" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/save-session.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "save-session" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/save-session.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "save-session" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/security-scan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "security-scan" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/security-scan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "security-scan" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/sessions.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "sessions" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/sessions.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "sessions" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/setup-pm.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "setup-pm" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/setup-pm.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "setup-pm" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/skill-create.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "skill-create" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/skill-create.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "skill-create" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/skill-health.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "skill-health" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/skill-health.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "skill-health" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/test-coverage.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "test-coverage" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/test-coverage.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "test-coverage" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/update-codemaps.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "update-codemaps" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/update-codemaps.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "update-codemaps" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/update-docs.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "update-docs" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/commands/update-docs.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "update-docs" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/.claude/commands/add-language-rules.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "add-language-rules" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/.claude/commands/add-language-rules.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "add-language-rules" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/.claude/commands/database-migration.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "database-migration" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/.claude/commands/database-migration.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "database-migration" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/.claude/commands/feature-development.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-development" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/.claude/commands/feature-development.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-development" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011480750_ymw553/.claude/commands/add-language-rules.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "add-language-rules" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011480750_ymw553/.claude/commands/add-language-rules.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "add-language-rules" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011480750_ymw553/.claude/commands/database-migration.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "database-migration" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011480750_ymw553/.claude/commands/database-migration.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "database-migration" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011480750_ymw553/.claude/commands/feature-development.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-development" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011480750_ymw553/.claude/commands/feature-development.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-development" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011480834_yqyi5o/.claude/commands/add-language-rules.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "add-language-rules" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011480834_yqyi5o/.claude/commands/add-language-rules.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "add-language-rules" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011480834_yqyi5o/.claude/commands/database-migration.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "database-migration" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011480834_yqyi5o/.claude/commands/database-migration.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "database-migration" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011480834_yqyi5o/.claude/commands/feature-development.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-development" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011480834_yqyi5o/.claude/commands/feature-development.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-development" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011481083_o94pmv/.claude/commands/add-language-rules.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "add-language-rules" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011481083_o94pmv/.claude/commands/add-language-rules.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "add-language-rules" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011481083_o94pmv/.claude/commands/database-migration.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "database-migration" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011481083_o94pmv/.claude/commands/database-migration.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "database-migration" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011481083_o94pmv/.claude/commands/feature-development.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-development" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011481083_o94pmv/.claude/commands/feature-development.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-development" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011481166_jea6f5/.claude/commands/add-language-rules.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "add-language-rules" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011481166_jea6f5/.claude/commands/add-language-rules.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "add-language-rules" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011481166_jea6f5/.claude/commands/database-migration.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "database-migration" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011481166_jea6f5/.claude/commands/database-migration.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "database-migration" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011481166_jea6f5/.claude/commands/feature-development.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-development" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/cache/temp_local_1780011481166_jea6f5/.claude/commands/feature-development.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-development" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Read-only agent uses expensive model "opus": plugins/marketplaces/ecc/agents/architect.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/marketplaces/ecc/agents/architect.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "opus" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": plugins/marketplaces/ecc/agents/code-explorer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/marketplaces/ecc/agents/code-explorer.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": plugins/marketplaces/ecc/agents/comment-analyzer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/marketplaces/ecc/agents/comment-analyzer.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": plugins/marketplaces/ecc/agents/conversation-analyzer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/marketplaces/ecc/agents/conversation-analyzer.md`
- **Description:** This agent only has read-only tools (Read, Grep) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "opus": plugins/marketplaces/ecc/agents/healthcare-reviewer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/marketplaces/ecc/agents/healthcare-reviewer.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "opus" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": plugins/marketplaces/ecc/agents/homelab-architect.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/marketplaces/ecc/agents/homelab-architect.md`
- **Description:** This agent only has read-only tools (Read, Grep) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": plugins/marketplaces/ecc/agents/network-architect.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/marketplaces/ecc/agents/network-architect.md`
- **Description:** This agent only has read-only tools (Read, Grep) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": plugins/marketplaces/ecc/agents/network-config-reviewer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/marketplaces/ecc/agents/network-config-reviewer.md`
- **Description:** This agent only has read-only tools (Read, Grep) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "opus": plugins/marketplaces/ecc/agents/planner.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/marketplaces/ecc/agents/planner.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "opus" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Read-only agent uses expensive model "sonnet": plugins/marketplaces/ecc/agents/type-design-analyzer.md

- **Severity:** low
- **Category:** misconfiguration
- **File:** `plugins/marketplaces/ecc/agents/type-design-analyzer.md`
- **Description:** This agent only has read-only tools (Read, Grep, Glob) but uses the "sonnet" model. For simple file reading and searching, "haiku" is typically sufficient and significantly cheaper.
- **Fix:** Use haiku for read-only agents

### ⚪ Template MCP server "supabase" uses npx -y (auto-install)

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "supabase" uses "npx -y" which automatically installs packages without confirmation. A typosquatting or supply chain attack could run malicious code.
- **Fix:** Remove -y flag so npx prompts before installing, or install the package explicitly
- **Auto-fixable:** Yes

### ⚪ Template MCP server "filesystem" uses npx -y (auto-install)

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "filesystem" uses "npx -y" which automatically installs packages without confirmation. A typosquatting or supply chain attack could run malicious code.
- **Fix:** Remove -y flag so npx prompts before installing, or install the package explicitly
- **Auto-fixable:** Yes

### ⚪ Template MCP server "playwright" uses npx -y (auto-install)

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "playwright" uses "npx -y" which automatically installs packages without confirmation. A typosquatting or supply chain attack could run malicious code.
- **Fix:** Remove -y flag so npx prompts before installing, or install the package explicitly
- **Auto-fixable:** Yes

### ⚪ Template MCP server "github" uses unversioned package: @modelcontextprotocol/server-github

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "github" uses "@modelcontextprotocol/server-github" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @modelcontextprotocol/server-github`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "supabase" uses unversioned package: @supabase/mcp-server-supabase@latest

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "supabase" uses "@supabase/mcp-server-supabase@latest" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @supabase/mcp-server-supabase@latest`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "memory" uses unversioned package: @modelcontextprotocol/server-memory

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "memory" uses "@modelcontextprotocol/server-memory" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @modelcontextprotocol/server-memory`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "sequential-thinking" uses unversioned package: @modelcontextprotocol/server-sequential-thinking

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "sequential-thinking" uses "@modelcontextprotocol/server-sequential-thinking" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @modelcontextprotocol/server-sequential-thinking`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "railway" uses unversioned package: @railway/mcp-server

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "railway" uses "@railway/mcp-server" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @railway/mcp-server`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "context7" uses unversioned package: @upstash/context7-mcp@latest

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "context7" uses "@upstash/context7-mcp@latest" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @upstash/context7-mcp@latest`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "magic" uses unversioned package: @magicuidesign/mcp@latest

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "magic" uses "@magicuidesign/mcp@latest" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @magicuidesign/mcp@latest`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "filesystem" uses unversioned package: @modelcontextprotocol/server-filesystem

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "filesystem" uses "@modelcontextprotocol/server-filesystem" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @modelcontextprotocol/server-filesystem`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "playwright" uses unversioned package: @playwright/mcp

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "playwright" uses "@playwright/mcp" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @playwright/mcp`
- **Fix:** Pin to a specific version

### ⚪ Template MCP server "browserbase" uses unversioned package: @browserbasehq/mcp-server-browserbase

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "browserbase" uses "@browserbasehq/mcp-server-browserbase" without a pinned version. A compromised package update would run automatically via npx.
- **Evidence:** `command: npx, package: @browserbasehq/mcp-server-browserbase`
- **Fix:** Pin to a specific version

### ⚪ Template MCP config: 29 MCP servers configured — large attack surface

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. This configuration has 29 MCP servers. Each server expands the attack surface through supply chain risk, environment variable exposure, and additional capabilities granted to the agent. Consider removing servers that are not actively needed.

### ⚪ Template MCP server "supabase" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "supabase" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "supabase" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "memory" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "memory" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "memory" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "omega-memory" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "omega-memory" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "omega-memory" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "longhand" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "longhand" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "longhand" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "sequential-thinking" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "sequential-thinking" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "sequential-thinking" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "railway" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "railway" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "railway" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "context7" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "context7" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "context7" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "magic" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "magic" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "magic" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "filesystem" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "filesystem" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "filesystem" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "playwright" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "playwright" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "playwright" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "token-optimizer" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "token-optimizer" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "token-optimizer" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template MCP server "squish" inherits full parent environment

- **Severity:** low
- **Category:** mcp
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "squish" has no explicit "env" block, so it inherits the full parent process environment. This means every environment variable — including API keys, tokens, and secrets — is passed to the server. Add an explicit "env" block with only the variables the server needs.
- **Evidence:** `Server "squish" has command but no env block`
- **Fix:** Add an explicit env block with only required variables

### ⚪ Template high-risk MCP server "filesystem" has no timeout

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "filesystem" (npx) has no timeout configuration. Without a timeout, a malfunctioning or compromised server could hang indefinitely, consuming resources and blocking the agent. Add a timeout to limit execution time.
- **Evidence:** `Server "filesystem" has no timeout, requestTimeout, or connectionTimeout`
- **Fix:** Add a timeout configuration

### ⚪ Template high-risk MCP server "playwright" has no timeout

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "playwright" (npx) has no timeout configuration. Without a timeout, a malfunctioning or compromised server could hang indefinitely, consuming resources and blocking the agent. Add a timeout to limit execution time.
- **Evidence:** `Server "playwright" has no timeout, requestTimeout, or connectionTimeout`
- **Fix:** Add a timeout configuration

### ⚪ Template high-risk MCP server "browserbase" has no timeout

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "browserbase" (npx) has no timeout configuration. Without a timeout, a malfunctioning or compromised server could hang indefinitely, consuming resources and blocking the agent. Add a timeout to limit execution time.
- **Evidence:** `Server "browserbase" has no timeout, requestTimeout, or connectionTimeout`
- **Fix:** Add a timeout configuration

### ⚪ Template high-risk MCP server "browser-use" has no timeout

- **Severity:** low
- **Category:** misconfiguration
- **Runtime Confidence:** template/example
- **File:** `plugins/marketplaces/ecc/mcp-configs/mcp-servers.json`
- **Description:** This finding comes from an MCP template or example inventory, not a confirmed active runtime MCP configuration. The MCP server "browser-use" (unknown command) has no timeout configuration. Without a timeout, a malfunctioning or compromised server could hang indefinitely, consuming resources and blocking the agent. Add a timeout to limit execution time.
- **Evidence:** `Server "browser-use" has no timeout, requestTimeout, or connectionTimeout`
- **Fix:** Add a timeout configuration

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/aside.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "aside" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/aside.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "aside" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/auto-update.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "auto-update" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/auto-update.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "auto-update" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/build-fix.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "build-fix" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/build-fix.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "build-fix" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/checkpoint.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "checkpoint" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/checkpoint.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "checkpoint" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/code-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "code-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/code-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "code-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/cost-report.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cost-report" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/cost-report.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cost-report" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/cpp-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/cpp-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/cpp-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/cpp-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/cpp-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/cpp-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "cpp-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/ecc-guide.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "ecc-guide" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/ecc-guide.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "ecc-guide" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/evolve.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "evolve" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/evolve.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "evolve" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/fastapi-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "fastapi-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/fastapi-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "fastapi-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/feature-dev.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-dev" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/feature-dev.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-dev" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/flutter-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/flutter-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/flutter-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/flutter-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/flutter-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/flutter-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "flutter-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/gan-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gan-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/gan-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gan-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/gan-design.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gan-design" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/gan-design.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gan-design" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/go-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/go-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/go-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/go-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/go-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/go-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "go-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/gradle-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gradle-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/gradle-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "gradle-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/harness-audit.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "harness-audit" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/harness-audit.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "harness-audit" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/hookify-configure.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-configure" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/hookify-configure.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-configure" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/hookify-help.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-help" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/hookify-help.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-help" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/hookify-list.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-list" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/hookify-list.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify-list" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/hookify.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/hookify.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "hookify" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/instinct-export.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-export" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/instinct-export.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-export" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/instinct-import.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-import" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/instinct-import.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-import" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/instinct-status.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-status" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/instinct-status.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "instinct-status" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/jira.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "jira" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/jira.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "jira" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/kotlin-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/kotlin-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/kotlin-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/kotlin-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/kotlin-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/kotlin-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "kotlin-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/learn-eval.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "learn-eval" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/learn-eval.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "learn-eval" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/learn.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "learn" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/learn.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "learn" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/loop-start.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "loop-start" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/loop-start.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "loop-start" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/loop-status.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "loop-status" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/loop-status.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "loop-status" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/marketing-campaign.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "marketing-campaign" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/marketing-campaign.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "marketing-campaign" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/model-route.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "model-route" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/model-route.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "model-route" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/multi-backend.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-backend" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/multi-backend.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-backend" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/multi-execute.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-execute" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/multi-execute.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-execute" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/multi-frontend.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-frontend" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/multi-frontend.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-frontend" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/multi-plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-plan" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/multi-plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-plan" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/multi-workflow.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-workflow" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/multi-workflow.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "multi-workflow" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/plan-prd.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "plan-prd" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/plan-prd.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "plan-prd" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "plan" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "plan" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/pm2.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "pm2" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/pm2.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "pm2" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "pr" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "pr" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/project-init.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "project-init" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/project-init.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "project-init" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/projects.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "projects" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/projects.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "projects" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/promote.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "promote" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/promote.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "promote" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/prp-commit.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-commit" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/prp-commit.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-commit" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/prp-implement.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-implement" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/prp-implement.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-implement" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/prp-plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-plan" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/prp-plan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-plan" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/prp-pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-pr" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/prp-pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-pr" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/prp-prd.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-prd" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/prp-prd.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prp-prd" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/prune.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prune" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/prune.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "prune" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/python-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "python-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/python-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "python-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/quality-gate.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "quality-gate" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/quality-gate.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "quality-gate" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/react-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/react-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/react-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/react-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/react-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/react-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "react-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/refactor-clean.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "refactor-clean" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/refactor-clean.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "refactor-clean" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/resume-session.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "resume-session" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/resume-session.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "resume-session" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/review-pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "review-pr" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/review-pr.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "review-pr" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/rust-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-build" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/rust-build.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-build" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/rust-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-review" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/rust-review.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-review" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/rust-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-test" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/rust-test.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "rust-test" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/santa-loop.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "santa-loop" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/santa-loop.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "santa-loop" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/save-session.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "save-session" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/save-session.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "save-session" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/security-scan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "security-scan" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/security-scan.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "security-scan" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/sessions.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "sessions" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/sessions.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "sessions" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/setup-pm.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "setup-pm" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/setup-pm.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "setup-pm" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/skill-create.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "skill-create" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/skill-create.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "skill-create" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/skill-health.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "skill-health" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/skill-health.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "skill-health" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/test-coverage.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "test-coverage" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/test-coverage.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "test-coverage" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/update-codemaps.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "update-codemaps" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/update-codemaps.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "update-codemaps" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/update-docs.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "update-docs" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/commands/update-docs.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "update-docs" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/.claude/commands/add-language-rules.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "add-language-rules" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/.claude/commands/add-language-rules.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "add-language-rules" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/.claude/commands/database-migration.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "database-migration" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/.claude/commands/database-migration.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "database-migration" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Example config: Skill is missing observation hooks and feedback hooks

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/.claude/commands/feature-development.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-development" does not define observation hooks and feedback hooks in SKILL.md. ECC 2.0 self-improving skills need explicit observe/feedback hooks so runs can be inspected and amended safely.
- **Evidence:** `observation hooks and feedback hooks`

### ⚪ Example config: Skill is missing version metadata and rollback metadata

- **Severity:** low
- **Category:** skills
- **Runtime Confidence:** docs/example
- **File:** `plugins/marketplaces/ecc/.claude/commands/feature-development.md`
- **Description:** This finding comes from docs or sample configuration in the repository. It indicates risky guidance or example defaults, not confirmed active runtime exposure. The skill "feature-development" does not define version metadata and rollback metadata. Self-amending skills need explicit version and rollback markers so regressions can be evaluated and reversed.
- **Evidence:** `version metadata and rollback metadata`

### ⚪ Prohibition of dangerously-skip-permissions (good practice)

- **Severity:** info
- **Category:** permissions
- **File:** `CLAUDE.md:12`
- **Description:** Found "dangerously-skip-permissions" in a negated/prohibitive context. This is correct — the config is telling the agent NOT to use this flag.
- **Evidence:** `dangerously-skip-permissions`

### ⚪ Prohibition of --no-verify (good practice)

- **Severity:** info
- **Category:** permissions
- **File:** `CLAUDE.md:12`
- **Description:** Found "--no-verify" in a negated/prohibitive context. This is correct — the config is telling the agent NOT to use this flag.
- **Evidence:** `--no-verify`

### ⚪ Hook code injects content into Claude context

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `scripts/hooks/suggest-compact.js:92`
- **Description:** This non-shell hook implementation calls an output helper that writes content back into Claude context. That is often legitimate, but it should be reviewed because untrusted summaries or derived data can become prompt-injection surface.
- **Evidence:** `output({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: msg } });`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `scripts/hooks/gateguard-fact-force.js:469`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `const transcriptPath = (data && (data.transcript_path || data.transcriptPath)) || process.env.CLAUDE_TRANSCRIPT_PATH;`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `scripts/hooks/session-end.js:187`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `if (input && typeof input.transcript_path === 'string' && input.transcript_path.length > 0) {`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `scripts/hooks/evaluate-session.js:49`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `transcriptPath = input.transcript_path;`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `scripts/hooks/cost-tracker.js:143`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `const transcriptPath = (typeof input.transcript_path === 'string' && input.transcript_path)`

### ⚪ Hook code injects content into Claude context

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/scripts/hooks/suggest-compact.js:92`
- **Description:** This non-shell hook implementation calls an output helper that writes content back into Claude context. That is often legitimate, but it should be reviewed because untrusted summaries or derived data can become prompt-injection surface.
- **Evidence:** `output({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: msg } });`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/scripts/hooks/gateguard-fact-force.js:469`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `const transcriptPath = (data && (data.transcript_path || data.transcriptPath)) || process.env.CLAUDE_TRANSCRIPT_PATH;`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/scripts/hooks/session-end.js:187`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `if (input && typeof input.transcript_path === 'string' && input.transcript_path.length > 0) {`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/scripts/hooks/evaluate-session.js:49`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `transcriptPath = input.transcript_path;`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/ecc/ecc/2.0.0-rc.1/scripts/hooks/cost-tracker.js:143`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `const transcriptPath = (typeof input.transcript_path === 'string' && input.transcript_path)`

### ⚪ Hook code injects content into Claude context

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011480750_ymw553/scripts/hooks/suggest-compact.js:92`
- **Description:** This non-shell hook implementation calls an output helper that writes content back into Claude context. That is often legitimate, but it should be reviewed because untrusted summaries or derived data can become prompt-injection surface.
- **Evidence:** `output({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: msg } });`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011480750_ymw553/scripts/hooks/gateguard-fact-force.js:469`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `const transcriptPath = (data && (data.transcript_path || data.transcriptPath)) || process.env.CLAUDE_TRANSCRIPT_PATH;`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011480750_ymw553/scripts/hooks/session-end.js:187`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `if (input && typeof input.transcript_path === 'string' && input.transcript_path.length > 0) {`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011480750_ymw553/scripts/hooks/evaluate-session.js:49`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `transcriptPath = input.transcript_path;`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011480750_ymw553/scripts/hooks/cost-tracker.js:143`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `const transcriptPath = (typeof input.transcript_path === 'string' && input.transcript_path)`

### ⚪ Hook code injects content into Claude context

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011480834_yqyi5o/scripts/hooks/suggest-compact.js:92`
- **Description:** This non-shell hook implementation calls an output helper that writes content back into Claude context. That is often legitimate, but it should be reviewed because untrusted summaries or derived data can become prompt-injection surface.
- **Evidence:** `output({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: msg } });`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011480834_yqyi5o/scripts/hooks/gateguard-fact-force.js:469`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `const transcriptPath = (data && (data.transcript_path || data.transcriptPath)) || process.env.CLAUDE_TRANSCRIPT_PATH;`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011480834_yqyi5o/scripts/hooks/session-end.js:187`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `if (input && typeof input.transcript_path === 'string' && input.transcript_path.length > 0) {`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011480834_yqyi5o/scripts/hooks/evaluate-session.js:49`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `transcriptPath = input.transcript_path;`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011480834_yqyi5o/scripts/hooks/cost-tracker.js:143`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `const transcriptPath = (typeof input.transcript_path === 'string' && input.transcript_path)`

### ⚪ Hook code injects content into Claude context

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011481083_o94pmv/scripts/hooks/suggest-compact.js:92`
- **Description:** This non-shell hook implementation calls an output helper that writes content back into Claude context. That is often legitimate, but it should be reviewed because untrusted summaries or derived data can become prompt-injection surface.
- **Evidence:** `output({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: msg } });`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011481083_o94pmv/scripts/hooks/gateguard-fact-force.js:469`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `const transcriptPath = (data && (data.transcript_path || data.transcriptPath)) || process.env.CLAUDE_TRANSCRIPT_PATH;`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011481083_o94pmv/scripts/hooks/session-end.js:187`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `if (input && typeof input.transcript_path === 'string' && input.transcript_path.length > 0) {`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011481083_o94pmv/scripts/hooks/evaluate-session.js:49`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `transcriptPath = input.transcript_path;`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011481083_o94pmv/scripts/hooks/cost-tracker.js:143`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `const transcriptPath = (typeof input.transcript_path === 'string' && input.transcript_path)`

### ⚪ Hook code injects content into Claude context

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011481166_jea6f5/scripts/hooks/suggest-compact.js:92`
- **Description:** This non-shell hook implementation calls an output helper that writes content back into Claude context. That is often legitimate, but it should be reviewed because untrusted summaries or derived data can become prompt-injection surface.
- **Evidence:** `output({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: msg } });`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011481166_jea6f5/scripts/hooks/gateguard-fact-force.js:469`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `const transcriptPath = (data && (data.transcript_path || data.transcriptPath)) || process.env.CLAUDE_TRANSCRIPT_PATH;`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011481166_jea6f5/scripts/hooks/session-end.js:187`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `if (input && typeof input.transcript_path === 'string' && input.transcript_path.length > 0) {`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011481166_jea6f5/scripts/hooks/evaluate-session.js:49`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `transcriptPath = input.transcript_path;`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/cache/temp_local_1780011481166_jea6f5/scripts/hooks/cost-tracker.js:143`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `const transcriptPath = (typeof input.transcript_path === 'string' && input.transcript_path)`

### ⚪ Hook code injects content into Claude context

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/marketplaces/ecc/scripts/hooks/suggest-compact.js:92`
- **Description:** This non-shell hook implementation calls an output helper that writes content back into Claude context. That is often legitimate, but it should be reviewed because untrusted summaries or derived data can become prompt-injection surface.
- **Evidence:** `output({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: msg } });`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/marketplaces/ecc/scripts/hooks/gateguard-fact-force.js:469`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `const transcriptPath = (data && (data.transcript_path || data.transcriptPath)) || process.env.CLAUDE_TRANSCRIPT_PATH;`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/marketplaces/ecc/scripts/hooks/session-end.js:187`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `if (input && typeof input.transcript_path === 'string' && input.transcript_path.length > 0) {`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/marketplaces/ecc/scripts/hooks/evaluate-session.js:49`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `transcriptPath = input.transcript_path;`

### ⚪ Hook code reads Claude transcript input

- **Severity:** info
- **Category:** hooks
- **Runtime Confidence:** hook-code implementation
- **File:** `plugins/marketplaces/ecc/scripts/hooks/cost-tracker.js:143`
- **Description:** This non-shell hook implementation reads transcript-derived input (`transcript_path` or `CLAUDE_TRANSCRIPT_PATH`). That is common for Stop and SessionEnd hooks, but it should be reviewed because downstream logic can process sensitive prompt and tool history.
- **Evidence:** `const transcriptPath = (typeof input.transcript_path === 'string' && input.transcript_path)`

