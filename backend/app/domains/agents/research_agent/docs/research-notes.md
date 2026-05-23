# Research notes: open medical sources + routing design

This project now focuses only on public sources that are realistically usable in a hackathon/demo environment without licensing or credential bottlenecks.

## Selected public sources

### 1. RxNorm
What it is:
- NLM's normalized drug terminology
- a strong medication normalization layer for ingredients, branded drugs, clinical drugs, and RxCUIs

Why it is useful here:
- excellent first-stop source for medication-centric queries
- helps anchor drug names to normalized identifiers before looking for label evidence elsewhere

Official access pattern used:
- RxNav REST API
- endpoint used in code: `GET /REST/drugs.json?name=...`

Research conclusion:
- best public source in this stack for medication name normalization
- pairs naturally with DailyMed or openFDA

### 2. MedlinePlus
What it is:
- NLM consumer health information resource
- topic summaries aimed at patients and the general public

Why it is useful here:
- strong for disease/topic explanation queries
- useful when the user is asking broad health-topic questions rather than only drug normalization

Official access pattern used:
- MedlinePlus Web Service text search
- base: `https://wsearch.nlm.nih.gov/ws/query`
- important official notes:
  - free
  - no registration required
  - English and Spanish health topics
  - acceptable-use guidance: 85 requests/minute/IP and recommended caching

Research conclusion:
- not a replacement for a clinical terminology service
- very good public explanatory source for routing into topic-level evidence

### 3. DailyMed
What it is:
- NLM searchable repository of FDA Structured Product Labels (SPLs)
- authoritative for current drug-label records and official product-label pages

Why it is useful here:
- very strong companion to RxNorm for medication-focused retrieval
- public and practical for retrieving label candidates and product pages

Official access pattern used:
- DailyMed REST API v2
- endpoint used in code: `/spls.json` with `drug_name=...`
- related official docs also expose `rxcui` filters and `setid` detail retrieval

Research conclusion:
- one of the best open sources in this stack for medication-label evidence
- especially useful once a query has been normalized down to a specific medicine

### 4. openFDA
What it is:
- FDA public REST API over several public FDA datasets
- drug labeling is the most relevant part for this project

Why it is useful here:
- public and easy to query
- useful for labeling/regulatory-style evidence and broad public FDA searchability

Official access pattern used:
- `https://api.fda.gov/drug/label.json`
- query shape: `search=field:term`
- no API key required for basic use, though optional keys exist for regular usage

Important caution from the official docs:
- FDA explicitly says not to rely on openFDA for medical-care decisions

Research conclusion:
- useful public source, especially as a broad labeling/regulatory evidence source
- best treated as supporting evidence, often paired with DailyMed

### 5. MeSH
What it is:
- Medical Subject Headings from NLM
- vocabulary/heading system used for biomedical indexing and concept organization

Why it is useful here:
- helpful for concept normalization and topic expansion
- useful when the query is more about a medical concept than about a product label

Official access pattern used:
- MeSH RDF lookup service
- endpoint used in code: descriptor lookup under `https://id.nlm.nih.gov/mesh/lookup`

Research conclusion:
- not a medication label source
- very useful as a vocabulary / topic routing asset

## Routing rationale

The key design change is this:
- do not run retrieval on every source for every query
- instead ask Gemini to choose the best two sources first

Why this is better:
- cheaper and cleaner than always hitting five sources
- gives more query-specific evidence
- avoids retrieving irrelevant results from mismatched sources
- fits the actual strengths of the public sources

## Router behavior

Gemini sees:
- the original query
- short descriptions of each source and what it is good for

Gemini returns:
- exactly two source names
- a short rationale for each
- a short source-specific retrieval query for each

That rewritten source query matters because a raw user question is often not the best direct search string for each API.

Examples:
- `type 2 diabetes on metformin with elevated a1c`
  - likely routes toward `RxNorm` + `DailyMed` or `MeSH` + `MedlinePlus`, depending on whether the question is medication-heavy or topic-heavy
- `metformin warnings in pregnancy`
  - likely routes toward `DailyMed` + `openFDA`
- `what is diabetic nephropathy`
  - likely routes toward `MeSH` + `MedlinePlus`

## Why not the previous terminology stack here

The earlier stack included SNOMED CT, ICD, and LOINC.
That approach is still legitimate for a full terminology product, but it has real access friction:
- licensing-sensitive SNOMED workflows
- credentialed WHO ICD API
- credentialed LOINC APIs

For this project phase, the open stack is the right fit because it actually runs now.

## Implementation decision

The implemented pipeline is therefore:
1. Gemini routing
2. retrieve from exactly two selected public sources
3. Gemini synthesis over the routed evidence

This keeps the system simple, public, and demo-ready while still grounding answers in official/public medical resources.
