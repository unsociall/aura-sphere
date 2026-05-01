from typing import List, Optional

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    user_id: Optional[str] = None
    ai_name: Optional[str] = None
    messages: List[Message] = Field(default_factory=list)


class ChatHistoryResponse(BaseModel):
    messages: List[Message]


class MemoryItem(BaseModel):
    user_id: str
    role: str
    content: str
    category: Optional[str] = None


class SearchResult(BaseModel):
    id: str
    role: str
    content: str
    category: str


class SearchResponse(BaseModel):
    results: List[SearchResult]
