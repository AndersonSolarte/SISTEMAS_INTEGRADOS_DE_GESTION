from __future__ import annotations

import io
import hashlib
import os
import re
import sqlite3
import tempfile
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Any, BinaryIO

import pandas as pd
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill


TABULAR_BASE_HEADERS = [
    "CODIGO DE LA INSTITUCION", "IES PADRE", "INSTITUCION DE EDUCACION SUPERIOR (IES)",
    "TIPO IES", "ID SECTOR IES", "SECTOR IES", "ID CARACTER IES", "CARACTER IES",
    "CODIGO DEL DEPARTAMENTO (IES)", "DEPARTAMENTO DE DOMICILIO DE LA IES",
    "CODIGO DEL MUNICIPIO IES", "MUNICIPIO DE DOMICILIO DE LA IES", "IES ACREDITADA",
    "CODIGO SNIES DEL PROGRAMA", "PROGRAMA ACADEMICO", "PROGRAMA ACREDITADO",
    "ID NIVEL ACADEMICO", "NIVEL ACADEMICO", "ID NIVEL DE FORMACION", "NIVEL DE FORMACION",
    "ID MODALIDAD", "MODALIDAD", "ID AREA", "AREA DE CONOCIMIENTO", "ID NUCLEO",
    "NUCLEO BASICO DEL CONOCIMIENTO (NBC)", "ID CINE CAMPO AMPLIO", "DESC CINE CAMPO AMPLIO",
    "ID CINE CAMPO ESPECIFICO", "DESC CINE CAMPO ESPECIFICO", "ID CINE CAMPO DETALLADO",
    "DESC CINE CAMPO DETALLADO", "CODIGO DEL DEPARTAMENTO (PROGRAMA)",
    "DEPARTAMENTO DE OFERTA DEL PROGRAMA", "CODIGO DEL MUNICIPIO (PROGRAMA)",
    "MUNICIPIO DE OFERTA DEL PROGRAMA", "ID SEXO", "SEXO", "ANO", "SEMESTRE",
]

PROGRAM_HEADERS = [
    "CODIGO_INSTITUCION_PADRE", "CODIGO_INSTITUCION", "NOMBRE_INSTITUCION", "ESTADO_INSTITUCION",
    "CARACTER_ACADEMICO", "SECTOR", "REGISTRO_UNICO", "CODIGO_SNIES_DEL_PROGRAMA",
    "CODIGO_ANTERIOR_ICFES", "NOMBRE_DEL_PROGRAMA", "TITULO_OTORGADO", "ESTADO_PROGRAMA",
    "JUSTIFICACION", "JUSTIFICACION_DETALLADA", "RECONOCIMIENTO_DEL_MINISTERIO",
    "RESOLUCION_DE_APROBACION", "FECHA_DE_RESOLUCION", "FECHA_EJECUTORIA", "VIGENCIA_ANOS",
    "FECHA_DE_REGISTRO_EN_SNIES", "CINE_F_2013_AC_CAMPO_AMPLIO", "CINE_F_2013_AC_CAMPO_ESPECIFIC",
    "CINE_F_2013_AC_CAMPO_DETALLADO", "AREA_DE_CONOCIMIENTO", "NUCLEO_BASICO_DEL_CONOCIMIENTO",
    "NIVEL_ACADEMICO", "NIVEL_DE_FORMACION", "MODALIDAD", "NUMERO_CREDITOS",
    "NUMERO_PERIODOS_DE_DURACION", "PERIODICIDAD", "SE_OFRECE_POR_CICLOS_PROPEDUT",
    "PERIODICIDAD_ADMISIONES", "PROGRAMA_EN_CONVENIO", "DEPARTAMENTO_OFERTA_PROGRAMA",
    "MUNICIPIO_OFERTA_PROGRAMA", "COSTO_MATRICULA_ESTUD_NUEVOS", "VIGENCIA_TRANSITORIA",
    "OBSERVACION_DECRETO_1174_23",
]

