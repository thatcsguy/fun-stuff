# Content spec: "AI Field Guide" single-page reader

Audience: Patrick, a professional software engineer who uses Claude Code agents daily (personal projects and at work). He has run multi-agent workflows, hit usage limits, seen memory and context quirks, written skills. He is NOT an ML researcher. He will read this on a phone, on a plane, in dark mode, with no internet. Medium depth: explain mechanisms, not just vocabulary, but no derivations or paper-level detail.

Voice: direct, concrete, second person where natural, no hype, no marketing. Short paragraphs (max 3 sentences). Plain words. Explain each term the first time. Prefer mechanism ("the harness appends the tool result as a user message and calls the model again") over abstraction. Use analogies sparingly and only when precise. Say "roughly" / "as of late 2026" when a fact is fuzzy or moving. No specific prices, no specific context-window sizes or benchmark scores (they go stale); say "hundreds of thousands of tokens" style if needed. Do not invent product features. When describing Claude Code specifics you are unsure about, describe the general pattern most harnesses share instead.

## Output format

One file per group: `content/gNN.html` (NN = two-digit group number). The file is an HTML FRAGMENT (no html/head/body), consisting of exactly this structure:

```html
<section class="group" id="g4" data-num="4">
  <header class="ghead">
    <h2><span class="gn">4</span>Agent harnesses</h2>
    <p class="glead">One or two sentences framing the group and why it matters to this reader.</p>
  </header>

  <article class="topic" id="t4-1" data-num="4.1">
    <h3><span class="tn">4.1</span>The core loop</h3>
    <p class="tl">One-sentence takeaway in bold-ish plain language (this is shown in the table of contents as the hook).</p>
    ... body ...
  </article>

  <article class="topic" id="t4-2" data-num="4.2"> ... </article>
</section>
```

Rules:
- Topic ids are `t<group>-<n>`, group ids `g<group>`. Use the exact numbering given to you.
- Body length per topic: 250 to 450 words. Group lead: under 50 words.
- Allowed elements in a body: `<p>`, `<ul>/<ol>/<li>`, `<strong>`, `<em>`, `<code>` (inline, short), `<pre><code>` (short, max ~12 lines, no line over 48 characters so it fits a phone), `<table>` (max 4 columns, short cells), and the callout blocks below. No images, no external links, no scripts, no inline styles, no headings inside a topic other than the h3.
- Callouts (use each at most once per topic, and only when it earns its place):
  - `<aside class="key"><p>...</p></aside>` : the one thing to remember. Use in most topics.
  - `<aside class="why"><p>...</p></aside>` : "why you see this" — tie the mechanism to something the reader experiences using Claude Code (a slow long session, a compaction message, a permission prompt, a subagent summary, a usage limit). Use when there is a genuine, concrete link.
  - `<aside class="try"><p class="tryl">Try it in Claude</p><pre class="prompt">...a prompt the reader can paste into Claude or Claude Code to go deeper or to observe the mechanism...</pre></aside>` : optional, at most one per topic, and only in roughly a third of topics. The prompt must be self-contained, 1 to 4 sentences, and must work without the reader having this page open. Do not assume the reader will do it.
- Simple diagrams: if a flow genuinely helps (the agent loop, an orchestrator pattern, a RAG pipeline), write it as an ASCII diagram inside `<pre class="diag">` with lines no longer than 40 characters. At most one per topic, and only where a picture beats a sentence.
- Escape `<`, `>` and `&` inside code and pre blocks (`&lt;` etc.).
- Keep every line under 400 characters so the fragment is reviewable.
- Do not include a "summary" or "conclusion" paragraph per topic; the `.key` aside does that job. No emoji.
- Cross-references: refer to other topics by number in prose, like "see 4.3", and wrap them as `<a class="xref" href="#t4-3">4.3</a>`. Only reference numbers in the list below.

## Accuracy

Write only what you are confident is true as of your knowledge. Where the field is moving, say so. Where harness behavior differs by product, say "most harnesses" or name the pattern. Prefer general mechanisms over claims about a specific vendor's internals. Never state a number you are not sure of.

