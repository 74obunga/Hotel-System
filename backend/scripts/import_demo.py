"""Import a browser backup created by the legacy demo into the new database.

Usage: python scripts/import_demo.py path/to/hotel-backup.json
"""
import json
import sys
import uuid
from decimal import Decimal

from app.database import SessionLocal
from app.models import Guest, Room, RoomType

with open(sys.argv[1], encoding="utf-8") as source:
    demo = json.load(source)

with SessionLocal.begin() as session:
    type_ids = {}
    for item in demo["types"]:
        record = RoomType(id=uuid.uuid4(), name=item["name"], capacity=item["cap"], rack_rate=Decimal(str(item["rate"])))
        session.add(record); type_ids[item["id"]] = record.id
    for item in demo["rooms"]:
        session.add(Room(id=uuid.uuid4(), number=item["no"], room_type_id=type_ids[item["typeId"]], active=True))
    for item in demo["guests"]:
        session.add(Guest(id=uuid.uuid4(), name=item["name"], phone=item.get("phone"), email=item.get("email"), lifecycle="returning"))
print("Imported room types, rooms, and guests. Reservations and financial events require a reviewed mapping run.")