LIST_CONFIG = {
    "PROGRAMAS_CONTEXTO_EXTERNO": PROGRAM_HEADERS,
    "INSCRITOS_CONTEXTO_EXTERNO": [*TABULAR_BASE_HEADERS, "INSCRITOS"],
    "ADMITIDOS_CONTEXTO_EXTERNO": [*TABULAR_BASE_HEADERS, "ADMITIDOS"],
    "PRIMER_CURSO_CONTEXTO_EXTERNO": [*TABULAR_BASE_HEADERS, "PRIMER CURSO"],
    "MATRICULADOS_CONTEXTO_EXTERNO": [*TABULAR_BASE_HEADERS, "MATRICULADOS"],
    "GRADUADOS_CONTEXTO_EXTERNO": [*TABULAR_BASE_HEADERS, "GRADUADOS"],
}

HEADER_ALIASES = {
    "ANO": ["ANIO", "AÑO"],
    "SEMESTRE": ["PERIODO", "PERIODO ACADEMICO"],
    "PRIMER CURSO": ["PRIMER_CURSO", "PRIMERCURSO"],
    "CODIGO SNIES DEL PROGRAMA": ["CODIGO_SNIES_DEL_PROGRAMA", "CODIGO SNIES PROGRAMA"],
    "PROGRAMA ACADEMICO": ["NOMBRE_DEL_PROGRAMA", "NOMBRE PROGRAMA", "PROGRAMA"],
    "INSTITUCION DE EDUCACION SUPERIOR (IES)": ["NOMBRE_INSTITUCION", "INSTITUCION", "IES"],
    "TIPO IES": ["PRINCIPAL O SECCIONAL", "PRINCIPAL_O_SECCIONAL"],
    "ID CARACTER IES": ["ID CARACTER", "ID_CARACTER"],
    "ID MODALIDAD": ["ID METODOLOGIA", "ID_METODOLOGIA"],
    "MODALIDAD": ["METODOLOGIA"],
    "ID NUCLEO": ["ID_NUCLEO"],
    "ID CINE CAMPO DETALLADO": ["ID CINE CODIGO DETALLADO"],
    "DESC CINE CAMPO DETALLADO": ["DESC CINE CODIGO DETALLADO"],
}

NUMERIC_HEADERS = {
    "INSCRITOS", "ADMITIDOS", "PRIMER CURSO", "MATRICULADOS", "GRADUADOS",
    "NUMERO_CREDITOS", "NUMERO_PERIODOS_DE_DURACION", "COSTO_MATRICULA_ESTUD_NUEVOS",
}


class CleaningError(ValueError):
    pass


@dataclass
class CleaningResult:
    content: bytes
    input_rows: int
    output_rows: int
    duplicates_removed: int
    empty_rows_removed: int
    source_sheet: str
    matched_columns: int
    corrections_count: int = 0
    corrections: list[dict[str, Any]] | None = None


CANONICAL_RELATIONS = [
    ("IES PADRE", "INSTITUCION DE EDUCACION SUPERIOR (IES)", "IES"),
    ("ID SECTOR IES", "SECTOR IES", "SECTOR"),
    ("ID CARACTER IES", "CARACTER IES", "CARACTER_IES"),
    ("CODIGO DEL DEPARTAMENTO (IES)", "DEPARTAMENTO DE DOMICILIO DE LA IES", "DEPARTAMENTO"),
    ("CODIGO DEL MUNICIPIO IES", "MUNICIPIO DE DOMICILIO DE LA IES", "MUNICIPIO"),
    ("CODIGO SNIES DEL PROGRAMA", "PROGRAMA ACADEMICO", "PROGRAMA"),
    ("ID NIVEL ACADEMICO", "NIVEL ACADEMICO", "NIVEL_ACADEMICO"),
    ("ID NIVEL DE FORMACION", "NIVEL DE FORMACION", "NIVEL_FORMACION"),
    ("ID MODALIDAD", "MODALIDAD", "MODALIDAD"),
    ("ID AREA", "AREA DE CONOCIMIENTO", "AREA_CONOCIMIENTO"),
    ("ID NUCLEO", "NUCLEO BASICO DEL CONOCIMIENTO (NBC)", "NUCLEO_BASICO"),
    ("ID CINE CAMPO AMPLIO", "DESC CINE CAMPO AMPLIO", "CINE_AMPLIO"),
    ("ID CINE CAMPO ESPECIFICO", "DESC CINE CAMPO ESPECIFICO", "CINE_ESPECIFICO"),
    ("ID CINE CAMPO DETALLADO", "DESC CINE CAMPO DETALLADO", "CINE_DETALLADO"),
    ("CODIGO DEL DEPARTAMENTO (PROGRAMA)", "DEPARTAMENTO DE OFERTA DEL PROGRAMA", "DEPARTAMENTO"),
    ("CODIGO DEL MUNICIPIO (PROGRAMA)", "MUNICIPIO DE OFERTA DEL PROGRAMA", "MUNICIPIO"),
    ("ID SEXO", "SEXO", "SEXO"),
]


