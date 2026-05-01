from collections import defaultdict
from typing import List


class MemoryEngine:
    def __init__(self) -> None:
        self._store: dict[str, List[dict[str, str]]] = defaultdict(list)

    def add_memory(self, user_id: str, content: str, category: str = "chat") -> None:
        self._store[user_id].append({"content": content, "category": category})

    def search(self, user_id: str, query: str) -> List[dict[str, str]]:
        q = query.lower()
        return [
            item
            for item in self._store.get(user_id, [])
            if q in item["content"].lower()
        ]
