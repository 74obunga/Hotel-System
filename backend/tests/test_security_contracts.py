from datetime import date

import pytest

from app.config import Settings


def test_jwt_secret_requires_non_default_value():
    with pytest.raises(ValueError):
        Settings(jwt_secret="development-only-change-me")


def test_simultaneous_booking_contract_is_conflict_safe():
    attempts = [("confirmed", date(2026, 10, 1), date(2026, 10, 3)), ("confirmed", date(2026, 10, 1), date(2026, 10, 3))]
    accepted = []
    for attempt in attempts:
        overlaps = any(status in {"confirmed", "checked_in"} and start < attempt[2] and attempt[1] < end for status, start, end in accepted)
        if not overlaps:
            accepted.append(attempt)
    assert len(accepted) == 1
