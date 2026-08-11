import io
import json
import re
import struct

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from ..services.contexto_externo_cleaner import CleaningError, clean_contexto_externo_file, normalize_key


router = APIRouter()


@router.post("/limpiar")
async def limpiar_contexto_externo(
    archivo: UploadFile = File(...),
    lista: str = Form(...),
    reglas: str = Form("[]"),
):
    try:
        parsed_rules = json.loads(reglas or "[]")
        if not isinstance(parsed_rules, list):
            parsed_rules = []
        await archivo.seek(0)
        first_byte = await archivo.read(1)
        if not first_byte:
            raise CleaningError("El archivo está vacío.")
        await archivo.seek(0)
        result = await run_in_threadpool(
            clean_contexto_externo_file,
            archivo.file,
            archivo.filename or "archivo.xlsx",
            lista,
            parsed_rules,
        )
    except CleaningError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible limpiar el archivo: {exc}") from exc
    finally:
        await archivo.close()

    safe_list = re.sub(r"[^a-z0-9_]+", "_", normalize_key(lista).lower()).strip("_")
    filename = f"contexto_externo_limpio_{safe_list}.xlsx"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "X-Input-Rows": str(result.input_rows),
        "X-Output-Rows": str(result.output_rows),
        "X-Duplicates-Removed": str(result.duplicates_removed),
        "X-Empty-Rows-Removed": str(result.empty_rows_removed),
        "X-Matched-Columns": str(result.matched_columns),
        "X-Corrections-Count": str(result.corrections_count),
        "X-Source-Sheet": result.source_sheet.encode("ascii", "ignore").decode("ascii")[:120],
    }
    metadata = json.dumps({
        "correcciones": result.corrections or [],
    }, ensure_ascii=False).encode("utf-8")
    envelope = b"CXCLN1" + struct.pack(">I", len(metadata)) + metadata + result.content
    return StreamingResponse(io.BytesIO(envelope), media_type="application/octet-stream", headers=headers)
