import pytest
from app.services.ingestion_service import validate_url
from app.utils.engagement import calculate_engagement_rate

def test_validate_url_success():
    # Valid platforms
    validate_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "A")
    validate_url("https://youtu.be/dQw4w9WgXcQ", "B")
    validate_url("https://www.instagram.com/reel/C321456/", "A")

def test_validate_url_invalid_format():
    with pytest.raises(ValueError) as exc:
        validate_url("youtube.com/watch", "A")
    assert "Invalid URL" in str(exc.value)

def test_validate_url_unsupported_platform():
    with pytest.raises(ValueError) as exc:
        validate_url("https://twitter.com/post/123", "A")
    assert "Unsupported platform" in str(exc.value)

def test_engagement_rate_division_by_zero():
    # No views should output None engagement rate safely
    assert calculate_engagement_rate(10, 5, 0) is None
    assert calculate_engagement_rate(10, 5, -5) is None
