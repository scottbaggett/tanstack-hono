P0_CHARTER.md (v1.3 - 2025-11-04)

## 1. The Mission
Enable domain experts and their teams to visually design, execute, and debug complex AI-augmented workflows—with first-class traceability, safe extensibility, and provider-agnostic model/tool integration—so they can move from idea to validated result in hours, not weeks.

## 2. The Core Problem
Building, iterating on, and managing complex, automated workflows – especially those integrating custom logic, external APIs, and increasingly powerful AI models or agentic patterns – is fragmented and high-friction. Furthermore, previous attempts often resulted in opaque "black box" systems lacking essential traceability and making debugging incredibly difficult. Previous tools often forced developers into silos: either traditional automation or opaque AI systems, rarely providing a unified platform with deep observability across both. This platform bridges that gap.

## Core Principles
**Intuitive User Experience & Clarity is P0:** The platform MUST be accessible and transparent for domain experts. Visual design, clear data flow representation, and understandable configuration are paramount. While powerful, complexity must be progressively disclosed. ✨

**Extreme Observability & Traceability (Dealbreaker):** The platform must NEVER be a "black box." Every single step MUST be traceable. Users MUST be able to easily understand what happened, why a decision was made (e.g., branching), and where data came from, enabling trust and efficient debugging. 🕵️‍♀️

**Seamless Integration & Extensibility:** The platform must easily connect diverse tools (APIs, databases, code) and AI models. It should empower domain experts directly while also providing clear extension points for developers to add custom nodes or logic.

**Modularity & Composability:** Workflows are built from reusable, understandable blocks (nodes). The platform encourages building modular components that can be shared and combined.

**Uncompromising Fidelity:** The platform must faithfully execute the underlying tools and models according to the user's configuration, including real-time streaming where applicable.

**Provider Agnostic:** The system supports a wide range of AI models and external services, allowing users to choose the best tools for their specific task.

**Safety & Validation:** Input data and configurations should be validated where possible. Execution of custom code must occur in secure environments.

**Evolvability:** The platform must support iterative refinement of workflows.

### 3.5 Critical Foundations & Dealbreakers
Beyond the core principles, the following aspects are considered foundational and non-negotiable. Failure to meet these standards constitutes a critical failure of the platform's mission:

**End-to-End Traceability: **A user MUST be able to follow the entire process – from input, through every node (inputs/outputs/errors), to the final result – via clear logs and visual indicators. Lack of traceability is a dealbreaker.

**Debuggability:** When a workflow fails or gives unexpected results, the platform MUST provide sufficient information (clear error messages, node status, data previews) for a domain expert to understand the likely source of the problem, potentially collaborating with a developer for deeper issues. Opaque errors are a dealbreaker.

**Discoverability & Intuitiveness:** Features, data connections, node functions, and configuration MUST be easily discoverable through the UI. The platform should feel intuitive for someone familiar with their domain's processes, minimizing reliance on deep technical documentation for core usage.

**Agent Loop Transparency:** For AI agent nodes, users MUST be able to see each tool call the agent planned, the tool execution results, the iteration count and halting reason, and the agent's reasoning at each step. Opaque agent "black boxes" are a dealbreaker.

## Non-Goals
- NOT a consumer facing platform.
- NOT just a simple task runner or ETL tool.
- NOT exclusively for building autonomous AI agents (though it provides first-class support with full traceability and control).
- NOT exclusively for software developers (it must empower domain experts directly).
- NOT a replacement for underlying tools like LangChain/LangGraph (it orchestrates them).
- NOT hosting user infra (no cluster provisioning).
- Not a full BI/analytics suite.
- Not a managed DB; we integrate with your DBs/KBs via connectors.
- Not an agent marketplace (P0).

## 📈 Key Success Metrics
### Design & Usability
Time-to-Workflow (Domain Expert): A domain expert (with minimal training) can build and successfully run a standard 5-node workflow relevant to their field (e.g., fetching data, basic processing, AI analysis, output) in < 30 minutes.

Discoverability Task: A domain expert can locate and correctly configure a specific node (e.g., PDB Fetcher, Basic Filtering) needed for their task in < 5 minutes using the UI search/browsing.

Time-to-Understand (TTU): A domain expert can explain the purpose and data flow of a pre-built 5-node workflow by inspecting it in the UI in < 10 minutes.

### Execution & Debugging
**Traceability Task:** A domain expert can identify the origin and value of a specific data point in a workflow run history in < 3 minutes.

**Debugging Time (Domain Expert):** Reduce the time for a domain expert to identify which node caused a common error (e.g., incorrect input format, API key failure) to < 5 minutes using platform tools.

**Custom Node Velocity (Developer):** < 10 minutes for a developer (collaborating with the domain expert) to add and run a new custom BaseNode.

**Agent Traceability Task:** A domain expert can view every tool call an agent made, the inputs/outputs, and why it was called in < 2 minutes using run history.

**Agent Debugging Task:** When an agent loops unexpectedly or fails, a domain expert can identify the problematic tool call or max-iteration limit in < 5 minutes.

**Throughput: **Handle >100 concurrent workflow executions... (as before)

**Token Latency: <** 500ms (p95)... (as before)

## System-Wide
**Adoption Proxy (Internal):** Internal domain expert teams demonstrate a >50% reduction in time spent on automatable workflow tasks compared to previous methods (manual or script-based) within 3 months post-launch.


## Definitions
- Workflow: A DAG of nodes with typed inputs/outputs, versioned definition, and immutable run history.
- Node: A reusable unit (tool/API/transform/agent) with a declarative schema (inputs, params, outputs).
- Run: A single workflow execution with deterministic runId and per-node runIndex.
- Traceability: The ability to reconstruct inputs, params, outputs, errors, and decisions for each node/run.
- Agent Node: A node that iteratively plans and executes tools via LangGraph, returning either EngineRequest (for tool execution) or final output.
- Tool Call: A single invocation of a registered tool (e.g., calculator, search) with validated inputs and enforced quotas.
- Agent Iteration: One cycle of agent planning → tool execution → agent resumption (limited by maxIterations).