## Full topic list (final numbering; the reader can jump to any topic, so each topic must stand alone)

1 How models work
 1.1 Tokens and transformers in one page
 1.2 The training pipeline: pretraining, SFT, RLHF/RLAIF
 1.3 Reasoning and extended thinking
 1.4 Hallucination and structural weaknesses
 1.5 Scaling laws and model tiers
 1.6 Tokenization in practice (code, JSON, Chinese, cost)

2 Prompting and context engineering
 2.1 System prompts and the instruction hierarchy
 2.2 Context engineering: what to include and in what order
 2.3 Prompt caching
 2.4 Decomposition and chain of thought
 2.5 Long context versus retrieval

3 Tool use under the hood
 3.1 How function calling works at the API level
 3.2 Structured output and JSON schema
 3.3 Computer use and browser agents

4 Agent harnesses: the loop around the model (the deep dive; the reader's main interest)
 4.1 The core loop
 4.2 Tools as the interface (schemas, descriptions, result formatting, deferred loading, bash as the universal tool)
 4.3 Context management (system prompt layout, what enters the window, compaction/summarization, why long sessions degrade)
 4.4 Memory (CLAUDE.md-style instruction files, memory files, recall, what persists across sessions)
 4.5 Permissions and sandboxing (allow/deny rules, auto mode, OS sandboxes, enforced vs promised)
 4.6 Subagents, forks and workflows (context isolation, when parallelism pays, the handoff tax)
 4.7 Hooks, skills, slash commands and plugins (deterministic vs prompt-based extension)
 4.8 MCP (protocol, servers vs tools, resources and prompts, security surface)
 4.9 Reliability and cost (retries, loop detection, timeouts, token accounting, rate limits)
 4.10 Failure modes (injection via tool results, runaway loops, false "done", mitigations)
 4.11 Comparing harnesses (Claude Code, Codex CLI, Cursor agents, Agent SDK; SWE-bench / Terminal-Bench style evals)
 4.12 Build one yourself (a ~100-line loop against the API, then the Agent SDK; include real, short pseudocode)

5 Multi-agent and product patterns
 5.1 Orchestrator and workers (pipelines, fan-out/merge, parallel review)
 5.2 Long-running agents (checkpoints, resumption, surviving restarts)
 5.3 Human in the loop (where approval protects without stalling)
 5.4 When not to use an agent

6 Evals
 6.1 Why vibes fail: building a small eval set
 6.2 LLM as judge
 6.3 Reading benchmarks critically
 6.4 Evaluating agents (trajectories, pass@k, why they differ from chat evals)
 6.5 Evals for your own skills and prompts

7 Retrieval and RAG
 7.1 Embeddings and vector search
 7.2 Chunking, hybrid search and reranking
 7.3 Agentic search versus RAG (why coding agents grep instead of embedding the repo)
 7.4 When RAG is the wrong tool

8 Fine-tuning and customization
 8.1 What fine-tuning changes (SFT, LoRA, style vs facts)
 8.2 Prompt versus RAG versus fine-tune
 8.3 Distillation and small models
 8.4 Preference tuning (DPO, RLHF) at abstract-reading depth

9 Inference, serving and cost
 9.1 KV cache and batching (why output tokens cost more; latency vs throughput)
 9.2 Quantization and open-weight models (running locally)
 9.3 Pricing math and rate limits (how a session's cost is composed)
 9.4 Streaming and latency

10 Safety, security and alignment
 10.1 Prompt injection
 10.2 Jailbreaks versus injection versus misuse
 10.3 Alignment training (constitutional AI, RLHF, model specs)
 10.4 Interpretability basics
 10.5 Agent safety in practice

11 Landscape and history
 11.1 Timeline, 2017 to now (keep to well-established milestones; mark the recent end as "roughly")
 11.2 Labs and the open-weight ecosystem
 11.3 Reading a model card or launch post
 11.4 Where it is heading (clearly labeled speculation)
