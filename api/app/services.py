from datetime import datetime, timezone
from flask import abort
from .models import Pixel
from .extensions import db

def purchase_pixel(board, user_id, x, y):
    if existing := Pixel.query.filter_by(board_id=board.id, x=x, y=y).first():
        abort(409, "Pixel already owned")

    pixel = Pixel(
        board_id=board.id,
        x=x,
        y=y,
        color=board.default_color,
        owner_id=user_id,
    )

    db.session.add(pixel)
    db.session.commit()
    return pixel


def update_pixel_color(board, user_id, x, y, color):
    pixel = Pixel.query.filter_by(board_id=board.id, x=x, y=y).first()
    if not pixel:
        abort(404, "Pixel not owned")

    if pixel.owner_id != user_id:
        abort(403, "You do not own this pixel")

    pixel.color = color
    pixel.version += 1
    pixel.updated_at = datetime.now(timezone.utc)

    db.session.commit()
    return pixel
