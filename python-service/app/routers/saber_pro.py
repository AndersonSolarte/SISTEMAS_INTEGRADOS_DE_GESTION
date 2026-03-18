from fastapi import APIRouter, HTTPException

from ..schemas.requests import FiltersPayload, TablePayload
from ..services.analytics_service import (
    get_filters_data,
    get_overview_data,
    get_charts_data,
    get_table_data,
    get_control_chart_data,
)

router = APIRouter()


@router.get("/filtros")
def filtros():
    try:
        return {"success": True, "data": get_filters_data()}
    except Exception as exc:  # pragma: no cover - defensive fallback
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/overview")
def overview(payload: FiltersPayload):
    try:
        return {"success": True, "data": get_overview_data(payload.filters)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/charts")
def charts(payload: FiltersPayload):
    try:
        return {"success": True, "data": get_charts_data(payload.filters)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/table")
def table(payload: TablePayload):
    try:
        return {"success": True, "data": get_table_data(payload)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/control-chart")
def control_chart(payload: FiltersPayload):
    try:
        return {"success": True, "data": get_control_chart_data(payload.filters)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
