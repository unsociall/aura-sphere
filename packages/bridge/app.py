import asyncio
import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

base_dir = Path(__file__).resolve().parents[2]
load_dotenv(dotenv_path=base_dir / ".env")

from database import SessionLocal, init_db, ChatMessage, MemoryEntry, User
from schemas import ChatRequest, ChatHistoryResponse, MemoryItem, SearchResponse, SearchResult
from packages.mempalace.memory import MemoryEngine

ENV = os.getenv("ENV", "development")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
API_ORIGINS = [os.getenv("CORS_ORIGIN", "http://localhost:3000"), "http://localhost:3000"]

app = FastAPI(title="Aura-Sphere Bridge", version="0.1.0")
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=API_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

init_db()
memory_engine = MemoryEngine()


def get_current_user(authorization: str | None = Header(None)) -> dict[str, Any]:
    if not authorization:
        if ENV != "production":
            return {"sub": "dev-user", "email": "dev@local", "name": "Developer"}
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Authorization header")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@app.exception_handler(RateLimitExceeded)
def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "env": ENV}


@app.get("/api/v1/history", response_model=ChatHistoryResponse)
def history(user_id: str, current_user: dict[str, Any] = Depends(get_current_user)):
    if ENV == "production" and current_user.get("sub") != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    with SessionLocal() as session:
        events = (
            session.query(ChatMessage)
            .filter(ChatMessage.user_id == user_id)
            .order_by(ChatMessage.created_at)
            .all()
        )

        return {
            "messages": [
                {"id": str(event.id), "role": event.role, "content": event.content}
                for event in events
            ]
        }


@app.post("/api/v1/memory")
def create_memory(item: MemoryItem, current_user: dict[str, Any] = Depends(get_current_user)):
    if ENV == "production" and current_user.get("sub") != item.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    with SessionLocal() as session:
        session.merge(User(id=item.user_id, email=current_user.get("email", "unknown")))
        session.add(
            MemoryEntry(
                user_id=item.user_id,
                role=item.role,
                content=item.content,
                category=item.category or "chat",
            )
        )
        session.commit()

    memory_engine.add_memory(item.user_id, item.content, category=item.category or "chat")
    return {"status": "saved"}


def build_assistant_text(messages: list[Any], ai_name: str) -> str:
    if not messages:
        return f"Olá! Eu sou {ai_name}. Como posso ajudar hoje?"

    last_user = next((m.content for m in reversed(messages) if getattr(m, "role", None) == "user"), None)
    if not last_user:
        return f"Olá! Vamos conversar."

    return f"{ai_name}: Entendi. Você disse: {last_user}"


@app.post("/api/v1/chat")
async def chat(request: ChatRequest, current_user: dict[str, Any] = Depends(get_current_user)):
    user_id = request.user_id or current_user.get("sub", "dev-user")
    ai_name = request.ai_name or "Aurora"
    assistant_text = build_assistant_text(request.messages, ai_name)

    def save_user_and_history():
        with SessionLocal() as session:
            session.merge(User(id=user_id, email=current_user.get("email", "unknown")))
            for message in request.messages:
                if message.role != "assistant":
                    session.add(
                        ChatMessage(
                            user_id=user_id,
                            role=message.role,
                            content=message.content,
                        )
                    )
            session.commit()

    save_user_and_history()

    async def event_stream():
        chunk_size = 32
        for start in range(0, len(assistant_text), chunk_size):
            chunk = assistant_text[start : start + chunk_size]
            payload = {"choices": [{"delta": {"content": chunk}}]}
            yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(0.05)

        yield "data: [DONE]\n\n"

        with SessionLocal() as session:
            session.add(
                ChatMessage(
                    user_id=user_id,
                    role="assistant",
                    content=assistant_text,
                )
            )
            session.commit()

        memory_engine.add_memory(user_id, assistant_text, category="assistant")

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/v1/search", response_model=SearchResponse)
def search(user_id: str, q: str, current_user: dict[str, Any] = Depends(get_current_user)):
    if ENV == "production" and current_user.get("sub") != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    term = f"%{q.lower()}%"
    with SessionLocal() as session:
        items = (
            session.query(MemoryEntry)
            .filter(MemoryEntry.user_id == user_id)
            .filter(MemoryEntry.content.ilike(term))
            .order_by(MemoryEntry.created_at.desc())
            .limit(20)
            .all()
        )

        return {
            "results": [
                {
                    "id": str(item.id),
                    "role": item.role,
                    "content": item.content,
                    "category": item.category,
                }
                for item in items
            ]
        }
