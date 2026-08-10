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
        # local_changes="default" enables a broader set of granular,
        # localized shape controls beyond the base phenotype axes -
        # confirmed directly in Anny's own data (data/mpfb2/targets/
        # target.json) that the stomach category has
        # "include_per_default": true, so "default" genuinely includes the
        # stomach-tone and stomach-pregnant controls this service uses
        # below, without needing to guess at passing a specific list of
        # exact key names.
        _model = anny.Anny(local_changes="default")
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
        # Neutral default for the one axis this app has no real data for -
        # left at 0.5 rather than guessed, since a wrong guess here is worse
        # than an honest "average" default.
        "proportions": 0.5,
        # cupsize and firmness deliberately omitted: the default Anny()
        # model's real, available phenotype set doesn't include them
        # (confirmed directly from the deployed service's own error message:
        # "available: ['gender', 'age', 'muscle', 'weight', 'height',
        # 'proportions']") - they're defined in the model's underlying data
        # but excluded from this default configuration, matching
        # EXCLUDED_PHENOTYPES seen directly in Anny's own source. Passing
        # them raises, rather than being silently ignored.
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


# The broad weight/muscle phenotype axes alone tend to distribute mass
# fairly evenly across the whole figure, which is a real, common reason a
# generated body can look more idealized than someone's actual body -
# real abdominal fat concentration (especially for men) is a well-
# established pattern the global axes alone don't capture. These two
# specific, localized controls (confirmed directly in Anny's own data,
# not guessed) target that directly: how much the stomach visibly
# protrudes, and how toned vs. soft/hanging it appears.
#
# Below a body-fat threshold most people carry minimal visible abdominal
# fat, so this stays at genuinely neutral (0.0, no adjustment) rather
# than nudging everyone toward a bigger stomach regardless of their
# actual measurements. Scales linearly above that threshold, capped at a
# moderate maximum rather than these controls' full extreme range - the
# goal is an honest, not an exaggerated or unflattering, representation.
_STOMACH_EFFECT_START_BODY_FAT = 15.0
_STOMACH_EFFECT_FULL_BODY_FAT = 35.0
_STOMACH_MAX_PROTRUSION = 0.5
_STOMACH_MAX_DETONE = -0.5


def measurements_to_local_changes_kwargs(m: ScanMeasurements) -> dict:
    if m.body_fat_percent is None:
        return {}

    intensity = _normalize(
        m.body_fat_percent, _STOMACH_EFFECT_START_BODY_FAT, _STOMACH_EFFECT_FULL_BODY_FAT
    )
    if intensity <= 0.0:
        return {}

    return {
        "stomach-pregnant-decr-incr": intensity * _STOMACH_MAX_PROTRUSION,
        "stomach-tone-decr-incr": intensity * _STOMACH_MAX_DETONE,
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate-mesh")
def generate_mesh(measurements: ScanMeasurements):
    try:
        model = get_model()
        phenotype_kwargs = measurements_to_phenotype_kwargs(measurements)
        local_changes_kwargs = measurements_to_local_changes_kwargs(measurements)

        # Defensive: these key names were confirmed directly from Anny's own
        # data files, but not yet verified against a live model at runtime.
        # Rather than assume they're exactly right and let a mismatch crash
        # the whole request, check against the model's own real label list -
        # apply only what genuinely exists, log anything that doesn't so a
        # naming mismatch is visible and fixable rather than silently wrong.
        valid_local_change_keys = set(model.local_change_labels)
        dropped_keys = set(local_changes_kwargs) - valid_local_change_keys
        if dropped_keys:
            logger.warning(
                "Dropping local_changes keys not in model.local_change_labels: %s",
                dropped_keys,
            )
        local_changes_kwargs = {
            k: v for k, v in local_changes_kwargs.items() if k in valid_local_change_keys
        }

        logger.info(
            "Generating mesh with phenotype_kwargs=%s local_changes_kwargs=%s",
            phenotype_kwargs, local_changes_kwargs,
        )

        with torch.no_grad():
            output = model(
                phenotype_kwargs=phenotype_kwargs,
                local_changes_kwargs=local_changes_kwargs or None,
            )

        vertices = output["vertices"][0].detach().cpu().numpy()
        faces = model.faces.detach().cpu().numpy()

        mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
        # Force smooth vertex normal computation before export - confirmed
        # directly that trimesh computes this lazily only on explicit
        # access, and export() alone doesn't trigger it. Without this, the
        # GLB exports with flat, faceted shading instead of the smooth
        # surface Anny's own mesh data actually supports - visually
        # confirmed faceted in the first real render from this service.
        _ = mesh.vertex_normals
        glb_bytes = mesh.export(file_type="glb")

        return Response(content=glb_bytes, media_type="model/gltf-binary")
    except Exception as e:
        logger.exception("Mesh generation failed")
        raise HTTPException(status_code=500, detail=str(e))
