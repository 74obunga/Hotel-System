import csv
import io
import os
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_session
from .models import Guest, JournalEntry, JournalLine, Reservation, Room, RoomAvailability, RoomTask, RoomType, User
from .security import issue_token, passwords, require
from .services import create_reservation, post_entry, transition_room_task

app = FastAPI(title="Hotel Operations API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins.split(","), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class GuestIn(BaseModel):
    name: str = Field(min_length=1)
    phone: str | None = None
    email: str | None = None


class BootstrapIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class ReservationIn(BaseModel):
    guest_id: UUID
    room_id: UUID
    check_in: date
    check_out: date
    adults: int = Field(ge=1)
    children: int = Field(ge=0)
    rate: Decimal = Field(gt=0)


class TaskTransition(BaseModel):
    status: str


class JournalLineIn(BaseModel):
    account_code: str = Field(min_length=1, max_length=32)
    debit: Decimal = Field(default=Decimal("0"), ge=0)
    credit: Decimal = Field(default=Decimal("0"), ge=0)


class JournalIn(BaseModel):
    posted_on: date
    reference: str = Field(min_length=1)
    memo: str = ""
    lines: list[JournalLineIn]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/bootstrap", status_code=201)
def bootstrap(body: BootstrapIn, session: Session = Depends(get_session)):
    if session.scalar(select(User).limit(1)):
        raise HTTPException(409, "Bootstrap is disabled after the first user")
    user = User(email=body.email.lower(), password_hash=passwords.hash(body.password), role="administrator")
    session.add(user)
    session.commit()
    return {"id": str(user.id), "email": user.email}


@app.post("/auth/token")
def token(form: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = session.scalar(select(User).where(User.email == form.username.lower()))
    if not user or not passwords.verify(form.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return {"access_token": issue_token(user), "token_type": "bearer"}


# --- Query & Read Endpoints ---


@app.get("/rooms")
def list_rooms(session: Session = Depends(get_session)):
    query = select(Room, RoomType).join(RoomType, Room.room_type_id == RoomType.id).order_by(Room.number)
    results = session.execute(query).all()
    return [
        {
            "id": str(r.id),
            "number": r.number,
            "active": r.active,
            "room_type": {
                "id": str(rt.id),
                "name": rt.name,
                "capacity": rt.capacity,
                "rack_rate": str(rt.rack_rate)
            }
        }
        for r, rt in results
    ]


@app.get("/room-types")
def list_room_types(session: Session = Depends(get_session)):
    types = session.scalars(select(RoomType).order_by(RoomType.rack_rate)).all()
    return [{"id": str(t.id), "name": t.name, "capacity": t.capacity, "rack_rate": str(t.rack_rate)} for t in types]


@app.get("/guests")
def list_guests(q: str | None = None, session: Session = Depends(get_session)):
    query = select(Guest)
    if q:
        query = query.where(Guest.name.ilike(f"%{q}%") | Guest.phone.ilike(f"%{q}%") | Guest.email.ilike(f"%{q}%"))
    guests = session.scalars(query.order_by(Guest.name).limit(100)).all()
    return [{"id": str(g.id), "name": g.name, "phone": g.phone, "email": g.email, "lifecycle": g.lifecycle} for g in guests]


@app.post("/guests", status_code=201)
def create_guest(body: GuestIn, user: User = Depends(require("administrator", "front_desk")), session: Session = Depends(get_session)):
    guest = Guest(name=body.name, phone=body.phone, email=body.email)
    session.add(guest)
    session.commit()
    return {"id": str(guest.id), "name": guest.name, "phone": guest.phone, "email": guest.email}


@app.get("/reservations")
def list_reservations(status: str | None = None, from_date: date | None = None, to_date: date | None = None, session: Session = Depends(get_session)):
    query = select(Reservation).order_by(Reservation.check_in.desc())
    if status:
        query = query.where(Reservation.status == status)
    if from_date:
        query = query.where(Reservation.check_out >= from_date)
    if to_date:
        query = query.where(Reservation.check_in <= to_date)
    reservations = session.scalars(query.limit(200)).all()
    return [
        {
            "id": str(r.id),
            "code": r.code,
            "guest_id": str(r.guest_id),
            "room_id": str(r.room_id),
            "check_in": str(r.check_in),
            "check_out": str(r.check_out),
            "adults": r.adults,
            "children": r.children,
            "rate": str(r.rate),
            "status": r.status
        }
        for r in reservations
    ]


@app.post("/reservations", status_code=201)
def reserve(body: ReservationIn, user: User = Depends(require("administrator", "front_desk")), session: Session = Depends(get_session)):
    reservation = create_reservation(session, user, **body.model_dump())
    session.commit()
    return {"id": str(reservation.id), "code": reservation.code, "status": reservation.status}


@app.post("/reservations/{reservation_id}/check-in")
def check_in_reservation(reservation_id: UUID, user: User = Depends(require("administrator", "front_desk")), session: Session = Depends(get_session)):
    r = session.get(Reservation, reservation_id)
    if not r:
        raise HTTPException(404, "Reservation not found")
    if r.status != "confirmed":
        raise HTTPException(409, f"Cannot check in reservation with status '{r.status}'")
    r.status = "checked_in"
    session.commit()
    return {"id": str(r.id), "code": r.code, "status": r.status}


@app.post("/reservations/{reservation_id}/check-out")
def check_out_reservation(reservation_id: UUID, user: User = Depends(require("administrator", "front_desk")), session: Session = Depends(get_session)):
    r = session.get(Reservation, reservation_id)
    if not r:
        raise HTTPException(404, "Reservation not found")
    if r.status != "checked_in":
        raise HTTPException(409, f"Cannot check out reservation with status '{r.status}'")
    r.status = "checked_out"
    session.commit()
    return {"id": str(r.id), "code": r.code, "status": r.status}


@app.get("/room-tasks")
def list_room_tasks(kind: str | None = None, session: Session = Depends(get_session)):
    query = select(RoomTask).order_by(RoomTask.opened_at.desc())
    if kind:
        query = query.where(RoomTask.kind == kind)
    tasks = session.scalars(query).all()
    return [{"id": str(t.id), "room_id": str(t.room_id), "kind": t.kind, "status": t.status, "opened_at": t.opened_at.isoformat()} for t in tasks]


@app.post("/room-tasks/{task_id}/transition")
def task_transition(task_id: UUID, body: TaskTransition, user: User = Depends(require("administrator", "housekeeping", "maintenance")), session: Session = Depends(get_session)):
    task = session.get(RoomTask, task_id)
    if not task:
        raise HTTPException(404, "Room task not found")
    transition_room_task(session, user, task, body.status)
    session.commit()
    return {"id": str(task.id), "status": task.status}


@app.get("/dashboard/kpis")
def dashboard_kpis(session: Session = Depends(get_session)):
    today = date.today()
    total_rooms = session.scalar(select(func.count(Room.id)).where(Room.active.is_(True))) or 0
    occupied_rooms = session.scalar(select(func.count(func.distinct(Reservation.room_id))).where(Reservation.status == "checked_in")) or 0
    arrivals = session.scalar(select(func.count(Reservation.id)).where(Reservation.status == "confirmed", Reservation.check_in <= today)) or 0
    departures = session.scalar(select(func.count(Reservation.id)).where(Reservation.status == "checked_in", Reservation.check_out <= today)) or 0
    return {
        "total_rooms": total_rooms,
        "occupied_rooms": occupied_rooms,
        "occupancy_rate": round(occupied_rooms / total_rooms * 100, 1) if total_rooms else 0,
        "arrivals_due": arrivals,
        "departures_due": departures
    }


@app.get("/analytics/overview")
def analytics_overview(
    from_date: date | None = None,
    to_date: date | None = None,
    user: User = Depends(require("administrator", "accountant")),
    session: Session = Depends(get_session),
):
    end_date = to_date or date.today()
    start_date = from_date or end_date - timedelta(days=29)
    if end_date < start_date:
        raise HTTPException(422, "to_date must be on or after from_date")
    if (end_date - start_date).days > 365:
        raise HTTPException(422, "Analytics date range cannot exceed 366 days")

    active_room_ids = set(session.scalars(select(Room.id).where(Room.active.is_(True))).all())
    total_rooms = len(active_room_ids)
    unavailable = session.execute(
        select(RoomAvailability.room_id, RoomAvailability.business_date)
        .where(
            RoomAvailability.room_id.in_(active_room_ids),
            RoomAvailability.sellable.is_(False),
            (
                RoomAvailability.business_date.between(start_date, end_date)
                | (RoomAvailability.business_date == date.today())
            ),
        )
    ).all() if active_room_ids else []
    unavailable_by_date: dict[date, set[UUID]] = {}
    for room_id, business_date in unavailable:
        unavailable_by_date.setdefault(business_date, set()).add(room_id)

    stays = session.execute(
        select(Reservation.room_id, Reservation.check_in, Reservation.check_out, Reservation.status)
        .where(
            Reservation.room_id.in_(active_room_ids),
            Reservation.status.in_(("confirmed", "checked_in", "checked_out")),
            Reservation.check_in <= end_date,
            Reservation.check_out > start_date,
        )
    ).all() if active_room_ids else []
    stay_events: dict[date, int] = {}
    for _room_id, check_in, check_out, _status in stays:
        if _status == "confirmed" and check_in < date.today():
            continue
        first_night = max(check_in, start_date)
        after_last_night = min(check_out, end_date + timedelta(days=1))
        stay_events[first_night] = stay_events.get(first_night, 0) + 1
        stay_events[after_last_night] = stay_events.get(after_last_night, 0) - 1

    occupancy_trend = []
    occupied = 0
    business_date = start_date
    today = date.today()
    occupied_today = 0
    arrivals_due = 0
    departures_due = 0
    while business_date <= end_date:
        occupied += stay_events.get(business_date, 0)
        sellable_rooms = max(total_rooms - len(unavailable_by_date.get(business_date, set())), 0)
        daily_occupied = min(max(occupied, 0), sellable_rooms)
        occupancy_trend.append({
            "date": business_date.isoformat(),
            "occupied_rooms": daily_occupied,
            "sellable_rooms": sellable_rooms,
            "occupancy_rate": round(daily_occupied / sellable_rooms * 100, 1) if sellable_rooms else 0,
        })
        business_date += timedelta(days=1)

    occupied_today = session.scalar(
        select(func.count(func.distinct(Reservation.room_id)))
        .join(Room, Room.id == Reservation.room_id)
        .where(
            Room.active.is_(True),
            Reservation.status == "checked_in",
            Reservation.check_in <= today,
            Reservation.check_out > today,
        )
    ) or 0
    arrivals_due = session.scalar(
        select(func.count(Reservation.id)).where(
            Reservation.status == "confirmed",
            Reservation.check_in == today,
        )
    ) or 0
    departures_due = session.scalar(
        select(func.count(Reservation.id)).where(
            Reservation.status == "checked_in",
            Reservation.check_out == today,
        )
    ) or 0

    sellable_today = max(total_rooms - len(unavailable_by_date.get(today, set())), 0)
    current_room_revenue = session.scalar(
        select(func.coalesce(func.sum(Reservation.rate), 0))
        .join(Room, Room.id == Reservation.room_id)
        .where(
            Room.active.is_(True),
            Reservation.status == "checked_in",
            Reservation.check_in <= today,
            Reservation.check_out > today,
        )
    ) or 0
    current_adr = float(current_room_revenue / occupied_today) if occupied_today else 0
    current_revpar = float(current_room_revenue / sellable_today) if sellable_today else 0
    arrival_rows = session.execute(
        select(Reservation.id, Reservation.code, Guest.name, Room.number)
        .join(Guest, Guest.id == Reservation.guest_id)
        .join(Room, Room.id == Reservation.room_id)
        .where(Room.active.is_(True), Reservation.status == "confirmed", Reservation.check_in == today)
        .order_by(Room.number)
    ).all()
    status_rows = session.execute(
        select(Reservation.status, func.count(Reservation.id))
        .where(Reservation.check_in <= end_date, Reservation.check_out > start_date)
        .group_by(Reservation.status)
        .order_by(Reservation.status)
    ).all()
    account_rows = session.execute(
        select(
            JournalLine.account_code,
            func.coalesce(func.sum(JournalLine.debit), 0),
            func.coalesce(func.sum(JournalLine.credit), 0),
        )
        .join_from(JournalLine, JournalEntry)
        .where(
            JournalEntry.status == "posted",
            JournalEntry.posted_on >= start_date,
            JournalEntry.posted_on <= end_date,
        )
        .group_by(JournalLine.account_code)
        .order_by(JournalLine.account_code)
    ).all()
    journal_by_date = session.execute(
        select(
            JournalEntry.posted_on,
            func.coalesce(func.sum(JournalLine.debit), 0),
            func.coalesce(func.sum(JournalLine.credit), 0),
        )
        .join(JournalLine, JournalLine.entry_id == JournalEntry.id)
        .where(
            JournalEntry.status == "posted",
            JournalEntry.posted_on >= start_date,
            JournalEntry.posted_on <= end_date,
        )
        .group_by(JournalEntry.posted_on)
        .order_by(JournalEntry.posted_on)
    ).all()
    daily_activity = {
        entry_date: {"debit": float(debit), "credit": float(credit)}
        for entry_date, debit, credit in journal_by_date
    }
    journal_activity = [
        {"account_code": code, "debit": float(debit), "credit": float(credit)}
        for code, debit, credit in account_rows
    ]

    return {
        "from_date": start_date.isoformat(),
        "to_date": end_date.isoformat(),
        "total_rooms": total_rooms,
        "sellable_rooms": sellable_today,
        "occupied_rooms": occupied_today,
        "occupancy_rate": round(occupied_today / sellable_today * 100, 1) if sellable_today else 0,
        "adr": current_adr,
        "revpar": current_revpar,
        "arrivals_due": arrivals_due,
        "departures_due": departures_due,
        "arrivals": [
            {
                "id": str(reservation_id),
                "code": code,
                "guest_name": guest_name,
                "room_number": room_number,
            }
            for reservation_id, code, guest_name, room_number in arrival_rows
        ],
        "occupancy_trend": occupancy_trend,
        "reservations_by_status": [
            {"status": status, "count": count} for status, count in status_rows
        ],
        "journal_activity": journal_activity,
        "daily_journal_activity": [
            {
                "date": entry_date.isoformat(),
                **daily_activity.get(entry_date, {"debit": 0, "credit": 0}),
            }
            for entry_date in (
                start_date + timedelta(days=offset)
                for offset in range((end_date - start_date).days + 1)
            )
        ],
    }


@app.post("/finance/journals", status_code=201)
def journal(body: JournalIn, user: User = Depends(require("administrator", "accountant")), session: Session = Depends(get_session)):
    entry = post_entry(session, user, **body.model_dump())
    session.commit()
    return {"id": str(entry.id), "reference": entry.reference}


@app.get("/finance/trial-balance")
def trial_balance(as_at: date, user: User = Depends(require("administrator", "accountant")), session: Session = Depends(get_session)):
    rows = session.execute(
        select(JournalLine.account_code, func.coalesce(func.sum(JournalLine.debit), 0), func.coalesce(func.sum(JournalLine.credit), 0))
        .join_from(JournalLine, JournalEntry)
        .where(JournalEntry.status == "posted", JournalEntry.posted_on <= as_at)
        .group_by(JournalLine.account_code)
        .order_by(JournalLine.account_code)
    ).all()
    return [{"account_code": code, "debit": str(debit), "credit": str(credit), "balance": str(debit - credit)} for code, debit, credit in rows]


@app.get("/exports/trial-balance.csv")
def trial_balance_export(as_at: date, user: User = Depends(require("administrator", "accountant")), session: Session = Depends(get_session)):
    rows = trial_balance(as_at, user, session)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["account_code", "debit", "credit", "balance"])
    for row in rows:
        writer.writerow([row["account_code"], row["debit"], row["credit"], row["balance"]])
    csv_data = buffer.getvalue()
    return Response(csv_data, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="trial-balance-{as_at}.csv"'})


# --- Built Frontend Static Files Mounting ---
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
