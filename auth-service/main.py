from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from views import router as auth_router
from database import engine
from models import Base

app = FastAPI(
    title="Auth Service",
    description="Сервис аутентификации для Family Wallet",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутера
app.include_router(auth_router)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        # Создаем таблицы, если не существуют
        await conn.run_sync(Base.metadata.create_all)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "auth-service"}
