"""Parser tests built from the shape of a real YouCam skin-analysis response."""
import pytest

from app.services.youcam import YouCamError, parse_result

M = "https://example.com/mask.png?<redacted>"


def _payload(extra=None):
    out = [
        {"type": "acne", "ui_score": 77, "raw_score": 72.1188, "mask_urls": [M], "url": None},
        {"type": "dark_circle_v2", "ui_score": 67, "raw_score": 54.175, "mask_urls": [M], "url": None},
        {"type": "texture", "ui_score": 96, "raw_score": 97.6, "mask_urls": [M], "url": None},
        {"type": "skin_type", "region": "whole", "skin_type": "Normal", "mask_urls": [M], "url": None},
        {"type": "skin_type", "region": "t_zone", "skin_type": "Oily", "mask_urls": [M], "url": None},
        {"type": "skin_type", "region": "u_zone", "skin_type": "Normal", "mask_urls": [M], "url": None},
        {"type": "all", "score": 80.89, "url": None},
        {"type": "skin_age", "score": 30, "url": None},
        {"type": "resize_image", "mask_urls": [M], "url": None},
    ]
    return {"data": {"task_status": "success", "results": {"output": out + (extra or [])}}}


def test_parses_concerns_and_metadata():
    a = parse_result(_payload())
    assert a.concerns["acne"].ui_score == 77
    assert a.concerns["dark_circle_v2"].ui_score == 67
    assert a.concerns["acne"].mask_url == M
    assert a.skin_type == "Normal"
    assert a.skin_type_zones == {"t_zone": "Oily", "u_zone": "Normal"}
    assert a.overall_score == pytest.approx(80.89)
    assert a.skin_age == 30


def test_ignores_bookkeeping_entries():
    a = parse_result(_payload())
    assert "resize_image" not in a.concerns and "all" not in a.concerns
    assert "skin_type" not in a.concerns


def test_skips_concern_with_null_score():
    a = parse_result(_payload([{"type": "pore", "ui_score": None, "raw_score": None}]))
    assert "pore" not in a.concerns


def test_empty_output_raises():
    with pytest.raises(YouCamError):
        parse_result({"data": {"results": {"output": []}}})


def test_malformed_payload_raises():
    with pytest.raises(YouCamError):
        parse_result({"data": {}})


def test_extra_concerns_are_requested_and_can_be_switched_off(monkeypatch):
    from app.services import youcam
    on = youcam.requested_actions()
    assert {"eye_bag", "firmness", "radiance", "tear_trough"} <= set(on) and "skin_type" in on
    monkeypatch.setenv("YOUCAM_EXTRA_CONCERNS", "off")
    assert youcam.requested_actions() == [*youcam.CORE_CONCERNS, "skin_type"]


def test_extra_concerns_flow_into_areas_and_eyelids_never_become_focus():
    from app.services import skin_youcam
    ui = {"acne": 90, "eye_bag": 50, "droopy_upper_eyelid": 20, "firmness": 70}
    areas = skin_youcam.build_areas(ui)
    assert [a.key for a in areas][:2] == ["eye_bag", "firmness"] and areas[-1].key == "droopy_upper_eyelid"
    assert areas[-1].status == "watch" and areas[-1].ingredients == []
