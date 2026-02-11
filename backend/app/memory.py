import os
import json
import uuid
from typing import List, Dict, Any, Tuple, Optional

import faiss  # type: ignore
import numpy as np

from .utils.ollama_client import OllamaClient


class FAISSMemory:
    def __init__(self, data_dir: str, embed_model: str = "llama3"):
        os.makedirs(data_dir, exist_ok=True)
        self.index_path = os.path.join(data_dir, "memory.index")
        self.meta_path = os.path.join(data_dir, "memory_meta.json")
        self.client = OllamaClient(model=embed_model)
        self.dimension = None
        self.index = None
        self.metadata: Dict[str, Dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        if os.path.exists(self.meta_path):
            with open(self.meta_path, "r") as f:
                self.metadata = json.load(f)
        if os.path.exists(self.index_path):
            self.index = faiss.read_index(self.index_path)
            # Infer dimension
            self.dimension = self.index.d
        else:
            self.index = None

    def _save(self) -> None:
        if self.index is not None:
            faiss.write_index(self.index, self.index_path)
        with open(self.meta_path, "w") as f:
            json.dump(self.metadata, f)

    def _ensure_index(self, dim: int) -> None:
        if self.index is None:
            self.dimension = dim
            # Using cosine similarity via inner product with normalized vectors
            self.index = faiss.IndexFlatIP(dim)

    def _embed(self, text: str) -> np.ndarray:
        vec = np.array(self.client.embeddings(text), dtype=np.float32)
        if vec.ndim == 1:
            vec = vec.reshape(1, -1)
        # Normalize for cosine similarity
        faiss.normalize_L2(vec)
        return vec

    def add_texts(self, texts: List[str], metadatas: Optional[List[Dict[str, Any]]] = None) -> List[str]:
        ids: List[str] = []
        vectors = []
        metas = metadatas or [{} for _ in texts]
        for text, meta in zip(texts, metas):
            v = self._embed(text)
            vectors.append(v)
            doc_id = str(uuid.uuid4())
            ids.append(doc_id)
            self.metadata[doc_id] = {"text": text, "meta": meta}
        if not vectors:
            return []
        vecs = np.vstack(vectors)
        self._ensure_index(vecs.shape[1])
        self.index.add(vecs)
        self._save()
        return ids

    def similarity_search(self, query: str, k: int = 5) -> List[Tuple[str, float, Dict[str, Any]]]:
        if self.index is None or len(self.metadata) == 0:
            return []
        q = self._embed(query)
        D, I = self.index.search(q, k)
        results: List[Tuple[str, float, Dict[str, Any]]] = []
        # faiss index stores in insertion order; align ids by list order
        all_ids = list(self.metadata.keys())
        for idx, score in zip(I[0], D[0]):
            if idx < 0 or idx >= len(all_ids):
                continue
            doc_id = all_ids[idx]
            md = self.metadata.get(doc_id, {})
            results.append((doc_id, float(score), md))
        return results