def normalize_key(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.upper().replace("Ñ", "N")
    return re.sub(r"[^A-Z0-9]+", "_", text).strip("_")


def clean_visible_value(value: Any) -> Any:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    if not isinstance(value, str):
        return value
    text = unicodedata.normalize("NFC", value)
    text = "".join(char for char in text if unicodedata.category(char) not in {"Cc", "Cf"})
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s*([,;:.])\s*", r"\1 ", text).strip()
    return text.rstrip(" ,;:.")


def comparison_value(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        numeric = float(value)
        return str(int(numeric)) if numeric.is_integer() else f"{numeric:.12g}"
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^A-Z0-9]+", "", text.upper())


def _read_csv(content: bytes) -> list[tuple[str, pd.DataFrame]]:
    last_error: Exception | None = None
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            frame = pd.read_csv(io.BytesIO(content), dtype=object, sep=None, engine="python", encoding=encoding)
            return [("CSV", frame)]
        except Exception as exc:  # pragma: no cover - only reached for malformed encodings
            last_error = exc
    raise CleaningError(f"No fue posible leer el archivo CSV: {last_error}")


def _read_excel(content: bytes, extension: str) -> list[tuple[str, pd.DataFrame]]:
    try:
        book = pd.ExcelFile(io.BytesIO(content), engine="xlrd" if extension == ".xls" else "openpyxl")
        frames: list[tuple[str, pd.DataFrame]] = []
        for sheet in book.sheet_names:
            raw = pd.read_excel(book, sheet_name=sheet, header=None, dtype=object)
            frames.append((str(sheet), raw))
        return frames
    except Exception as exc:
        raise CleaningError(f"No fue posible leer el archivo Excel: {exc}") from exc


def _candidate_frames(content: bytes, extension: str) -> list[tuple[str, int, pd.DataFrame]]:
    if extension == ".csv":
        return [("CSV", 0, frame) for _, frame in _read_csv(content)]

    candidates: list[tuple[str, int, pd.DataFrame]] = []
    for sheet, raw in _read_excel(content, extension):
        if raw.empty:
            continue
        for header_index in range(min(25, len(raw.index))):
            header = [clean_visible_value(value) for value in raw.iloc[header_index].tolist()]
            frame = raw.iloc[header_index + 1 :].copy()
            frame.columns = header
            candidates.append((sheet, header_index, frame))
    return candidates


def _column_lookup(frame: pd.DataFrame) -> dict[str, Any]:
    lookup: dict[str, Any] = {}
    for column in frame.columns:
        key = normalize_key(column)
        if key and key not in lookup:
            lookup[key] = column
    return lookup


def _resolve_columns(frame: pd.DataFrame, required_headers: list[str]) -> dict[str, Any]:
    lookup = _column_lookup(frame)
    resolved: dict[str, Any] = {}
    for header in required_headers:
        aliases = [header, *HEADER_ALIASES.get(header, [])]
        source = next((lookup.get(normalize_key(alias)) for alias in aliases if lookup.get(normalize_key(alias)) is not None), None)
        if source is not None:
            resolved[header] = source
    return resolved


def _select_source(content: bytes, extension: str, required_headers: list[str]) -> tuple[str, pd.DataFrame, dict[str, Any]]:
    best: tuple[int, str, pd.DataFrame, dict[str, Any]] | None = None
    for sheet, _, frame in _candidate_frames(content, extension):
        resolved = _resolve_columns(frame, required_headers)
        score = len(resolved)
        if best is None or score > best[0]:
            best = (score, sheet, frame, resolved)
    if not best or best[0] == 0:
        raise CleaningError("No se reconocieron columnas compatibles con la lista seleccionada.")

    minimum = max(2, int(len(required_headers) * 0.35))
    if best[0] < minimum:
        missing = [header for header in required_headers if header not in best[3]][:8]
        raise CleaningError(
            f"La estructura no corresponde a la lista seleccionada. Solo se reconocieron {best[0]} de "
            f"{len(required_headers)} columnas. Faltan, entre otras: {', '.join(missing)}."
        )
    return best[1], best[2], best[3]


def _rules_index(rules: list[dict[str, Any]] | None) -> dict[tuple[str, str], str]:
    index: dict[tuple[str, str], str] = {}
    for rule in sorted(rules or [], key=lambda item: int(item.get("prioridad") or 100)):
        detected = comparison_value(rule.get("valor_detectado"))
        standard = clean_visible_value(rule.get("valor_estandar"))
        column = normalize_key(rule.get("columna") or "*")
        if detected and standard and (column, detected) not in index:
            index[(column, detected)] = standard
    return index


def _rule_scopes(header: str) -> list[str]:
    scopes = [normalize_key(header)]
    for _, value_header, scope in CANONICAL_RELATIONS:
        if value_header == header:
            scopes.append(normalize_key(scope))
    scopes.append("*")
    return list(dict.fromkeys(scopes))


def _apply_rule(header: str, value: Any, rules: dict[tuple[str, str], str]) -> Any:
    detected = comparison_value(value)
    if not detected:
        return value
    for scope in _rule_scopes(header):
        standard = rules.get((scope, detected))
        if standard not in (None, ""):
            return standard
    return value


def _quality_score(value: str) -> tuple[int, int, int, int]:
    text = str(value or "")
    letters = sum(char.isalpha() for char in text)
    suspicious = len(re.findall(r"(.)\1{2,}", text, flags=re.IGNORECASE))
    accents = sum(unicodedata.normalize("NFD", char) != char for char in text)
    return (-suspicious, accents, letters, -len(text))


def _choose_canonical(counter: Counter) -> str:
    semantic_counts: Counter = Counter()
    variants: dict[str, Counter] = defaultdict(Counter)
    for value, count in counter.items():
        key = comparison_value(value)
        if not key:
            continue
        semantic_counts[key] += count
        variants[key][value] += count
    if not semantic_counts:
        return ""
    best_key = max(semantic_counts, key=lambda key: (semantic_counts[key], max(_quality_score(v) for v in variants[key]), len(key)))
    return max(variants[best_key], key=lambda value: (variants[best_key][value], _quality_score(value)))


def _excel_source(value: bytes | BinaryIO) -> BinaryIO:
    if isinstance(value, (bytes, bytearray)):
        return io.BytesIO(value)
    value.seek(0)
    return value


def _find_excel_source(workbook, required_headers: list[str]):
    best = None
    for worksheet in workbook.worksheets:
        for header_index, row in enumerate(worksheet.iter_rows(min_row=1, max_row=25, values_only=True), start=1):
            lookup = {normalize_key(value): index for index, value in enumerate(row) if normalize_key(value)}
            resolved = {}
            for header in required_headers:
                aliases = [header, *HEADER_ALIASES.get(header, [])]
                source_index = next((lookup.get(normalize_key(alias)) for alias in aliases if normalize_key(alias) in lookup), None)
                if source_index is not None:
                    resolved[header] = source_index
            candidate = (len(resolved), worksheet, header_index, resolved)
            if best is None or candidate[0] > best[0]:
                best = candidate
    minimum = max(2, int(len(required_headers) * 0.35))
    if not best or best[0] < minimum:
        raise CleaningError("No se encontró una hoja con la estructura correspondiente a la lista seleccionada.")
    return best[1], best[2], best[3]


def _iter_excel_rows(worksheet, header_row: int, resolved: dict[str, int], headers: list[str], rules):
    for source_row in worksheet.iter_rows(min_row=header_row + 1, values_only=True):
        values = []
        originals = []
        for header in headers:
            index = resolved.get(header)
            original = source_row[index] if index is not None and index < len(source_row) else ""
            visible = clean_visible_value(original)
            values.append(_apply_rule(header, visible, rules))
            originals.append(original)
        yield originals, values


def _clean_excel_streaming(
    content: bytes | BinaryIO,
    required_headers: list[str],
    list_key: str,
    rules: list[dict[str, Any]] | None,
) -> CleaningResult:
    workbook = load_workbook(_excel_source(content), read_only=True, data_only=True)
    worksheet, header_row, resolved = _find_excel_source(workbook, required_headers)
    rule_index = _rules_index(rules)

    relation_candidates: dict[tuple[str, str], Counter] = defaultdict(Counter)
    input_rows = 0
    empty_rows = 0
    for _, values in _iter_excel_rows(worksheet, header_row, resolved, required_headers, rule_index):
        input_rows += 1
        row = dict(zip(required_headers, values))
        if not any(comparison_value(value) for value in values):
            empty_rows += 1
            continue
        for code_header, value_header, _ in CANONICAL_RELATIONS:
            code = comparison_value(row.get(code_header))
            value = clean_visible_value(row.get(value_header))
            if code and comparison_value(value):
                relation_candidates[(code_header, value_header, code)][value] += 1

    canonical = {key: _choose_canonical(counter) for key, counter in relation_candidates.items()}
    corrections: Counter = Counter()
    duplicates = 0
    output_rows = 0

    output_book = Workbook(write_only=True)
    data_sheet = output_book.create_sheet(list_key[:31])
    data_sheet.append(required_headers)
    report_sheet = output_book.create_sheet("REPORTE_NORMALIZACION")
    report_sheet.append(["COLUMNA", "CODIGO_REFERENCIA", "VALOR_DETECTADO", "VALOR_ESTANDAR", "MOTIVO", "OCURRENCIAS"])

    descriptor, dedupe_path = tempfile.mkstemp(prefix="contexto_externo_", suffix=".sqlite")
    os.close(descriptor)
    try:
        connection = sqlite3.connect(dedupe_path)
        connection.execute("CREATE TABLE seen (row_hash TEXT PRIMARY KEY)")

        for originals, values in _iter_excel_rows(worksheet, header_row, resolved, required_headers, rule_index):
            if not any(comparison_value(value) for value in values):
                continue
            row = dict(zip(required_headers, values))
            original_by_header = dict(zip(required_headers, originals))

            for code_header, value_header, scope in CANONICAL_RELATIONS:
                code = comparison_value(row.get(code_header))
                standard = canonical.get((code_header, value_header, code), "")
                current = clean_visible_value(row.get(value_header))
                if code and standard and str(current) != str(standard):
                    corrections[(scope, code, str(current), str(standard), "CANONIZACION_POR_CODIGO")] += 1
                    row[value_header] = standard

            for header in required_headers:
                original = clean_visible_value(original_by_header.get(header))
                final = row.get(header)
                if comparison_value(original) and str(original) != str(final):
                    reason = (
                        "NORMALIZACION_TECNICA"
                        if comparison_value(original) == comparison_value(final)
                        else "REGLA_DICCIONARIO"
                    )
                    corrections[(normalize_key(header), "", str(original), str(final), reason)] += 1

            output_values = [row.get(header, "") for header in required_headers]
            digest = hashlib.sha256("\x1f".join(comparison_value(value) for value in output_values).encode("utf-8")).hexdigest()
            try:
                connection.execute("INSERT INTO seen(row_hash) VALUES (?)", (digest,))
            except sqlite3.IntegrityError:
                duplicates += 1
                continue

            data_sheet.append(output_values)
            output_rows += 1
            if output_rows % 10000 == 0:
                connection.commit()

        connection.close()
    finally:
        try:
            os.unlink(dedupe_path)
        except OSError:
            pass

    correction_rows = [
        {
            "columna": column,
            "codigo_referencia": code,
            "valor_detectado": detected,
            "valor_estandar": standard,
            "motivo": reason,
            "ocurrencias": count,
        }
        for (column, code, detected, standard, reason), count in corrections.most_common()
    ]
    for item in correction_rows:
        report_sheet.append([
            item["columna"], item["codigo_referencia"], item["valor_detectado"],
            item["valor_estandar"], item["motivo"], item["ocurrencias"],
        ])

    buffer = io.BytesIO()
    output_book.save(buffer)
    workbook.close()
    return CleaningResult(
        content=buffer.getvalue(),
        input_rows=input_rows,
        output_rows=output_rows,
        duplicates_removed=duplicates,
        empty_rows_removed=empty_rows,
        source_sheet=worksheet.title,
        matched_columns=len(resolved),
        corrections_count=len(corrections),
        corrections=correction_rows,
    )


def clean_contexto_externo_file(
    content: bytes | BinaryIO,
    filename: str,
    list_name: str,
    rules: list[dict[str, Any]] | None = None,
) -> CleaningResult:
    list_key = normalize_key(list_name)
    required_headers = LIST_CONFIG.get(list_key)
    if not required_headers:
        raise CleaningError("La lista de Contexto Externo seleccionada no es válida.")

    extension_match = re.search(r"(\.xlsx|\.xls|\.csv)$", str(filename or ""), flags=re.IGNORECASE)
    if not extension_match:
        raise CleaningError("Solo se admiten archivos .xlsx, .xls o .csv.")
    extension = extension_match.group(1).lower()

    if extension == ".xlsx":
        return _clean_excel_streaming(content, required_headers, list_key, rules)

    if not isinstance(content, (bytes, bytearray)):
        content.seek(0)
        content = content.read()

    sheet, source, resolved = _select_source(content, extension, required_headers)
    output = pd.DataFrame({
        header: source[resolved[header]] if header in resolved else ""
        for header in required_headers
    })
    input_rows = len(output.index)
    output = output.map(clean_visible_value)

    nonempty_mask = output.apply(lambda row: any(comparison_value(value) for value in row), axis=1)
    empty_rows_removed = int((~nonempty_mask).sum())
    output = output.loc[nonempty_mask].copy()

    for header in NUMERIC_HEADERS.intersection(output.columns):
        output[header] = pd.to_numeric(output[header], errors="coerce").where(lambda series: series.notna(), "")

    comparison = output.map(comparison_value)
    duplicate_mask = comparison.duplicated(keep="first")
    duplicates_removed = int(duplicate_mask.sum())
    output = output.loc[~duplicate_mask].reset_index(drop=True)

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        output.to_excel(writer, index=False, sheet_name=list_key[:31])
        worksheet = writer.book[list_key[:31]]
        worksheet.freeze_panes = "A2"
        worksheet.auto_filter.ref = worksheet.dimensions
        for cell in worksheet[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill(fill_type="solid", fgColor="2563EB")
        for column_cells in worksheet.columns:
            width = min(45, max(12, max(len(str(cell.value or "")) for cell in list(column_cells)[:200]) + 2))
            worksheet.column_dimensions[column_cells[0].column_letter].width = width

    return CleaningResult(
        content=buffer.getvalue(),
        input_rows=input_rows,
        output_rows=len(output.index),
        duplicates_removed=duplicates_removed,
        empty_rows_removed=empty_rows_removed,
        source_sheet=sheet,
        matched_columns=len(resolved),
        corrections_count=0,
        corrections=[],
    )
