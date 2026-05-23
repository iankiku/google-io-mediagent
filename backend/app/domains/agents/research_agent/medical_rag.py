from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
import xml.etree.ElementTree as ET

import requests
from dotenv import load_dotenv
from google import genai
from google.genai import types


SOURCE_CATALOG: dict[str, str] = {
    "RxNorm": "NLM drug terminology. Best for normalized medication names, ingredients, clinical/branded drugs, and RxCUIs.",
    "MedlinePlus": "NLM consumer health information. Best for patient-friendly disease/topic explanations and general health education.",
    "DailyMed": "NLM/FDA Structured Product Label repository. Best for official drug label pages, package insert titles, and labeled product records.",
    "openFDA": "Public FDA REST API. Best for public drug labeling and regulatory-style evidence, but not a clinical decision source by itself.",
    "MeSH": "NLM Medical Subject Headings vocabulary. Best for medical concept normalization, synonym expansion, and topic labeling.",
}

ROUTER_SYSTEM_PROMPT = """You are a medical retrieval router.
Choose exactly the two most relevant public data sources for a query.
Use only these source names exactly: RxNorm, MedlinePlus, DailyMed, openFDA, MeSH.
For each selected source, provide:
- source: exact source name
- rationale: one short sentence explaining why this source is relevant
- source_query: a short source-optimized retrieval query
Return strict JSON only with this shape:
{
  \"selected_sources\": [
    {\"source\": \"RxNorm\", \"rationale\": \"...\", \"source_query\": \"...\"},
    {\"source\": \"DailyMed\", \"rationale\": \"...\", \"source_query\": \"...\"}
  ]
}
"""

SUMMARIZER_SYSTEM_PROMPT = """You are a medical RAG summarizer.
Use only the routed retrieval evidence in the prompt unless Google Search grounding is enabled.
If a source returned no hits or errored, say so.
Do not claim clinical certainty.
Return:
1. Short answer
2. Why these routed sources were chosen
3. Source-by-source findings
4. Normalized entities / candidate terms / codes
5. Caveats
"""


@dataclass
class Settings:
    gemini_api_key: str | None
    gemini_model: str
    enable_google_search_grounding: bool
    router_source_count: int
    top_k_per_source: int
    request_timeout_seconds: int
    medlineplus_webservice_base: str
    medlineplus_tool: str | None
    medlineplus_email: str | None
    dailymed_base: str
    openfda_base: str
    openfda_api_key: str | None
    mesh_lookup_base: str
    rxnav_base: str


@dataclass
class RetrievalHit:
    source: str
    title: str
    code: str | None = None
    canonical_id: str | None = None
    summary: str | None = None
    url: str | None = None
    score: float | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_context_block(self) -> str:
        parts = [f"source={self.source}"]
        if self.code:
            parts.append(f"code={self.code}")
        if self.canonical_id and self.canonical_id != self.code:
            parts.append(f"id={self.canonical_id}")
        parts.append(f"title={self.title}")
        if self.summary:
            parts.append(f"summary={self.summary}")
        if self.url:
            parts.append(f"url={self.url}")
        rendered_extra = ", ".join(
            f"{key}={value}" for key, value in self.extra.items() if value not in (None, "", [], {})
        )
        if rendered_extra:
            parts.append(f"extra={rendered_extra}")
        return " | ".join(parts)


@dataclass
class SourceResult:
    source: str
    status: str
    strategy: str
    hits: list[RetrievalHit] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def context_text(self) -> str:
        lines = [f"[{self.source}] status={self.status} strategy={self.strategy}"]
        for note in self.notes:
            lines.append(f"note: {note}")
        for error in self.errors:
            lines.append(f"error: {error}")
        for idx, hit in enumerate(self.hits, start=1):
            lines.append(f"hit_{idx}: {hit.to_context_block()}")
        return "\n".join(lines)


@dataclass
class RoutingSelection:
    source: str
    rationale: str
    source_query: str


@dataclass
class RoutingDecision:
    query: str
    selected_sources: list[RoutingSelection]
    raw_response_text: str | None = None

    def context_text(self) -> str:
        lines = [f"Original query: {self.query}"]
        for idx, selection in enumerate(self.selected_sources, start=1):
            lines.append(
                f"route_{idx}: source={selection.source} | rationale={selection.rationale} | source_query={selection.source_query}"
            )
        return "\n".join(lines)


