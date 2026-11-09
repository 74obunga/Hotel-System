import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Computed, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import DATERANGE, ExcludeConstraint, UUID
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def pk():
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = pk()
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(40), default="front_desk")
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Guest(Base):
    __tablename__ = "guests"
    id: Mapped[uuid.UUID] = pk()
    name: Mapped[str] = mapped_column(String(180), index=True)
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(320))
    lifecycle: Mapped[str] = mapped_column(String(24), default="lead")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RoomType(Base):
    __tablename__ = "room_types"
    id: Mapped[uuid.UUID] = pk()
    name: Mapped[str] = mapped_column(String(80), unique=True)
    capacity: Mapped[int] = mapped_column(Integer)
    rack_rate: Mapped[Decimal] = mapped_column(Numeric(14, 2))


class Room(Base):
    __tablename__ = "rooms"
    id: Mapped[uuid.UUID] = pk()
    number: Mapped[str] = mapped_column(String(20), unique=True)
    room_type_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("room_types.id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        ExcludeConstraint(("room_id", "="), ("stay_dates", "&&"), where="(status IN ('confirmed','checked_in'))", name="no_overlapping_active_room_stays", using="gist"),
    )
    id: Mapped[uuid.UUID] = pk()
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    guest_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("guests.id"))
    room_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rooms.id"))
    check_in: Mapped[date] = mapped_column(Date)
    check_out: Mapped[date] = mapped_column(Date)
    stay_dates: Mapped[object] = mapped_column(DATERANGE, Computed("daterange(check_in, check_out, '[)')", persisted=True))
    adults: Mapped[int] = mapped_column(Integer)
    children: Mapped[int] = mapped_column(Integer, default=0)
    rate: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(24), default="confirmed")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RoomAvailability(Base):
    __tablename__ = "room_availability"
    __table_args__ = (UniqueConstraint("room_id", "business_date", name="uq_room_availability_date"),)
    id: Mapped[uuid.UUID] = pk()
    room_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rooms.id"), index=True)
    business_date: Mapped[date] = mapped_column(Date, index=True)
    sellable: Mapped[bool] = mapped_column(Boolean, default=True)
    reason: Mapped[str | None] = mapped_column(String(255))


class RoomTask(Base):
    __tablename__ = "room_tasks"
    id: Mapped[uuid.UUID] = pk()
    room_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rooms.id"))
    kind: Mapped[str] = mapped_column(String(20))  # housekeeping or maintenance
    status: Mapped[str] = mapped_column(String(20), default="open")
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    id: Mapped[uuid.UUID] = pk()
    posted_on: Mapped[date] = mapped_column(Date, index=True)
    reference: Mapped[str] = mapped_column(String(80), unique=True)
    status: Mapped[str] = mapped_column(String(16), default="posted")
    memo: Mapped[str] = mapped_column(Text)


class JournalLine(Base):
    __tablename__ = "journal_lines"
    id: Mapped[uuid.UUID] = pk()
    entry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("journal_entries.id"), index=True)
    account_code: Mapped[str] = mapped_column(String(32), index=True)
    debit: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    credit: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[uuid.UUID] = pk()
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(120), index=True)
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(80))
    before_json: Mapped[str | None] = mapped_column(Text)
    after_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
