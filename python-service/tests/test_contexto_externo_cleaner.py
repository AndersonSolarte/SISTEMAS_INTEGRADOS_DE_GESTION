import io
import unittest

import pandas as pd
from openpyxl import Workbook

from app.services.contexto_externo_cleaner import (
    CleaningError,
    LIST_CONFIG,
    clean_contexto_externo_file,
)


class ContextoExternoCleanerTests(unittest.TestCase):
    def test_preserves_semantic_duplicates_and_template(self):
        headers = LIST_CONFIG["INSCRITOS_CONTEXTO_EXTERNO"]
        first = {header: "" for header in headers}
        first.update({
            "CODIGO DE LA INSTITUCION": "101",
            "PROGRAMA ACADEMICO": "Administración, de Empresas.",
            "ANO": 2025,
            "SEMESTRE": 1,
            "INSCRITOS": 25,
        })
        second = dict(first)
        second["PROGRAMA ACADEMICO"] = "  Administracion de   Empresas "
        content = pd.DataFrame([first, second]).to_csv(index=False).encode("utf-8")

        result = clean_contexto_externo_file(
            content,
            "entrada.csv",
            "INSCRITOS CONTEXTO EXTERNO",
        )
        output = pd.read_excel(io.BytesIO(result.content))

        self.assertEqual(result.input_rows, 2)
        self.assertEqual(result.output_rows, 2)
        self.assertEqual(result.duplicates_removed, 0)
        self.assertEqual(list(output.columns), headers)

    def test_rejects_unrelated_structure(self):
        content = pd.DataFrame([{"COLUMNA DESCONOCIDA": "dato"}]).to_csv(index=False).encode("utf-8")
        with self.assertRaises(CleaningError):
            clean_contexto_externo_file(content, "entrada.csv", "GRADUADOS CONTEXTO EXTERNO")

    def test_streams_xlsx_and_canonicalizes_values_by_code(self):
        headers = LIST_CONFIG["MATRICULADOS_CONTEXTO_EXTERNO"]
        first = {header: "" for header in headers}
        first.update({
            "CODIGO DE LA INSTITUCION": "1110",
            "IES PADRE": "1110",
            "INSTITUCION DE EDUCACION SUPERIOR (IES)": "Universidad del Cauca",
            "CODIGO DEL MUNICIPIO IES": "19001",
            "MUNICIPIO DE DOMICILIO DE LA IES": "POPAYAN",
            "CODIGO SNIES DEL PROGRAMA": "222",
            "PROGRAMA ACADEMICO": "Geotecnología",
            "ANO": "2024-1",
            "SEMESTRE": 1,
            "MATRICULADOS": 69,
        })
        second = dict(first)
        second["MUNICIPIO DE DOMICILIO DE LA IES"] = "POPAYÁN"

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "MATRICUALDOS"
        sheet.append(headers)
        sheet.append([first[header] for header in headers])
        sheet.append([second[header] for header in headers])
        source = io.BytesIO()
        workbook.save(source)

        result = clean_contexto_externo_file(
            source.getvalue(),
            "matriculados.xlsx",
            "MATRICULADOS CONTEXTO EXTERNO",
        )
        output_book = pd.ExcelFile(io.BytesIO(result.content))
        output = pd.read_excel(output_book, sheet_name="MATRICULADOS_CONTEXTO_EXTERNO"[:31])
        report = pd.read_excel(output_book, sheet_name="REPORTE_NORMALIZACION")

        self.assertEqual(result.input_rows, 2)
        self.assertEqual(result.output_rows, 2)
        self.assertEqual(result.duplicates_removed, 0)
        self.assertGreaterEqual(result.corrections_count, 1)
        self.assertEqual(output.iloc[0]["MUNICIPIO DE DOMICILIO DE LA IES"], "POPAYÁN")
        self.assertIn("CANONIZACION_POR_CODIGO", set(report["MOTIVO"]))

    def test_normalizes_orthographic_variants_globally_without_removing_rows(self):
        headers = LIST_CONFIG["PRIMER_CURSO_CONTEXTO_EXTERNO"]
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(headers)
        variants = [
            ("1001", "ADMINISTRACION DE EMPRESAS"),
            ("1002", "ADMINISTRACION DE EMPRESAS"),
            ("1003", "ADMINISTRACION DE EMPRESAS"),
            ("1004", "ADMINISTRACI\u00d3N DE EMPRESAS"),
            ("2001", "TECNOLOGIA EN DESARROLLO DE SOFTWARE"),
            ("2002", "TECNOLOG\u00cdA EN DESARROLLO DE SOFTWARE"),
            ("2003", "TECNOLOG\u00cdA EN DESARROLLO DE SOFTWARE"),
            ("2004", "T\u00c9CNOLOGIA EN DESARROLLO DE SOFTWARE"),
        ]
        for code, program in variants:
            row = {header: "" for header in headers}
            row.update({
                "CODIGO DE LA INSTITUCION": "101",
                "CODIGO SNIES DEL PROGRAMA": code,
                "PROGRAMA ACADEMICO": program,
                "ANO": 2025,
                "SEMESTRE": 1,
                "PRIMER CURSO": 1,
            })
            sheet.append([row[header] for header in headers])
        source = io.BytesIO()
        workbook.save(source)

        result = clean_contexto_externo_file(
            source.getvalue(),
            "primer_curso.xlsx",
            "PRIMER CURSO CONTEXTO EXTERNO",
        )
        output_book = pd.ExcelFile(io.BytesIO(result.content))
        output = pd.read_excel(output_book, sheet_name="PRIMER_CURSO_CONTEXTO_EXTERNO"[:31])
        report = pd.read_excel(output_book, sheet_name="REPORTE_NORMALIZACION")

        self.assertEqual(result.input_rows, 8)
        self.assertEqual(result.output_rows, 8)
        self.assertEqual(result.duplicates_removed, 0)
        self.assertEqual(
            set(output["PROGRAMA ACADEMICO"]),
            {"ADMINISTRACI\u00d3N DE EMPRESAS", "TECNOLOG\u00cdA EN DESARROLLO DE SOFTWARE"},
        )
        self.assertIn("NORMALIZACION_ORTOGRAFICA", set(report["MOTIVO"]))


if __name__ == "__main__":
    unittest.main()
