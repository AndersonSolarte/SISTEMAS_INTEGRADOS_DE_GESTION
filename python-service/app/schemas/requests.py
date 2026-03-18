from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class FiltersModel(BaseModel):
    programas: List[str] = Field(default_factory=list)
    anios: List[int] = Field(default_factory=list)
    periodos: List[str] = Field(default_factory=list)
    modulos: List[str] = Field(default_factory=list)
    gruposReferencia: List[str] = Field(default_factory=list)
    tipoEvaluado: List[str] = Field(default_factory=list)


class FiltersPayload(BaseModel):
    filters: FiltersModel = Field(default_factory=FiltersModel)


class PaginationModel(BaseModel):
    page: int = 1
    pageSize: int = 20


class SortModel(BaseModel):
    field: str = "anio"
    direction: str = "desc"


class TablePayload(BaseModel):
    filters: FiltersModel = Field(default_factory=FiltersModel)
    pagination: PaginationModel = Field(default_factory=PaginationModel)
    sort: List[SortModel] = Field(default_factory=lambda: [SortModel()])


JSONDict = Dict[str, Any]
