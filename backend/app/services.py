import json
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import AuditLog, Guest, JournalEntry, JournalLine, Reservation, Room, RoomAvailability, RoomTask, RoomType, User

ACTIVE = {"confirmed", "checked_in"}


def audit(session: Session, actor: User | None, action: str, entity_type: str, entity_id: object, before=None, after=None):
    session.add(AuditLog(actor_id=actor.id if actor else None, action=action, entity_type=entity_type, entity_id=str(entity_id), before_json=json.dumps(before, default=str) if before else None, after_json=json.dumps(after, default=str) if after else None))


def create_reservation(session: Session, actor: User, *, guest_id: UUID, room_id: UUID, check_in: date, check_out: date, adults: int, children: int, rate: Decimal) -> Reservation:
    if check_out <= check_in:
        raise HTTPException(422, "Check-out must be after check-in")
    room_type = session.scalar(select(RoomType).join(Room).where(Room.id == room_id).with_for_update())
    if not room_type:
        raise HTTPException(404, "Room not found")
    if adults + children > room_type.capacity:
        raise HTTPException(422, f"Occupancy exceeds room capacity of {room_type.capacity}")
    blocked = session.scalar(select(RoomAvailability).where(RoomAvailability.room_id == room_id, RoomAvailability.business_date >= check_in, RoomAvailability.business_date < check_out, RoomAvailability.sellable.is_(False)))
    if blocked:
        raise HTTPException(409, "Room is unavailable for part of that stay")
    reservation = Reservation(code=f"RES-{UUID(bytes=__import__('os').urandom(16)).hex[:10].upper()}", guest_id=guest_id, room_id=room_id, check_in=check_in, check_out=check_out, adults=adults, children=children, rate=rate)
    session.add(reservation)
    try:
        session.flush()  # PostgreSQL exclusion constraint is the final concurrency guard.
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "Room was just booked for those dates")
    audit(session, actor, "reservation.created", "reservation", reservation.id, after={"code": reservation.code, "room_id": str(room_id)})
    return reservation


def transition_room_task(session: Session, actor: User, task: RoomTask, next_status: str):
    allowed = {"open": {"in_progress", "cancelled"}, "in_progress": {"completed", "cancelled"}, "completed": set(), "cancelled": set()}
    if next_status not in allowed.get(task.status, set()):
        raise HTTPException(409, f"Cannot transition {task.status} to {next_status}")
    before = {"status": task.status}
    task.status = next_status
    audit(session, actor, "room_task.transitioned", "room_task", task.id, before, {"status": next_status})


def post_entry(session: Session, actor: User, posted_on: date, reference: str, memo: str, lines: list[dict]):
    debit = sum(Decimal(str(line.get("debit", 0))) for line in lines)
    credit = sum(Decimal(str(line.get("credit", 0))) for line in lines)
    if debit != credit or debit <= 0:
        raise HTTPException(422, "A journal entry must balance and have a positive amount")
    entry = JournalEntry(posted_on=posted_on, reference=reference, memo=memo)
    session.add(entry)
    session.flush()
    for line in lines:
        session.add(JournalLine(entry_id=entry.id, account_code=line["account_code"], debit=Decimal(str(line.get("debit", 0))), credit=Decimal(str(line.get("credit", 0)))))
    audit(session, actor, "journal.posted", "journal_entry", entry.id, after={"reference": reference})
    return entry
