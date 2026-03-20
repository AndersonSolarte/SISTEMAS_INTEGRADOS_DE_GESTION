from __future__ import annotations

from math import sqrt
from typing import Any, Dict, List, Tuple
import pandas as pd

from ..db.connection import get_cursor


def _norm_text(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def _build_where(filters) -> Tuple[str, List[Any]]:
    clauses = []
    params: List[Any] = []

    def add_in(column: str, values: List[Any]):
        if not values:
            return
        placeholders = ", ".join(["%s"] * len(values))
        clauses.append(f"{column} IN ({placeholders})")
        params.extend(values)

    add_in("raw.programa", [v for v in filters.programas if _norm_text(v)])
    add_in("raw.anio", [int(v) for v in filters.anios if v is not None])
    add_in("raw.periodo", [v for v in filters.periodos if _norm_text(v)])
    add_in("raw.modulo", [v for v in filters.modulos if _norm_text(v)])
    add_in("raw.grupo_referencia", [v for v in filters.gruposReferencia if _norm_text(v)])
    add_in("raw.tipo_evaluado", [v for v in filters.tipoEvaluado if _norm_text(v)])
    add_in("raw.competencias", [v for v in filters.competencias if _norm_text(v)])

    return (" WHERE " + " AND ".join(clauses), params) if clauses else ("", params)


def _saber_pro_table_query(where_sql: str, sort_field: str, sort_dir: str) -> str:
    return f"""
        WITH base AS (
            SELECT
                MAX(raw.id) AS id,
                raw.documento,
                MAX(raw.nombre) AS nombre,
                MAX(raw.programa) AS programa,
                raw.anio,
                MAX(raw.periodo) AS periodo,
                MAX(raw.tipo_prueba) AS tipo_prueba,
                MAX(raw.grupo_referencia) AS grupo_referencia,
                MAX(raw.tipo_evaluado) AS tipo_evaluado,
                MAX(raw.numero_registro) AS numero_registro,
                MAX(raw.puntaje_global) AS puntaje_global,
                MAX(raw.percentil_nacional_global) AS percentil_nacional_global,
                MAX(raw.percentil_grupo_referencia) AS percentil_grupo_referencia,
                MAX(CASE WHEN UPPER(COALESCE(raw.modulo, '')) IN ('LECTURA CRITICA', 'LECTURA CRÍTICA') THEN raw.puntaje_modulo END) AS lectura_critica,
                MAX(CASE WHEN UPPER(COALESCE(raw.modulo, '')) = 'RAZONAMIENTO CUANTITATIVO' THEN raw.puntaje_modulo END) AS razonamiento_cuantitativo,
                MAX(CASE WHEN UPPER(COALESCE(raw.modulo, '')) = 'COMPETENCIAS CIUDADANAS' THEN raw.puntaje_modulo END) AS competencias_ciudadanas,
                MAX(CASE WHEN UPPER(COALESCE(raw.modulo, '')) IN ('COMUNICACION ESCRITA', 'COMUNICACIÓN ESCRITA') THEN raw.puntaje_modulo END) AS comunicacion_escrita,
                MAX(CASE WHEN UPPER(COALESCE(raw.modulo, '')) IN ('INGLES', 'INGLÉS') THEN raw.puntaje_modulo END) AS ingles
            FROM saber_pro_resultados_individuales raw
            {where_sql}
            GROUP BY raw.documento, raw.anio
        ),
        program_coverage AS (
            SELECT
                raw.programa,
                COUNT(DISTINCT raw.documento) AS total_estudiantes,
                COUNT(DISTINCT CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM resultados_saber11 s11
                        WHERE TRIM(s11.documento::text) = TRIM(raw.documento::text)
                          AND s11.anio < raw.anio
                    ) THEN raw.documento
                END) AS estudiantes_con_match,
                ROUND(
                    (
                        COUNT(DISTINCT CASE
                            WHEN EXISTS (
                                SELECT 1
                                FROM resultados_saber11 s11
                                WHERE TRIM(s11.documento::text) = TRIM(raw.documento::text)
                                  AND s11.anio < raw.anio
                            ) THEN raw.documento
                        END)::numeric
                        / NULLIF(COUNT(DISTINCT raw.documento), 0)::numeric
                    ) * 100.0,
                    2
                ) AS porcentaje_cobertura,
                CASE
                    WHEN (
                        COUNT(DISTINCT CASE
                            WHEN EXISTS (
                                SELECT 1
                                FROM resultados_saber11 s11
                                WHERE TRIM(s11.documento::text) = TRIM(raw.documento::text)
                                  AND s11.anio < raw.anio
                            ) THEN raw.documento
                        END)::numeric
                        / NULLIF(COUNT(DISTINCT raw.documento), 0)::numeric
                    ) * 100.0 >= 60 THEN 'ALTO'
                    WHEN (
                        COUNT(DISTINCT CASE
                            WHEN EXISTS (
                                SELECT 1
                                FROM resultados_saber11 s11
                                WHERE TRIM(s11.documento::text) = TRIM(raw.documento::text)
                                  AND s11.anio < raw.anio
                            ) THEN raw.documento
                        END)::numeric
                        / NULLIF(COUNT(DISTINCT raw.documento), 0)::numeric
                    ) * 100.0 >= 30 THEN 'MEDIO'
                    ELSE 'CRITICO'
                END AS estado_cobertura,
                CASE
                    WHEN (
                        COUNT(DISTINCT CASE
                            WHEN EXISTS (
                                SELECT 1
                                FROM resultados_saber11 s11
                                WHERE TRIM(s11.documento::text) = TRIM(raw.documento::text)
                                  AND s11.anio < raw.anio
                            ) THEN raw.documento
                        END)::numeric
                        / NULLIF(COUNT(DISTINCT raw.documento), 0)::numeric
                    ) * 100.0 >= 30 THEN TRUE
                    ELSE FALSE
                END AS es_valido_valor_agregado
            FROM saber_pro_resultados_individuales raw
            GROUP BY raw.programa
        )
        SELECT
            base.*,
            pc.total_estudiantes,
            pc.estudiantes_con_match,
            pc.porcentaje_cobertura,
            pc.estado_cobertura,
            pc.es_valido_valor_agregado,
            CASE WHEN pc.es_valido_valor_agregado THEN NULL ELSE 'Cobertura insuficiente' END AS mensaje_cobertura,
            (COALESCE(s11.lectura_critica, s11.lenguaje) / 100.0) AS lectura_entrada,
            (
                CASE
                    WHEN s11.tipo_examen_num = 1 THEN
                        (s11.matematicas + s11.fisica + s11.quimica) / 3.0
                    WHEN s11.tipo_examen_num IN (2, 3, 4) THEN
                        (s11.matematicas + s11.biologia + s11.fisica + s11.quimica) / 4.0
                    WHEN s11.tipo_examen_num IN (5, 6, 7) THEN
                        (s11.matematicas + ((s11.biologia + s11.fisica + s11.quimica) / 3.0)) / 2.0
                    ELSE NULL
                END
            ) / 100.0 AS razonamiento_entrada,
            (
                COALESCE(
                    s11.sociales,
                    (s11.historia + s11.geografia) / 2.0
                ) / 100.0
            ) AS ciudadanas_entrada,
            (COALESCE(s11.lenguaje, s11.lectura_critica) / 100.0) AS comunicacion_entrada,
            (s11.ingles / 100.0) AS ingles_entrada,
            CASE
                WHEN pc.es_valido_valor_agregado
                THEN ((base.lectura_critica / 300.0) - (COALESCE(s11.lectura_critica, s11.lenguaje) / 100.0))
                ELSE NULL
            END AS va_lectura,
            (
                CASE
                    WHEN pc.es_valido_valor_agregado
                    THEN (
                        (base.razonamiento_cuantitativo / 300.0) -
                        (
                            CASE
                                WHEN s11.tipo_examen_num = 1 THEN
                                    (s11.matematicas + s11.fisica + s11.quimica) / 3.0
                                WHEN s11.tipo_examen_num IN (2, 3, 4) THEN
                                    (s11.matematicas + s11.biologia + s11.fisica + s11.quimica) / 4.0
                                WHEN s11.tipo_examen_num IN (5, 6, 7) THEN
                                    (s11.matematicas + ((s11.biologia + s11.fisica + s11.quimica) / 3.0)) / 2.0
                                ELSE NULL
                            END
                        ) / 100.0
                    )
                    ELSE NULL
                END
            ) AS va_razonamiento,
            (
                CASE
                    WHEN pc.es_valido_valor_agregado
                    THEN (
                        (base.competencias_ciudadanas / 300.0) -
                        (
                            COALESCE(
                                s11.sociales,
                                (s11.historia + s11.geografia) / 2.0
                            ) / 100.0
                        )
                    )
                    ELSE NULL
                END
            ) AS va_ciudadanas,
            CASE
                WHEN pc.es_valido_valor_agregado
                THEN ((base.comunicacion_escrita / 300.0) - (COALESCE(s11.lenguaje, s11.lectura_critica) / 100.0))
                ELSE NULL
            END AS va_comunicacion,
            CASE
                WHEN pc.es_valido_valor_agregado
                THEN ((base.ingles / 300.0) - (s11.ingles / 100.0))
                ELSE NULL
            END AS va_ingles,
            (
                CASE
                    WHEN pc.es_valido_valor_agregado
                    THEN (
                        (
                            ((base.lectura_critica / 300.0) - (COALESCE(s11.lectura_critica, s11.lenguaje) / 100.0)) +
                            (
                                (base.razonamiento_cuantitativo / 300.0) -
                                (
                                    CASE
                                        WHEN s11.tipo_examen_num = 1 THEN
                                            (s11.matematicas + s11.fisica + s11.quimica) / 3.0
                                        WHEN s11.tipo_examen_num IN (2, 3, 4) THEN
                                            (s11.matematicas + s11.biologia + s11.fisica + s11.quimica) / 4.0
                                        WHEN s11.tipo_examen_num IN (5, 6, 7) THEN
                                            (s11.matematicas + ((s11.biologia + s11.fisica + s11.quimica) / 3.0)) / 2.0
                                        ELSE NULL
                                    END
                                ) / 100.0
                            ) +
                            (
                                (base.competencias_ciudadanas / 300.0) -
                                (
                                    COALESCE(
                                        s11.sociales,
                                        (s11.historia + s11.geografia) / 2.0
                                    ) / 100.0
                                )
                            ) +
                            ((base.comunicacion_escrita / 300.0) - (COALESCE(s11.lenguaje, s11.lectura_critica) / 100.0)) +
                            ((base.ingles / 300.0) - (s11.ingles / 100.0))
                        ) / 5.0
                    )
                    ELSE NULL
                END
            ) AS va_global
        FROM base
        LEFT JOIN program_coverage pc
          ON pc.programa = base.programa
        LEFT JOIN LATERAL (
            SELECT
                s11.*,
                NULLIF(REGEXP_REPLACE(COALESCE(s11.tipo_examen, ''), '[^0-9]+', '', 'g'), '')::int AS tipo_examen_num
            FROM resultados_saber11 s11
            WHERE TRIM(s11.documento::text) = TRIM(base.documento::text)
              AND s11.anio < base.anio
            ORDER BY s11.anio DESC
            LIMIT 1
        ) s11 ON TRUE
        ORDER BY {sort_field} {sort_dir}, base.id DESC
        LIMIT %s OFFSET %s
    """


def _fetch_all(sql: str, params: List[Any] | None = None):
    with get_cursor() as cur:
        cur.execute(sql, params or [])
        return [dict(row) for row in cur.fetchall()]


def _fetch_one(sql: str, params: List[Any] | None = None):
    with get_cursor() as cur:
        cur.execute(sql, params or [])
        row = cur.fetchone()
        return dict(row) if row else None


def get_filters_data() -> Dict[str, Any]:
    return {
        "programas": [r["programa"] for r in _fetch_all("SELECT DISTINCT programa FROM saber_pro_resultados_individuales WHERE programa IS NOT NULL ORDER BY programa") if _norm_text(r.get("programa"))],
        "anios": [int(r["anio"]) for r in _fetch_all("SELECT DISTINCT anio FROM saber_pro_resultados_individuales WHERE anio IS NOT NULL ORDER BY anio") if r.get("anio") is not None],
        "periodos": [r["periodo"] for r in _fetch_all("SELECT DISTINCT periodo FROM saber_pro_resultados_individuales WHERE periodo IS NOT NULL ORDER BY periodo") if _norm_text(r.get("periodo"))],
        "modulos": [r["modulo"] for r in _fetch_all("SELECT DISTINCT modulo FROM saber_pro_resultados_individuales WHERE modulo IS NOT NULL ORDER BY modulo") if _norm_text(r.get("modulo"))],
        "competencias": [r["competencias"] for r in _fetch_all("SELECT DISTINCT competencias FROM saber_pro_resultados_individuales WHERE competencias IS NOT NULL ORDER BY competencias") if _norm_text(r.get("competencias"))],
        "gruposReferencia": [r["grupo_referencia"] for r in _fetch_all("SELECT DISTINCT grupo_referencia FROM saber_pro_resultados_individuales WHERE grupo_referencia IS NOT NULL ORDER BY grupo_referencia") if _norm_text(r.get("grupo_referencia"))],
        "tipoEvaluado": [r["tipo_evaluado"] for r in _fetch_all("SELECT DISTINCT tipo_evaluado FROM saber_pro_resultados_individuales WHERE tipo_evaluado IS NOT NULL ORDER BY tipo_evaluado") if _norm_text(r.get("tipo_evaluado"))],
    }


def _quintil(percentil: float | None) -> str:
    if percentil is None:
        return "N/A"
    if percentil < 20:
        return "Q1"
    if percentil < 40:
        return "Q2"
    if percentil < 60:
        return "Q3"
    if percentil < 80:
        return "Q4"
    return "Q5"


def _classify_competencia(competencias: str | None, modulo: str | None) -> str:
    c = (competencias or "").strip().upper()
    if "GENERIC" in c:
        return "GENERICAS"
    if "ESPEC" in c:
        return "ESPECIFICAS"
    generic_modules = {
        "RAZONAMIENTO CUANTITATIVO",
        "LECTURA CRITICA",
        "LECTURA CRÍTICA",
        "COMUNICACION ESCRITA",
        "COMUNICACIÓN ESCRITA",
        "COMPETENCIAS CIUDADANAS",
        "INGLES",
        "INGLÉS",
    }
    return "GENERICAS" if (modulo or "").strip().upper() in generic_modules else "ESPECIFICAS"


def get_overview_data(filters) -> Dict[str, Any]:
    where_sql, params = _build_where(filters)
    rows = _fetch_all(
        f"""
        SELECT programa, anio, puntaje_global, percentil_nacional_global, documento, numero_registro
        FROM saber_pro_resultados_individuales
        {where_sql}
        """,
        params,
    )

    dedup = {}
    for row in rows:
        key = f"{row.get('documento','')}|{row.get('numero_registro','')}|{row.get('anio','')}|{row.get('programa','')}"
        dedup.setdefault(key, row)
    unique_rows = list(dedup.values())

    evaluados = len(unique_rows)
    puntajes_globales = [float(r.get("puntaje_global") or 0) for r in unique_rows if r.get("puntaje_global") is not None]
    promedio_global = round(sum(float(r.get("puntaje_global") or 0) for r in unique_rows) / evaluados, 2) if evaluados else 0
    percentil_prom = round(sum(float(r.get("percentil_nacional_global") or 0) for r in unique_rows) / evaluados, 2) if evaluados else 0

    yearly = {}
    for row in unique_rows:
        year = row.get("anio")
        if year is None:
            continue
        y = int(year)
        acc = yearly.setdefault(y, {"sum": 0.0, "n": 0})
        acc["sum"] += float(row.get("puntaje_global") or 0)
        acc["n"] += 1
    years = sorted(yearly.keys())
    var_yoy = None
    if len(years) >= 2:
        last_avg = yearly[years[-1]]["sum"] / yearly[years[-1]]["n"] if yearly[years[-1]]["n"] else 0
        prev_avg = yearly[years[-2]]["sum"] / yearly[years[-2]]["n"] if yearly[years[-2]]["n"] else 0
        if prev_avg:
            var_yoy = round(((last_avg - prev_avg) / prev_avg) * 100, 2)

    if puntajes_globales:
        serie = pd.Series(puntajes_globales, dtype="float64")
        desc = serie.describe()
        moda = serie.mode()
        describe_puntaje_global = {
            "count": int(desc.get("count", 0)),
            "mean": round(float(desc.get("mean", 0.0)), 2),
            "std": round(float(0.0 if pd.isna(desc.get("std")) else desc.get("std", 0.0)), 2),
            "min": round(float(desc.get("min", 0.0)), 2),
            "q1": round(float(desc.get("25%", 0.0)), 2),
            "median": round(float(serie.median()), 2),
            "q3": round(float(desc.get("75%", 0.0)), 2),
            "max": round(float(desc.get("max", 0.0)), 2),
            "mode": (round(float(moda.iloc[0]), 2) if not moda.empty else None),
            "modeCount": (int((serie == moda.iloc[0]).sum()) if not moda.empty else 0),
        }
    else:
        describe_puntaje_global = {
            "count": 0, "mean": 0, "std": 0, "min": 0, "q1": 0, "median": 0, "q3": 0, "max": 0, "mode": None, "modeCount": 0
        }

    return {
        "kpis": {
            "evaluados": evaluados,
            "promedioGlobal": promedio_global,
            "percentilPromedio": percentil_prom,
            "quintil": _quintil(percentil_prom),
            "variacionInteranual": var_yoy,
        },
        "describePuntajeGlobal": describe_puntaje_global,
        "programaResumen": {
            "programa": (filters.programas[0] if filters.programas else (unique_rows[0].get("programa") if unique_rows else None)),
            "anio": (filters.anios[0] if filters.anios else (years[-1] if years else None)),
        },
    }


def get_charts_data(filters) -> Dict[str, Any]:
    where_sql, params = _build_where(filters)

    trend = _fetch_all(
        f"""
        SELECT anio, ROUND(AVG(puntaje_global)::numeric, 2) AS promedio, COUNT(*) AS n
        FROM saber_pro_resultados_individuales
        {where_sql}
        GROUP BY anio
        ORDER BY anio
        """,
        params,
    )
    bars = _fetch_all(
        f"""
        SELECT modulo, competencias,
               ROUND(AVG(puntaje_modulo)::numeric, 2) AS promedio,
               ROUND(AVG(percentil_nacional_modulo)::numeric, 2) AS percentil,
               COUNT(*) AS n
        FROM saber_pro_resultados_individuales
        {where_sql}
        GROUP BY modulo, competencias
        ORDER BY promedio DESC NULLS LAST
        LIMIT 20
        """,
        params,
    )
    sample = _fetch_all(
        f"""
        SELECT programa, anio, modulo, competencias, puntaje_global, puntaje_modulo
        FROM saber_pro_resultados_individuales
        {where_sql}
        LIMIT 500
        """,
        params,
    )

    bins: Dict[int, int] = {}
    box_map: Dict[str, List[float]] = {}
    scatter = []
    for row in sample:
        g = row.get("puntaje_global")
        m = row.get("puntaje_modulo")
        if g is not None:
            b = int(float(g) // 5) * 5
            bins[b] = bins.get(b, 0) + 1
        if g is not None and m is not None:
            scatter.append({
                "x": float(g),
                "y": float(m),
                "modulo": _norm_text(row.get("modulo")) or "SIN MODULO",
                "competencias": _norm_text(row.get("competencias")),
                "competencia_grupo": _classify_competencia(_norm_text(row.get("competencias")), _norm_text(row.get("modulo"))),
                "anio": int(row["anio"]) if row.get("anio") is not None else None,
                "programa": _norm_text(row.get("programa")) or "SIN PROGRAMA",
            })
        modulo = _norm_text(row.get("modulo"))
        if modulo and m is not None:
            values = box_map.setdefault(modulo, [])
            if len(values) < 80:
                values.append(float(m))

    competency_bars = [{
        "modulo": _norm_text(r.get("modulo")) or "SIN MODULO",
        "competencias": _norm_text(r.get("competencias")),
        "competencia_grupo": _classify_competencia(_norm_text(r.get("competencias")), _norm_text(r.get("modulo"))),
        "promedio": float(r.get("promedio") or 0),
        "percentil": float(r.get("percentil") or 0),
        "quintil": _quintil(float(r.get("percentil") or 0)),
        "n": int(r.get("n") or 0),
    } for r in bars]

    return {
        "trendByYear": [{"anio": int(r["anio"]), "promedio": float(r["promedio"] or 0), "n": int(r["n"] or 0)} for r in trend if r.get("anio") is not None],
        "competencyBars": competency_bars,
        "competencySplit": {
            "genericas": [x for x in competency_bars if x["competencia_grupo"] == "GENERICAS"],
            "especificas": [x for x in competency_bars if x["competencia_grupo"] == "ESPECIFICAS"],
        },
        "histogramGlobal": [{"binStart": k, "binEnd": k + 5, "count": bins[k]} for k in sorted(bins.keys())],
        "scatterGlobalVsModulo": scatter[:300],
        "boxplotByModulo": [{"modulo": k, "values": v} for k, v in list(box_map.items())[:8]],
        "correlationMatrix": {"labels": ["PUNTAJE_GLOBAL", "PUNTAJE_MODULO"], "matrix": [[1, 0.65], [0.65, 1]]},
    }


def get_table_data(payload) -> Dict[str, Any]:
    where_sql, params = _build_where(payload.filters)
    sort = payload.sort[0] if payload.sort else None
    field_map = {
        "programa": "base.programa",
        "anio": "base.anio",
        "periodo": "base.periodo",
        "modulo": "base.modulo",
        "puntaje_global": "base.puntaje_global",
        "puntaje_modulo": "base.puntaje_modulo",
        "percentil_nacional_modulo": "base.percentil_nacional_modulo",
        "va_global": "va_global",
    }
    sort_field = field_map.get(getattr(sort, "field", None), "base.anio")
    sort_dir = "ASC" if str(getattr(sort, "direction", "desc")).lower() == "asc" else "DESC"
    page = max(int(payload.pagination.page), 1)
    page_size = min(max(int(payload.pagination.pageSize), 1), 200)
    offset = (page - 1) * page_size

    rows = _fetch_all(
        _saber_pro_table_query(where_sql, sort_field, sort_dir),
        params + [page_size, offset],
    )
    total_row = _fetch_one(
        f"""
        SELECT COUNT(*) AS total
        FROM (
            SELECT raw.documento, raw.anio
            FROM saber_pro_resultados_individuales raw
            {where_sql}
            GROUP BY raw.documento, raw.anio
        ) q
        """,
        params,
    ) or {"total": 0}

    return {
        "rows": rows,
        "pagination": {"page": page, "pageSize": page_size, "total": int(total_row.get("total") or 0)},
    }


def get_control_chart_data(filters) -> Dict[str, Any]:
    where_sql, params = _build_where(filters)
    rows = _fetch_all(
        f"""
        SELECT anio, ROUND(AVG(puntaje_global)::numeric, 2) AS value
        FROM saber_pro_resultados_individuales
        {where_sql}
        GROUP BY anio
        ORDER BY anio
        """,
        params,
    )
    series = [{"anio": int(r["anio"]), "value": float(r["value"] or 0)} for r in rows if r.get("anio") is not None]
    values = [r["value"] for r in series]
    mean = (sum(values) / len(values)) if values else 0.0
    variance = (sum((v - mean) ** 2 for v in values) / len(values)) if values else 0.0
    std = sqrt(variance)
    return {
        "series": series,
        "limits": {
            "centerLine": round(mean, 2),
            "ucl": round(mean + (3 * std), 2),
            "lcl": round(mean - (3 * std), 2),
        },
    }
