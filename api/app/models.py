from datetime import datetime
from .extensions import db

class Board(db.Model):
    __tablename__ = "boards"

    id = db.Column(db.Integer, primary_key=True)
    width = db.Column(db.Integer, nullable=False)
    height = db.Column(db.Integer, nullable=False)
    default_color = db.Column(db.String(7), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Pixel(db.Model):
    __tablename__ = "pixels"

    id = db.Column(db.Integer, primary_key=True)
    board_id = db.Column(db.Integer, nullable=False)
    x = db.Column(db.Integer, nullable=False)
    y = db.Column(db.Integer, nullable=False)
    color = db.Column(db.String(7), nullable=False)
    owner_id = db.Column(db.String, nullable=True)
    version = db.Column(db.Integer, nullable=False, default=1)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("board_id", "x", "y", name="uq_pixel_position"),
    )
