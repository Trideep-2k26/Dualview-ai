import os
import sys

# Ensure backend package is importable when running pytest from repo root
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.utils.engagement import calculate_engagement_rate


def test_zero_views():
    assert calculate_engagement_rate(10, 2, 0) is None


def test_normal():
    # (likes + comments)/views * 100 = (10+5)/100 *100 = 15.0
    assert calculate_engagement_rate(10, 5, 100) == 15.0
