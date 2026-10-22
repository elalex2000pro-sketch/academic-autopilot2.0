"""Pruebas de la normalizacion de la URL de Moodle."""
import pytest
from pydantic import ValidationError

from app.core.urls import normalize_moodle_base_url
from app.schemas.sync import MoodleConnectRequest


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://moodle.universidad.edu", "https://moodle.universidad.edu"),
        ("https://moodle.universidad.edu/", "https://moodle.universidad.edu"),
        ("moodle.universidad.edu", "https://moodle.universidad.edu"),
        ("https://moodle.universidad.edu/moodle/", "https://moodle.universidad.edu/moodle"),
        (
            "https://moodle.universidad.edu/login/index.php",
            "https://moodle.universidad.edu",
        ),
        (
            "https://moodle.universidad.edu/moodle/login/index.php?lang=es",
            "https://moodle.universidad.edu/moodle",
        ),
        (
            "https://moodle.universidad.edu/webservice/rest/server.php",
            "https://moodle.universidad.edu",
        ),
        ("  https://MOODLE.universidad.edu  ", "https://moodle.universidad.edu"),
    ],
)
def test_normalize_moodle_base_url(raw: str, expected: str) -> None:
    assert normalize_moodle_base_url(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "   ",
        "ftp://moodle.universidad.edu",
        "https://",
        "https://moodle.universidad.edu/a b",
        "https://user:pass@moodle.universidad.edu",
    ],
)
def test_normalize_moodle_base_url_rejects_invalid_values(raw: str) -> None:
    with pytest.raises(ValueError):
        normalize_moodle_base_url(raw)


def test_connect_request_normalizes_url_and_token() -> None:
    payload = MoodleConnectRequest(
        base_url=" moodle.universidad.edu/moodle/login/index.php?lang=es ",
        token="  token-de-prueba-123  ",
    )
    assert payload.base_url == "https://moodle.universidad.edu/moodle"
    assert payload.token == "token-de-prueba-123"


def test_connect_request_rejects_whitespace_only_token() -> None:
    with pytest.raises(ValidationError):
        MoodleConnectRequest(
            base_url="https://moodle.universidad.edu",
            token="          ",
        )