@dataclass
class PipelineResult:
    query: str
    routing_decision: RoutingDecision
    source_results: list[SourceResult]
    final_answer: str
    model_name: str
    raw_response: Any | None = None


def load_settings(env_file: str | Path | None = None) -> Settings:
    if env_file:
        load_dotenv(env_file)
    else:
        load_dotenv()

    def to_bool(value: str | None, default: bool = False) -> bool:
        if value is None:
            return default
        return value.strip().lower() in {"1", "true", "yes", "on"}

    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        enable_google_search_grounding=to_bool(os.getenv("ENABLE_GOOGLE_SEARCH_GROUNDING"), False),
        router_source_count=int(os.getenv("ROUTER_SOURCE_COUNT", "2")),
        top_k_per_source=int(os.getenv("TOP_K_PER_SOURCE", "5")),
        request_timeout_seconds=int(os.getenv("REQUEST_TIMEOUT_SECONDS", "30")),
        medlineplus_webservice_base=os.getenv("MEDLINEPLUS_WEBSERVICE_BASE", "https://wsearch.nlm.nih.gov/ws/query"),
        medlineplus_tool=os.getenv("MEDLINEPLUS_TOOL"),
        medlineplus_email=os.getenv("MEDLINEPLUS_EMAIL"),
        dailymed_base=os.getenv("DAILYMED_BASE", "https://dailymed.nlm.nih.gov/dailymed/services/v2"),
        openfda_base=os.getenv("OPENFDA_BASE", "https://api.fda.gov/drug/label.json"),
        openfda_api_key=os.getenv("OPENFDA_API_KEY"),
        mesh_lookup_base=os.getenv("MESH_LOOKUP_BASE", "https://id.nlm.nih.gov/mesh/lookup/descriptor"),
        rxnav_base=os.getenv("RXNAV_BASE", "https://rxnav.nlm.nih.gov/REST"),
    )


def clean_text(value: str | None, max_len: int = 320) -> str | None:
    if not value:
        return None
    without_tags = re.sub(r"<[^>]+>", "", value)
    cleaned = re.sub(r"\s+", " ", without_tags).strip()
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 3].rstrip() + "..."


def dedupe_hits(hits: list[RetrievalHit], limit: int) -> list[RetrievalHit]:
    output: list[RetrievalHit] = []
    seen: set[tuple[str | None, str]] = set()
    for hit in hits:
        key = (hit.code or hit.canonical_id, hit.title.lower())
        if key in seen:
            continue
        seen.add(key)
        output.append(hit)
        if len(output) >= limit:
            break
    return output


def get_client(settings: Settings) -> genai.Client:
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is required.")
    return genai.Client(api_key=settings.gemini_api_key)


def strip_code_fences(text: str) -> str:
    return re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE | re.DOTALL)


def build_routing_prompt(query: str) -> str:
    catalog_text = "\n".join(f"- {name}: {description}" for name, description in SOURCE_CATALOG.items())
    return (
        "Available sources:\n"
        f"{catalog_text}\n\n"
        f"User query: {query}\n\n"
        "Choose the best two sources and rewrite a compact retrieval query for each."
    )


def fallback_route(query: str) -> RoutingDecision:
    lowered = query.lower()
    if any(token in lowered for token in ["dose", "tablet", "capsule", "drug", "medication", "metformin", "insulin", "statin"]):
        selections = [
            RoutingSelection("RxNorm", "The query is medication-focused and needs normalized drug concepts.", query),
            RoutingSelection("DailyMed", "The query appears medication-focused and DailyMed provides official drug label records.", query),
        ]
    elif any(token in lowered for token in ["warning", "adverse", "recall", "fda"]):
        selections = [
            RoutingSelection("openFDA", "The query is regulatory or labeling oriented.", query),
            RoutingSelection("DailyMed", "DailyMed complements regulatory records with official SPL labels.", query),
        ]
    else:
        selections = [
            RoutingSelection("MeSH", "The query looks concept-oriented and benefits from vocabulary normalization.", query),
            RoutingSelection("MedlinePlus", "The query looks topic-oriented and MedlinePlus is strong for general health-topic retrieval.", query),
        ]
    return RoutingDecision(query=query, selected_sources=selections, raw_response_text="heuristic_fallback")


