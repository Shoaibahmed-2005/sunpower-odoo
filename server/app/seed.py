"""`npm run reset` (= python -m app.seed): drop every table, recreate them, insert the demo data (BUILD_PLAN §10).

v1: users, counters, products, packages, serial units in stock. Demo states (leads, quotes, jobs, tickets) follow.
"""
import math

import bcrypt

from app.db import Base, SessionLocal, engine
from app.models import (
    Counter,
    Package,
    PackageLine,
    PackageType,
    Product,
    Role,
    SerialUnit,
    Tracking,
    User,
)

PASSWORD = "sun123"
COUNTER_KEYS = ["ENQ", "SRV", "SQ", "JOB", "SP/OUT", "TKT", "INV"]

USERS = [
    # login_id, name, role, hourly_rate
    ("ravi", "Ravi Menon", Role.DIRECTOR, 0),
    ("priya", "Priya Shah", Role.SALES, 0),
    ("karan", "Karan Mehta", Role.SALES, 0),
    ("vikram", "Vikram Rao", Role.TECHNICIAN, 400),
    ("arjun", "Arjun Nair", Role.TECHNICIAN, 400),
    ("sameer", "Sameer Khan", Role.TECHNICIAN, 400),
    ("deepa", "Deepa Iyer", Role.WAREHOUSE, 0),
    ("farhan", "Farhan Ali", Role.SUPPORT, 0),
]

PRODUCTS = [
    # code, name, tracking, warranty_months, cost, price, qty_on_hand (SERIAL qty comes from SERIAL_STOCK)
    ("PNL-545", "Solar panel 545 Wp", Tracking.LOT, 240, 11500, 14000, 200),
    ("INV-OG3", "On-grid inverter 3 kW", Tracking.SERIAL, 24, 38000, 46000, 0),
    ("INV-OG5", "On-grid inverter 5 kW", Tracking.SERIAL, 24, 52000, 63000, 0),
    ("INV-OF5", "Off-grid inverter 5 kVA", Tracking.SERIAL, 24, 47000, 58000, 0),
    ("BAT-150", "Battery 150 Ah", Tracking.SERIAL, 24, 14500, 18000, 0),
    ("CC-60", "Charge controller 60 A", Tracking.SERIAL, 24, 6800, 8500, 0),
    ("MS-KW", "Mounting stand set (per kW)", Tracking.QTY, 0, 4200, 5500, 60),
    ("DB-SET", "AC/DC wiring box set", Tracking.QTY, 0, 3100, 4200, 30),
    ("CAB-DC4", "DC cable 4 sq mm (m)", Tracking.QTY, 0, 55, 80, 2000),
    ("ERT-KIT", "Earthing kit", Tracking.QTY, 0, 2400, 3200, 40),
    ("SVC-INST", "Installation (service)", Tracking.SERVICE, 0, 0, 15000, 0),
]

# product code -> how many units are in stock; serials look like INV-OG3-26A0001
SERIAL_STOCK = {"INV-OG3": 8, "INV-OG5": 4, "INV-OF5": 3, "BAT-150": 12, "CC-60": 10}


def subsidy_for(kw: int, system_type: PackageType) -> int:
    """Sample rooftop subsidy: on-grid only, ₹30,000 per kW up to 2 kW, flat ₹78,000 from 3 kW."""
    if system_type != PackageType.ON_GRID:
        return 0
    return 30000 * kw if kw <= 2 else 78000


def system_lines(kw: int, system_type: PackageType) -> list[tuple[str, int]]:
    """Parts list for an ON-n / OFF-n package, as (product code, qty)."""
    if system_type == PackageType.ON_GRID:
        inverter = "INV-OG3" if kw <= 3 else "INV-OG5"
    else:
        inverter = "INV-OF5"
    lines = [
        ("PNL-545", math.ceil(kw * 1000 / 545)),
        (inverter, 1),
        ("CC-60", 1),
        ("MS-KW", kw),
        ("DB-SET", 1),
        ("CAB-DC4", 10 * kw),
        ("ERT-KIT", 3),
        ("SVC-INST", 1),
    ]
    if system_type == PackageType.OFF_GRID:
        lines.append(("BAT-150", 2 if kw <= 3 else 4))
    return lines


def seed_users(db) -> None:
    # one hash for everyone: bcrypt with 12 rounds is slow on purpose, and they share a password
    password_hash = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(12)).decode()
    for login_id, name, role, rate in USERS:
        db.add(User(login_id=login_id, name=name, role=role, hourly_rate=rate, password_hash=password_hash))


def seed_products(db) -> dict[str, Product]:
    products = {}
    for code, name, tracking, warranty, cost, price, qty in PRODUCTS:
        products[code] = Product(code=code, name=name, tracking=tracking, warranty_months=warranty,
                                 cost=cost, price=price, qty_on_hand=qty)
        db.add(products[code])
    return products


def seed_serials(db, products: dict[str, Product]) -> None:
    for code, count in SERIAL_STOCK.items():
        product = products[code]
        for n in range(1, count + 1):
            db.add(SerialUnit(serial=f"{code}-26A{n:04d}", product=product, unit_cost=product.cost))
        # for SERIAL products, on-hand is exactly the number of units in stock
        product.qty_on_hand = count


def add_package(db, products, code, name, type_, kw, subsidy, lines) -> None:
    package = Package(code=code, name=name, type=type_, kw=kw, subsidy=subsidy)
    for product_code, qty in lines:
        package.lines.append(PackageLine(product=products[product_code], qty=qty))
    db.add(package)


def seed_packages(db, products: dict[str, Product]) -> None:
    for kw in range(1, 6):
        for type_, prefix, label in ((PackageType.ON_GRID, "ON", "On-Grid"), (PackageType.OFF_GRID, "OFF", "Off-Grid")):
            add_package(db, products, f"{prefix}-{kw}", f"{label} {kw} kW system", type_, kw,
                        subsidy_for(kw, type_), system_lines(kw, type_))
    add_package(db, products, "PANEL-SET", "Panel set 1 kW (hardware only)", PackageType.HARDWARE, 1, 0,
                [("PNL-545", math.ceil(1000 / 545)), ("CAB-DC4", 10)])
    add_package(db, products, "INSTALL", "Installation only", PackageType.SERVICE, 0, 0, [("SVC-INST", 1)])


def main() -> None:
    # importing app.models above registered every table on Base.metadata
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db, db.begin():
        db.add_all(Counter(key=key, next=1) for key in COUNTER_KEYS)
        seed_users(db)
        products = seed_products(db)
        seed_serials(db, products)
        seed_packages(db, products)
    print(f"Seeded {len(USERS)} users, {len(PRODUCTS)} products, 12 packages, "
          f"{sum(SERIAL_STOCK.values())} serial units. Password for everyone: {PASSWORD}")


if __name__ == "__main__":
    main()
