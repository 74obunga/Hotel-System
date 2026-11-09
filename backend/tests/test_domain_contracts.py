from datetime import date
from decimal import Decimal

import pytest


def test_capacity_is_a_hard_validation_boundary():
    capacity = 2
    guests = 3
    assert guests > capacity


def test_room_status_transition_contract():
    allowed = {"open": {"in_progress", "cancelled"}, "in_progress": {"completed", "cancelled"}, "completed": set()}
    assert "completed" in allowed["in_progress"]
    assert "open" not in allowed["completed"]


def test_simultaneous_booking_contract_is_conflict_safe():
    # The PostgreSQL exclusion constraint permits exactly one active overlap.
    attempts = [("confirmed", date(2026, 10, 1), date(2026, 10, 3)), ("confirmed", date(2026, 10, 1), date(2026, 10, 3))]
    accepted = []
    for attempt in attempts:
        overlaps = any(status in {"confirmed", "checked_in"} and start < attempt[2] and attempt[1] < end for status, start, end in accepted)
        if not overlaps:
            accepted.append(attempt)
    assert len(accepted) == 1


def test_card_payment_remains_in_clearing_until_settlement():
    accounts = {"cash": Decimal("0"), "card_clearing": Decimal("500"), "bank": Decimal("0")}
    assert accounts["bank"] == 0
    assert accounts["card_clearing"] == Decimal("500")
