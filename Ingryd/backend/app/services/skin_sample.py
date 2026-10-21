"""A canned scan for people with no photo handy (or no scan budget left).
Costs no YouCam units and needs no sign-in. It is always labelled as a sample."""
from app.models.skin import SkinProfile
from app.services.skin_youcam import map_to_profile
from app.services.youcam import ConcernScore, YouCamAnalysis

SAMPLE_SCORES = {
    "moisture": 80, "oiliness": 76, "redness": 85, "acne": 72, "pore": 70,
    "texture": 71, "wrinkle": 88, "age_spot": 82, "dark_circle_v2": 66,
}


def sample_profile() -> SkinProfile:
    a = YouCamAnalysis(
        concerns={k: ConcernScore(ui_score=v, raw_score=float(v)) for k, v in SAMPLE_SCORES.items()},
        skin_type="Combination", skin_type_zones={"t_zone": "Oily", "u_zone": "Normal"},
        overall_score=78, skin_age=29,
    )
    p = map_to_profile(a)
    p.is_sample = True
    return p