def route_query(query: str, settings: Settings) -> RoutingDecision:
    client = get_client(settings)
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=build_routing_prompt(query),
        config=types.GenerateContentConfig(system_instruction=ROUTER_SYSTEM_PROMPT, temperature=0.1),
    )
    text = getattr(response, "text", None) or str(response)
    try:
        payload = json.loads(strip_code_fences(text))
        selections: list[RoutingSelection] = []
        seen: set[str] = set()
        for item in payload.get("selected_sources") or []:
            source = item.get("source")
            if source not in SOURCE_CATALOG or source in seen:
                continue
            rationale = (item.get("rationale") or "Selected by Gemini as relevant.").strip()
            source_query = (item.get("source_query") or query).strip() or query
            selections.append(RoutingSelection(source=source, rationale=rationale, source_query=source_query))
            seen.add(source)
            if len(selections) >= settings.router_source_count:
                break
        if len(selections) == settings.router_source_count:
            return RoutingDecision(query=query, selected_sources=selections, raw_response_text=text)
    except Exception:
        pass
    return fallback_route(query)


def retrieve_rxnorm(query: str, session: requests.Session, settings: Settings) -> SourceResult:
    try:
        response = session.get(
            f"{settings.rxnav_base.rstrip('/')}/drugs.json",
            params={"name": query, "expand": "psn"},
            timeout=settings.request_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json() or {}
    except Exception as exc:
        return SourceResult("RxNorm", "error", "RxNav getDrugs", errors=[str(exc)])

    hits: list[RetrievalHit] = []
    for group in (((payload.get("drugGroup") or {}).get("conceptGroup")) or []):
        tty = group.get("tty")
        for concept in group.get("conceptProperties") or []:
            rxcui = concept.get("rxcui")
            hits.append(
                RetrievalHit(
                    source="RxNorm",
                    title=concept.get("name") or concept.get("synonym") or "Unknown RxNorm concept",
                    code=rxcui,
                    canonical_id=rxcui,
                    summary=clean_text(concept.get("psn") or concept.get("synonym")),
                    url=f"https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm={rxcui}" if rxcui else None,
                    extra={"tty": tty, "language": concept.get("language")},
                )
            )
    deduped = dedupe_hits(hits, settings.top_k_per_source)
    return SourceResult("RxNorm", "ok" if deduped else "empty", "RxNav getDrugs", hits=deduped)


def retrieve_medlineplus(query: str, session: requests.Session, settings: Settings) -> SourceResult:
    params = {"db": "healthTopics", "term": query, "retmax": settings.top_k_per_source, "rettype": "brief"}
    if settings.medlineplus_tool:
        params["tool"] = settings.medlineplus_tool
    if settings.medlineplus_email:
        params["email"] = settings.medlineplus_email

    try:
        response = session.get(settings.medlineplus_webservice_base, params=params, timeout=settings.request_timeout_seconds)
        response.raise_for_status()
        root = ET.fromstring(response.text)
    except Exception as exc:
        return SourceResult("MedlinePlus", "error", "MedlinePlus health topic search", errors=[str(exc)])

    hits: list[RetrievalHit] = []
    for doc in root.findall(".//document"):
        url = doc.attrib.get("url")
        rank = doc.attrib.get("rank")
        title = None
        summary = None
        snippet = None
        meshes: list[str] = []
        groups: list[str] = []
        alt_titles: list[str] = []
        for content in doc.findall("content"):
            name = (content.attrib.get("name") or "").lower()
            text = clean_text(" ".join(part.strip() for part in content.itertext() if part.strip()), 1000)
            if not text:
                continue
            if name == "title" and not title:
                title = text
            elif name == "fullsummary" and not summary:
                summary = text
            elif name == "snippet" and not snippet:
                snippet = text
            elif name == "mesh":
                meshes.append(text)
            elif name == "groupname":
                groups.append(text)
            elif name == "alttitle":
                alt_titles.append(text)
        hits.append(
            RetrievalHit(
                source="MedlinePlus",
                title=title or "Unknown MedlinePlus topic",
                canonical_id=url,
                summary=clean_text(summary or snippet),
                url=url,
                score=float(rank) if rank and rank.isdigit() else None,
                extra={
                    "mesh_terms": "; ".join(meshes[:4]),
                    "groups": "; ".join(groups[:3]),
                    "alt_titles": "; ".join(alt_titles[:3]),
                },
            )
        )
    deduped = dedupe_hits(hits, settings.top_k_per_source)
    return SourceResult(
        "MedlinePlus",
        "ok" if deduped else "empty",
        "MedlinePlus health topic search",
        hits=deduped,
        notes=["MedlinePlus is free, but NLM asks clients to stay under 85 requests/minute/IP and recommends caching."],
    )


def retrieve_dailymed(query: str, session: requests.Session, settings: Settings) -> SourceResult:
    try:
        response = session.get(
            f"{settings.dailymed_base.rstrip('/')}/spls.json",
            params={"drug_name": query, "name_type": "both", "pagesize": settings.top_k_per_source, "page": 1},
            timeout=settings.request_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json() or {}
    except Exception as exc:
        return SourceResult("DailyMed", "error", "DailyMed SPL search", errors=[str(exc)])

    hits = [
        RetrievalHit(
            source="DailyMed",
            title=item.get("title") or "Unknown DailyMed SPL",
            code=item.get("setid"),
            canonical_id=item.get("setid"),
            summary=clean_text(f"Published: {item.get('published_date')}; SPL version: {item.get('spl_version')}"),
            url=f"https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={item.get('setid')}" if item.get("setid") else None,
            extra={"published_date": item.get("published_date"), "spl_version": item.get("spl_version")},
        )
        for item in payload.get("data") or []
    ]
    deduped = dedupe_hits(hits, settings.top_k_per_source)
    return SourceResult("DailyMed", "ok" if deduped else "empty", "DailyMed SPL search", hits=deduped)


def retrieve_openfda(query: str, session: requests.Session, settings: Settings) -> SourceResult:
    chosen_field = None
    payload = None
    last_error = None
    for field in ["openfda.generic_name", "openfda.brand_name", "purpose", "indications_and_usage", "description"]:
        params = {"search": f'{field}:"{query}"', "limit": settings.top_k_per_source}
        if settings.openfda_api_key:
            params["api_key"] = settings.openfda_api_key
        try:
            response = session.get(settings.openfda_base, params=params, timeout=settings.request_timeout_seconds)
            response.raise_for_status()
            candidate = response.json() or {}
            if candidate.get("results"):
                payload = candidate
                chosen_field = field
                break
        except Exception as exc:
            last_error = str(exc)

    if payload is None:
        if last_error:
            return SourceResult("openFDA", "error", "openFDA drug label search", errors=[last_error])
        return SourceResult("openFDA", "empty", "openFDA drug label search", notes=["No openFDA records matched the routed query."])

    hits: list[RetrievalHit] = []
    for item in payload.get("results") or []:
        openfda = item.get("openfda") or {}
        summary = None
        for field_name in ["purpose", "indications_and_usage", "description", "warnings"]:
            value = item.get(field_name)
            if isinstance(value, list) and value:
                summary = clean_text(value[0], 220)
                break
        title = ", ".join(openfda.get("brand_name") or openfda.get("generic_name") or []) or "Unknown openFDA label"
        hits.append(
            RetrievalHit(
                source="openFDA",
                title=title,
                code=(openfda.get("product_ndc") or [None])[0],
                canonical_id=item.get("set_id") or item.get("id"),
                summary=summary,
                url=f"https://api.fda.gov/drug/label.json?search={chosen_field}:\"{query}\"",
                extra={
                    "matched_field": chosen_field,
                    "manufacturer": "; ".join((openfda.get("manufacturer_name") or [])[:2]),
                    "route": "; ".join((openfda.get("route") or [])[:3]),
                },
            )
        )
    deduped = dedupe_hits(hits, settings.top_k_per_source)
    return SourceResult(
        "openFDA",
        "ok" if deduped else "empty",
        "openFDA drug label search",
        hits=deduped,
        notes=["FDA says not to rely on openFDA by itself for medical-care decisions."],
    )


def retrieve_mesh(query: str, session: requests.Session, settings: Settings) -> SourceResult:
    try:
        response = session.get(
            settings.mesh_lookup_base,
            params={"label": query, "match": "contains", "limit": settings.top_k_per_source},
            timeout=settings.request_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json() or []
    except Exception as exc:
        return SourceResult("MeSH", "error", "MeSH descriptor lookup", errors=[str(exc)])

    hits = []
    for item in payload[: settings.top_k_per_source]:
        resource = item.get("resource")
        code = resource.rstrip("/").split("/")[-1] if resource else None
        hits.append(
            RetrievalHit(
                source="MeSH",
                title=item.get("label") or "Unknown MeSH descriptor",
                code=code,
                canonical_id=resource,
                summary="MeSH descriptor match returned by NLM MeSH RDF lookup service.",
                url=resource,
            )
        )
    return SourceResult("MeSH", "ok" if hits else "empty", "MeSH descriptor lookup", hits=hits)


def run_selected_retrievers(routing: RoutingDecision, settings: Settings) -> list[SourceResult]:
    session = requests.Session()
    session.headers.update({"User-Agent": "medical-rag-simple/0.3"})
    retriever_map = {
        "RxNorm": retrieve_rxnorm,
        "MedlinePlus": retrieve_medlineplus,
        "DailyMed": retrieve_dailymed,
        "openFDA": retrieve_openfda,
        "MeSH": retrieve_mesh,
    }

    results: list[SourceResult] = []
    for selection in routing.selected_sources:
        retriever = retriever_map.get(selection.source)
        if not retriever:
            results.append(SourceResult(selection.source, "skipped", "source unavailable", notes=[selection.rationale]))
            continue
        result = retriever(selection.source_query, session, settings)
        result.notes.insert(0, f"Router rationale: {selection.rationale}")
        result.notes.insert(1, f"Router retrieval query: {selection.source_query}")
        results.append(result)
    return results


def results_to_context(results: list[SourceResult]) -> str:
    return "\n\n".join(result.context_text() for result in results)


def summarize(query: str, routing: RoutingDecision, results: list[SourceResult], settings: Settings):
    client = get_client(settings)
    tools = []
    if settings.enable_google_search_grounding:
        tools.append(types.Tool(google_search=types.GoogleSearch()))
    prompt = (
        f"User query: {query}\n\n"
        f"Routing decision:\n{routing.context_text()}\n\n"
        f"Retrieved evidence:\n{results_to_context(results)}\n\n"
        "Now synthesize the best answer from the routed evidence."
    )
    return client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SUMMARIZER_SYSTEM_PROMPT,
            tools=tools or None,
            temperature=0.2,
        ),
    )


def run_pipeline(query: str, env_file: str | Path | None = None) -> PipelineResult:
    settings = load_settings(env_file)
    routing = route_query(query, settings)
    results = run_selected_retrievers(routing, settings)
    response = summarize(query, routing, results, settings)
    text = getattr(response, "text", None) or str(response)
    return PipelineResult(
        query=query,
        routing_decision=routing,
        source_results=results,
        final_answer=text,
        model_name=settings.gemini_model,
        raw_response=response,
    )


def format_result(result: PipelineResult) -> str:
    lines: list[str] = []

    lines.append("=== Routing Decision ===")
    for selection in result.routing_decision.selected_sources:
        lines.append(f"- {selection.source}: {selection.rationale}")
        lines.append(f"  retrieval query: {selection.source_query}")

    lines.append("")
    lines.append("=== Final Answer ===")
    lines.append(result.final_answer)

    lines.append("")
    lines.append("=== Source Status ===")
    for source_result in result.source_results:
        lines.append(f"- {source_result.source}: {source_result.status} via {source_result.strategy} ({len(source_result.hits)} hits)")
        for note in source_result.notes:
            lines.append(f"  note: {note}")
        for error in source_result.errors:
            lines.append(f"  error: {error}")

    return "\n".join(lines)


def print_result(result: PipelineResult) -> None:
    print(format_result(result))


def run_pipeline_to_text(query: str, env_file: str | Path | None = None) -> str:
    return format_result(run_pipeline(query=query, env_file=env_file))


def main() -> None:
    env_file = Path(__file__).with_name(".env")
    query = input("Enter your medical query: ").strip()
    if not query:
        raise SystemExit("No query provided.")
    result = run_pipeline(query=query, env_file=env_file if env_file.exists() else None)
    print_result(result)


if __name__ == "__main__":
    main()
