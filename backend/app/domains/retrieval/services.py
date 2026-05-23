import json
import logging
from abc import ABC, abstractmethod
from typing import List

from google.genai import types
from app.core.config import client
from app.core.db import get_db_connection
from app.domains.ingestion.services import generate_embedding
from app.domains.retrieval.schemas import ScoredContext, RetrievalResult

logger = logging.getLogger("health_assistant.retrieval.services")


class MedicalReranker(ABC):
    @abstractmethod
    def rerank(self, query: str, contexts: list[dict]) -> list[ScoredContext]:
        ...


class FlashReranker(MedicalReranker):
    def rerank(self, query: str, contexts: list[dict]) -> list[ScoredContext]:
        """
        Uses Gemini 2.5 Flash to score and rerank candidate contexts for medical relevance.
        Returns top 2 sorted by score descending.
        """
        if not contexts:
            return []

        prompt = f"""You are a medical document relevance ranker.
Given a patient query and candidate contexts, score each context 0-10 for relevance to the query.
Consider: clinical accuracy, specificity to the patient's question, and recency of information.

Patient query: "{query}"

Candidate contexts:
{json.dumps([{"record_id": c.get("record_id", "unknown"), "content": c.get("chunk_content", "")} for c in contexts], indent=2)}

Return a JSON array of objects with fields: record_id (string), score (number 0-10), reason (string explaining the score).
Sort by score descending. Only include contexts with score > 0."""

        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    system_instruction="You are a medical document relevance ranker. Given a patient query and candidate contexts, score each context 0-10 for relevance. Return JSON array [{record_id, score, reason}]."
                )
            )
            ranked = json.loads(response.text)
            scored = []
            for item in ranked:
                rid = item.get("record_id", "unknown")
                # Find matching chunk_content from original contexts
                matching = [c for c in contexts if c.get("record_id", "unknown") == rid]
                chunk = matching[0].get("chunk_content", "") if matching else ""
                scored.append(ScoredContext(
                    record_id=rid,
                    chunk_content=chunk,
                    score=float(item.get("score", 0)),
                    reason=item.get("reason", "")
                ))
            # Sort descending and return top 2
            scored.sort(key=lambda x: x.score, reverse=True)
            return scored[:2]
        except Exception as e:
            logger.error(f"FlashReranker failed: {e}. Returning contexts as-is.")
            # Fallback: return first 2 with default scores
            return [
                ScoredContext(
                    record_id=c.get("record_id", "unknown"),
                    chunk_content=c.get("chunk_content", ""),
                    score=5.0,
                    reason="Reranker fallback — no scoring applied"
                )
                for c in contexts[:2]
            ]


class MedGemmaReranker(MedicalReranker):
    def rerank(self, query: str, contexts: list[dict]) -> list[ScoredContext]:
        raise NotImplementedError("MedGemma reranker requires Vertex AI deployment (v1.1)")


def retrieve(user_id: str, query: str, k_iterations: int = 2, top_k: int = 2) -> RetrievalResult:
    """
    HyDE (Hypothetical Document Embeddings) retrieval pipeline.

    For each iteration:
      1. Generate a hypothetical answer using Gemini 2.5 Flash (conditioned on accumulated contexts).
      2. Embed the hypothetical answer using generate_embedding().
      3. Search pgvector for user records + general KB using the hypothetical embedding.
      4. Append results to contexts, dedup by chunk_content.
    After all iterations, rerank using FlashReranker and return top_k results.
    """
    all_contexts: list[dict] = []
    seen_chunks: set[str] = set()
    hypothetical_answers: list[str] = []

    for iteration in range(k_iterations):
        # Build conditioning context from accumulated results
        context_block = ""
        if all_contexts:
            context_block = "\n\nPreviously retrieved context:\n" + "\n".join(
                [f"- {c['chunk_content']}" for c in all_contexts[:5]]
            )

        # Step 1: Generate hypothetical answer
        hyde_prompt = f"""You are a medical assistant. Given the patient's question, generate a plausible
hypothetical answer that would appear in their medical records or a clinical reference.
This answer will be used to search a vector database, so make it specific and clinically detailed.
{context_block}

Patient question: "{query}"

Generate a concise hypothetical answer (2-3 sentences) that a medical document might contain:"""

        try:
            hyde_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=hyde_prompt,
                config=types.GenerateContentConfig(
                    system_instruction="You generate hypothetical medical document snippets for retrieval augmentation. Be specific and clinically accurate."
                )
            )
            hypothetical_answer = hyde_response.text.strip()
        except Exception as e:
            logger.error(f"HyDE generation failed on iteration {iteration}: {e}")
            hypothetical_answer = query  # Fallback to original query
        hypothetical_answers.append(hypothetical_answer)

        # Step 2: Embed the hypothetical answer
        try:
            hyp_embedding = generate_embedding(hypothetical_answer)
        except Exception as e:
            logger.error(f"Embedding failed on iteration {iteration}: {e}")
            continue

        # Step 3: Search pgvector for user records + general KB
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            # User-specific records
            if user_id:
                cur.execute(
                    """
                    SELECT ure.record_id::text AS record_id, ure.chunk_content,
                           (ure.embedding <=> %s::vector) AS distance
                    FROM user_record_embeddings ure
                    WHERE ure.user_id = %s::uuid
                    ORDER BY distance ASC
                    LIMIT 5;
                    """,
                    (hyp_embedding, user_id)
                )
                user_results = cur.fetchall()
                for row in user_results:
                    chunk = row["chunk_content"]
                    if chunk not in seen_chunks:
                        seen_chunks.add(chunk)
                        all_contexts.append({
                            "record_id": row["record_id"],
                            "chunk_content": chunk,
                            "distance": float(row["distance"]),
                            "source": "user_records"
                        })

            # General medical knowledge
            cur.execute(
                """
                SELECT id::text AS record_id, chunk_content, source_title, disease_category,
                       (embedding <=> %s::vector) AS distance
                FROM general_medical_knowledge
                ORDER BY distance ASC
                LIMIT 3;
                """,
                (hyp_embedding,)
            )
            gen_results = cur.fetchall()
            for row in gen_results:
                chunk = row["chunk_content"]
                if chunk not in seen_chunks:
                    seen_chunks.add(chunk)
                    all_contexts.append({
                        "record_id": row["record_id"],
                        "chunk_content": f"[{row['source_title']} - {row['disease_category']}]: {chunk}",
                        "distance": float(row["distance"]),
                        "source": "general_kb"
                    })
        except Exception as e:
            logger.error(f"pgvector search failed on iteration {iteration}: {e}")
        finally:
            cur.close()
            conn.close()

    # Step 4: Rerank all accumulated contexts
    reranker = FlashReranker()
    if all_contexts:
        scored = reranker.rerank(query, all_contexts)
    else:
        scored = []

    return RetrievalResult(
        contexts=scored[:top_k],
        hypothetical_answers=hypothetical_answers,
        query=query
    )
