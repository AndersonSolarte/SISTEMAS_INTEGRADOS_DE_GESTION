import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import saber_pro


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
    return {"success": True, "status": "OK"}


app.include_router(saber_pro.router, prefix="/saber-pro", tags=["Saber Pro"])
