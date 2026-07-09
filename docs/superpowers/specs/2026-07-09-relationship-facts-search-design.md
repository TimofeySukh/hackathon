# Relationship facts in Smart Search

## Goal

Make relationship-oriented Smart Search queries accurate and explainable by reading the
stable fields already emitted in `AI Relationship Summary` notes:

```text
Summary: ...
Tags: Quality Assurance, Job Referral, Tech Industry
Warmth: Cold|Warm|Hot
```

Examples include “my warmest contacts”, “people tagged recruiting”, and “warm contacts
who know about relocation”. A query must never return a person as warm when that person
has no extracted warmth fact.

## Scope

This is an in-memory compatibility layer for the existing JSONB graph. It does not add
database tables, a GraphState migration, or a new API endpoint. It works immediately for
existing and future notes that follow the current enrichment template.

## Fact extraction

A shared search helper will inspect only notes titled `AI Relationship Summary`. It will:

- parse `Warmth` as the closed enum `Cold`, `Warm`, or `Hot`;
- split `Tags` into normalized, deduplicated tag values while retaining display values;
- ignore malformed or incomplete lines without inventing values;
- combine multiple summary notes conservatively: union tags and retain the highest known
  warmth (`Hot > Warm > Cold`);
- preserve the raw note as the source of truth and return its title/body as provenance.

People without a valid summary note have no relationship facts.

## Smart Search flow

The analysis pass will return optional structured relationship intent:

```json
{
  "warmthOrder": "highest | lowest | none",
  "tagTerms": ["string"]
}
```

These fields describe the user's request; they do not contain search results.

When relationship intent is present, candidate retrieval will use extracted facts before
the LLM match pass:

1. Exclude people without relationship facts when the query asks for warmth or tags.
2. Filter by requested tags when tag terms are present.
3. Sort by requested warmth order, then exact tag coverage, then person name.
4. Include the structured `warmth` and `tags` fields in each candidate passed to the LLM.

The match prompt will require the model to use these fields as facts. For a “warmest”
query it may choose only from the highest warmth tier returned; it must not infer warmth
from a biography, company, or arbitrary note text.

If no structured candidates exist, the response will state that the graph has no matching
AI relationship facts and will not fall back to alphabetically selected people with generic
notes.

## Interface behavior

No new endpoint, CLI command, or MCP tool is added. `POST /v1/search/smart`, the CLI, and
the MCP Smart Search tool retain their existing response shape. Their existing `aiReason`
will cite the parsed warmth or matching tags.

## Error handling

- Malformed AI notes are ignored for fact search but remain visible and searchable as
  ordinary notes.
- An unavailable model still falls back to the existing deterministic non-AI search; it
  must not claim that a relationship fact exists when one was not parsed.
- A graph with no relationship summaries returns no relationship candidates rather than an
  arbitrary match.

## Verification

Use a graph fixture with `Hot`, `Warm`, `Cold`, missing, and malformed summaries. Verify
that:

- “warmest contact” returns only `Hot` contacts;
- tag queries return only exact normalized tag matches;
- people without a summary cannot outrank structured matches;
- a graph with no structured facts produces no invented warmest contact;
- ordinary name and note search behavior remains unchanged.

## Follow-up

This is a bridge to the planned first-class tags and search projections described in
`docs/features/fast-agentic-search.md`. Once relational projections exist, they will
replace repeated note parsing without changing the Smart Search contract.
