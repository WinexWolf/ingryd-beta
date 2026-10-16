from app.models.product import SkinProfile
from app.services.concerns import parse_concern_scores, weight
from app.services.scoring import score_ingredients
from app.services.skin_youcam import suggest_concerns, suggest_skin_type

INGS = ["Water", "Glycerin", "Isopropyl Myristate", "Niacinamide", "Fragrance", "Alcohol Denat."]


def _notes(profile):
    return {n.ingredient: n for n in score_ingredients(INGS, profile).personal_notes}


# ---- parsing / weights
def test_parse_concern_scores_ignores_junk():
    assert parse_concern_scores("acne:77, pore:73,bogus:5,redness:abc,moisture:150") == {
        "acne": 77, "pore": 73, "moisture": 100}
    assert parse_concern_scores(None) == {} and parse_concern_scores("") == {}


def test_weight_scales_with_severity_and_defaults_to_one():
    assert weight({}, ["acne"]) == 1.0
    assert weight({"acne": 95}, ["acne"]) < weight({"acne": 73}, ["acne"]) < weight({"acne": 40}, ["acne"])
    assert 0.5 <= weight({"acne": 100}, ["acne"]) and weight({"acne": 0}, ["acne"]) <= 1.6


# ---- no scan: behaviour unchanged
def test_without_scan_matches_legacy_flat_adjustments():
    n = _notes(SkinProfile(concerns=["acne"]))
    assert n["Niacinamide"].adjustment == 6 and n["Niacinamide"].reason == "Targets your acne concern"
    assert "Isopropyl Myristate" not in n  # not oily, no scan -> no comedogenic penalty


def test_oily_without_scan_still_flat_minus_five():
    assert _notes(SkinProfile(skin_type="oily"))["Isopropyl Myristate"].adjustment == -5


# ---- with scan: severity matters
def test_severe_acne_adjusts_more_than_mild():
    severe = _notes(SkinProfile(concerns=["acne"], concern_scores={"acne": 40, "pore": 50}))
    mild = _notes(SkinProfile(concerns=["acne"], concern_scores={"acne": 95, "pore": 90}))
    assert severe["Niacinamide"].adjustment > mild["Niacinamide"].adjustment
    assert severe["Isopropyl Myristate"].adjustment < 0
    assert "Isopropyl Myristate" not in mild  # pores/acne healthy -> no comedogenic penalty


def test_reason_cites_the_scan_score():
    n = _notes(SkinProfile(concerns=["acne"], concern_scores={"acne": 40, "pore": 50}))
    assert "your acne score: 40/100" in n["Niacinamide"].reason


def test_scan_alone_triggers_comedogenic_penalty_for_flagged_pores():
    n = _notes(SkinProfile(concern_scores={"pore": 73}))
    assert n["Isopropyl Myristate"].adjustment < 0 and "pore score: 73/100" in n["Isopropyl Myristate"].reason


def test_low_hydration_scan_penalizes_drying_alcohol():
    assert _notes(SkinProfile(concern_scores={"moisture": 55}))["Alcohol Denat."].adjustment < 0


def test_redness_scan_penalizes_sensitizers():
    assert _notes(SkinProfile(concern_scores={"redness": 60}))["Fragrance"].adjustment < 0


def test_sensitivities_ignore_scan_weighting():
    n = _notes(SkinProfile(sensitivities=["fragrance"], concern_scores={"redness": 99}))
    assert n["Fragrance"].adjustment == -12


def test_fit_score_stays_in_range():
    r = score_ingredients(INGS * 5, SkinProfile(concerns=["acne"] * 3, concern_scores={"acne": 0, "pore": 0}))
    assert 0 <= r.fit_score <= 100


# ---- scan -> profile suggestion
def test_suggest_skin_type():
    assert suggest_skin_type("Normal", {}) == "normal"
    assert suggest_skin_type("Normal", {"t_zone": "Oily", "u_zone": "Normal"}) == "combination"
    assert suggest_skin_type("Normal", {"t_zone": "Normal", "u_zone": "Normal"}) == "normal"
    assert suggest_skin_type("Mixed", {}) == "combination"
    assert suggest_skin_type("Weird", {}) is None and suggest_skin_type(None, {}) is None


def test_suggest_concerns_uses_flag_threshold():
    ui = {"acne": 99, "pore": 73, "wrinkle": 82, "age_spot": 92, "dark_circle_v2": 71,
          "redness": 88, "moisture": 82}
    # pore 73 -> acne; dark circle 71 -> hyperpigmentation; the rest healthy
    assert suggest_concerns(ui) == ["acne", "hyperpigmentation"]
