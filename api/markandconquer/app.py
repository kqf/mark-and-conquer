"""Mark and Conquer: the entire backend.

One file, one SQLite database, mapped onto dataclasses with SQLAlchemy.
Every route here exists because web/src/api.ts calls it, and the shapes it
returns are the ones web/src/mocks/handlers.ts was already pretending to
return.
"""

import math
import os
import time
import uuid
from dataclasses import asdict
from datetime import timedelta

from flask import Flask, g, request, send_from_directory, session
from sqlalchemy import create_engine, select
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    MappedAsDataclass,
    Session,
    mapped_column,
)

# The board is a constant, not a table: nothing can change it at runtime, so
# storing it would only buy us a query.
BOARD = {
    "width": 32,
    "height": 32,
    "background": "#FFFFFF",
    "palette": [
        "#FFFFFF",
        "#D4D7D9",
        "#898D90",
        "#000000",
        "#FF4500",
        "#FFA800",
        "#FFD635",
        "#00A368",
        "#2450A4",
        "#811E9F",
    ],
}

COOLDOWN_MS = 5_000

DB_PATH = os.environ.get("DB_PATH", "pixels.db")

# Where `npm run build` leaves the SPA. Serving it from Flask keeps the whole
# app on a single origin, which is what makes the session cookie work without
# CORS and without touching the frontend.
DIST = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "web", "dist"
)

# static_folder=None because the catch-all route at the bottom does this job,
# and Flask's built-in static route would shadow it.
app = Flask(__name__, static_folder=None)

# This only signs the session cookie, whose entire contents is a random id.
# Set it in the environment anyway: without a stable key, a restart hands
# everyone a new identity and wipes their cooldown.
app.secret_key = os.environ.get("SECRET_KEY", "dev-only-not-a-secret")
app.permanent_session_lifetime = timedelta(days=365)


class Base(MappedAsDataclass, DeclarativeBase):
    """Mapped classes are real dataclasses. A row that comes back from a
    query is therefore already the shape the JSON routes want: asdict() on
    a Pixel is the response body, with no separate serializer to drift."""


class Pixel(Base):
    __tablename__ = "pixels"

    x: Mapped[int] = mapped_column(primary_key=True)
    y: Mapped[int] = mapped_column(primary_key=True)
    color: Mapped[str]


class Cooldown(Base):
    __tablename__ = "cooldowns"

    user_id: Mapped[str] = mapped_column(primary_key=True)
    next_allowed_at: Mapped[int]


engine = create_engine(f"sqlite:///{DB_PATH}")

# Runs at import, so it happens under gunicorn too, not just `python app.py`.
# create_all emits CREATE TABLE IF NOT EXISTS, so every worker may run it.
Base.metadata.create_all(engine)


def db():
    """One session per request. A Session is not thread-safe, and a worker
    thread is exactly what would otherwise share one."""
    if "db" not in g:
        g.db = Session(engine)
    return g.db


@app.teardown_appcontext
def close_db(exception):
    if (db_session := g.pop("db", None)) is not None:
        db_session.close()


def now_ms():
    """Milliseconds, because the client compares this to Date.now()."""
    return int(time.time() * 1000)


def user_id():
    """A random id in a signed cookie. Not authentication: just enough of an
    identity to hang a cooldown on, which is all the mock ever had either."""
    if "user_id" not in session:
        session.permanent = True
        session["user_id"] = uuid.uuid4().hex
    return session["user_id"]


def deadline_for(user):
    row = db().get(Cooldown, user)
    return row.next_allowed_at if row else 0


@app.get("/api/board")
def get_board():
    return BOARD


# One call returns the whole board, never one pixel at a time.
@app.get("/api/pixels")
def get_pixels():
    return [asdict(pixel) for pixel in db().scalars(select(Pixel))]


# Asked once on load, so a refresh restores the timer instead of resetting it.
@app.get("/api/cooldown")
def get_cooldown():
    return {"nextAllowedAt": deadline_for(user_id())}


# signed=True so that a negative coordinate reaches this function and gets
# the same 400 as one that is merely too large, rather than failing to route
# at all.
@app.put("/api/pixels/<int(signed=True):x>/<int(signed=True):y>")
def put_pixel(x, y):
    if not (0 <= x < BOARD["width"] and 0 <= y < BOARD["height"]):
        return {"error": "Pixel out of board bounds"}, 400

    color = (request.get_json(silent=True) or {}).get("color")
    if color not in BOARD["palette"]:
        return {"error": "Color not in palette"}, 400

    user = user_id()
    now = now_ms()

    # The server owns the clock. A client that asks early is handed the real
    # deadline rather than trusted to have remembered it. 429 with Retry-After
    # is what "you are rate limited" means in HTTP; the body repeats it as an
    # absolute timestamp because that is what the client actually wants.
    if now < (deadline := deadline_for(user)):
        return (
            {"nextAllowedAt": deadline},
            429,
            {"Retry-After": str(math.ceil((deadline - now) / 1000))},
        )

    deadline = now + COOLDOWN_MS

    # merge() is the ORM's upsert: it looks the row up by primary key, then
    # inserts or updates. That costs one extra SELECT per placement, which
    # is nothing against local SQLite at one pixel per cooldown per user.
    db_session = db()
    db_session.merge(Pixel(x=x, y=y, color=color))
    db_session.merge(Cooldown(user_id=user, next_allowed_at=deadline))
    db_session.commit()

    return {"nextAllowedAt": deadline}


@app.get("/health")
def health():
    return {"status": "ok"}


# Anything that is not /api/* is the SPA: real files when they exist, and
# index.html for everything else.
@app.get("/", defaults={"path": ""})
@app.get("/<path:path>")
def spa(path):
    if path and os.path.isfile(os.path.join(DIST, path)):
        return send_from_directory(DIST, path)
    return send_from_directory(DIST, "index.html")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
