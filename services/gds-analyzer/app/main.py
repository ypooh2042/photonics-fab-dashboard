import tempfile
from pathlib import Path

from fastapi import FastAPI, UploadFile, HTTPException, Form
from pydantic import BaseModel

from app.gds import analyze_layers_and_svg, convert_negative_to_positive

app = FastAPI(title="fab-dashboard GDS analyzer")


class BBox(BaseModel):
    xmin: float
    ymin: float
    xmax: float
    ymax: float


class LayerArea(BaseModel):
    layer: int
    datatype: int
    area_um2: float
    bbox: BBox


class AnalyzeResponse(BaseModel):
    layers: list[LayerArea]
    svg: str
    overall_bbox: BBox


class GridBounds(BaseModel):
    leftUm: float
    bottomUm: float
    rightUm: float
    topUm: float


class ConvertPositiveResponse(BaseModel):
    layers: list[LayerArea]
    svg: str
    overall_bbox: BBox
    grid_bounds: GridBounds
    gds_base64: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(file: UploadFile):
    if not file.filename or not file.filename.lower().endswith((".gds", ".gds2", ".oas")):
        raise HTTPException(status_code=400, detail="expected a .gds/.gds2/.oas file")

    suffix = Path(file.filename).suffix
    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp.flush()
        try:
            result = analyze_layers_and_svg(tmp.name)
        except Exception as e:  # klayout raises plain RuntimeError/Exception on bad files
            raise HTTPException(status_code=400, detail=f"failed to parse GDS: {e}")

    return result


@app.post("/convert-positive", response_model=ConvertPositiveResponse)
async def convert_positive(
    file: UploadFile,
    layers: list[str] = Form(...),
    isolation_gap_um: float = Form(...),
):
    if not file.filename or not file.filename.lower().endswith((".gds", ".gds2", ".oas")):
        raise HTTPException(status_code=400, detail="expected a .gds/.gds2/.oas file")

    suffix = Path(file.filename).suffix
    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp.flush()
        try:
            result = convert_negative_to_positive(tmp.name, layers, isolation_gap_um)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:  # klayout raises plain RuntimeError/Exception on bad files
            raise HTTPException(status_code=400, detail=f"failed to convert GDS: {e}")

    return result
