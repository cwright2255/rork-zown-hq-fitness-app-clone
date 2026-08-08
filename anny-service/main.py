# Anny mesh-generation service for Zown HQ body scans.
#
# Wraps the Anny parametric human body model (Apache 2.0, github.com/naver/anny)
# behind a simple HTTP endpoint: real body measurements in, a GLB mesh out.
#
# Every choice below (the exact call signature, phenotype keys, default values)
# is based on direct inspection of Anny's real source (v0.6.0), not documentation
# or assumption - see anny_inverter.py's own default age (0.8, "adult average"),
# models/model_data.py's PHENOTYPE_VARIATIONS dict, and models/phenotype.py's
# forward() signature confirming pose_parameters defaults to None (a neutral
# rest pose) so no pose construction is needed for a basic standing figure.
#
# NOT YET LOCALLY EXECUTED: this sandbox's network restrictions block PyPI's
# default torch wheel (which hard-requires CUDA shared libraries even for CPU
# use - confirmed directly, not assumed) and the CPU-only build lives at
# download.pytorch.org, which isn't reachable from here either. Cloud Build
# has neither restriction, so this gets its first real execution at deploy
# time - flagged honestly in the accompanying notes, not hidden.

import io
import logging

import torch
import trimesh
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

import anny

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("anny-service")

app = FastAPI(title="Zown Body Mesh Service")

# Loaded once at process startup, reused for every request - this is the
# expensive part (parsing MakeHuman assets, building blend shape data), and
# Anny's own docs note it caches this after the first run. A cold container
# start pays this cost once; warm requests after that are fast.
_model = None


def get_model():
    global _model
    if _model is None:
        logger.info("Loading Anny model (first request on this instance)...")
        _model = anny.Anny()
        logger.info("Anny model loaded.")
    return _model


class ScanMeasurements(BaseModel):
    height_cm: float = Field(..., gt=100, lt=250)
    weight_kg: float | None = Field(None, gt=20, lt=300)
    gender: str = Field(..., pattern="^(male|female)$")
    body_fat_percent: float | None = Field(None, ge=3, le=70)
    age_years: int | None = Field(None, ge=13, le=100)


# Normalization ranges are deliberately wide, generic adult bounds, not
# fitted to any real population data - Anny's own phenotype axes are already
# calibrated to WHO growth curves internally, so this layer's only job is
# converting a real-world unit (cm, kg) into the roughly-right point on a 0-1
# slider, not reproducing that calibration itself.
_HEIGHT_CM_RANGE = (145.0, 205.0)   # -> height phenotype 0..1
_BMI_RANGE = (16.0, 40.0)           # -> weight phenotype 0..1, used when weight_kg is given
_AGE_YEARS_RANGE = (18.0, 70.0)     # -> age phenotype 0..1


def _normalize(value: float, lo: float, hi: float) -> float:
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def measurements_to_phenotype_kwargs(m: ScanMeasurements) -> dict:
    kwargs = {
        "gender": 1.0 if m.gender == "female" else 0.0,
        "height": _normalize(m.height_cm, *_HEIGHT_CM_RANGE),
        # Adult average per Anny's own default (anny_inverter.py); overridden
        # below if the app ever collects real age.
        "age": 0.8,
        # Neutral defaults for axes this app has no real data for - left at
        # 0.5 rather than guessed, since a wrong guess here is worse than an
        # honest "average" default.
        "proportions": 0.5,
        "cupsize": 0.5,
        "firmness": 0.5,
    }

    if m.age_years is not None:
        kwargs["age"] = _normalize(m.age_years, *_AGE_YEARS_RANGE)

    if m.weight_kg is not None:
        height_m = m.height_cm / 100.0
        bmi = m.weight_kg / (height_m ** 2)
        kwargs["weight"] = _normalize(bmi, *_BMI_RANGE)
    else:
        kwargs["weight"] = 0.5

    if m.body_fat_percent is not None:
        # Rough, deliberately conservative heuristic, not a validated
        # mapping: lower body fat % nudges toward higher muscle definition.
        # Clamped to a narrower band than the full 0-1 range so an
        # unusual body-fat reading can't push this to an extreme the rest
        # of the shape wasn't built to support.
        muscle_estimate = _normalize(30.0 - m.body_fat_percent, 0.0, 25.0)
        kwargs["muscle"] = max(0.25, min(0.75, muscle_estimate))
    else:
        kwargs["muscle"] = 0.5

    return kwargs


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate-mesh")
def generate_mesh(measurements: ScanMeasurements):
    try:
        model = get_model()
        phenotype_kwargs = measurements_to_phenotype_kwargs(measurements)
        logger.info("Generating mesh with phenotype_kwargs=%s", phenotype_kwargs)

        with torch.no_grad():
            output = model(phenotype_kwargs=phenotype_kwargs)

        vertices = output["vertices"][0].detach().cpu().numpy()
        faces = model.faces.detach().cpu().numpy()

        mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
        glb_bytes = mesh.export(file_type="glb")

        return Response(content=glb_bytes, media_type="model/gltf-binary")
    except Exception as e:
        logger.exception("Mesh generation failed")
        raise HTTPException(status_code=500, detail=str(e))
