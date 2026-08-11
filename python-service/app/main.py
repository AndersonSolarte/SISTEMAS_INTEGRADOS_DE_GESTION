import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import contexto_externo

try:
    from .routers import saber_pro
except ModuleNotFoundError as exc:
    if exc.name != "psycopg2":
        raise
    saber_pro = None


app = FastAPI(title="Saber Pro Analytics Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "success": True,
        "status": "OK",
        "services": {
            "contexto_externo": "available",
            "saber_pro": "available" if saber_pro is not None else "driver_unavailable",
        },
    }


if saber_pro is not None:
    app.include_router(saber_pro.router, prefix="/saber-pro", tags=["Saber Pro"])
app.include_router(contexto_externo.router, prefix="/contexto-externo", tags=["Contexto Externo"])
