from flask import Blueprint, request, abort
from .models import Board, Pixel
from .schemas import (
    BoardCreateSchema,
    BoardResponseSchema,
    PixelResponseSchema,
    PixelColorUpdateSchema,
)
from .services import purchase_pixel, update_pixel_color

api = Blueprint("api", __name__)

def get_user_id():
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        abort(401, "Missing X-User-Id header")
    return user_id

def validate_coordinates(board, x, y):
    if not (0 <= x < board.width and 0 <= y < board.height):
        abort(400, "Pixel out of board bounds")

@api.route("/boards", methods=["POST"])
def create_board():
    data = BoardCreateSchema().load(request.get_json())

    board = Board(
        width=data.width,
        height=data.height,
        default_color=data.default_color,
    )

    from .extensions import db
    db.session.add(board)
    db.session.commit()

    return BoardResponseSchema().dump(board), 201


@api.route("/boards/<int:board_id>/pixels/<int:x>/<int:y>", methods=["GET"])
def get_pixel(board_id, x, y):
    board = Board.query.get_or_404(board_id)
    validate_coordinates(board, x, y)

    pixel = Pixel.query.filter_by(board_id=board.id, x=x, y=y).first()
    if pixel:
        return PixelResponseSchema().dump(pixel)

    return PixelResponseSchema().dump({
        "board_id": board.id,
        "x": x,
        "y": y,
        "color": board.default_color,
        "owner_id": None,
        "version": 0,
        "updated_at": None,
    })


@api.route("/boards/<int:board_id>/pixels/<int:x>/<int:y>/purchase", methods=["POST"])
def purchase(board_id, x, y):
    user_id = get_user_id()
    board = Board.query.get_or_404(board_id)
    validate_coordinates(board, x, y)

    pixel = purchase_pixel(board, user_id, x, y)
    return PixelResponseSchema().dump(pixel), 201


@api.route("/boards/<int:board_id>/pixels/<int:x>/<int:y>/color", methods=["PUT"])
def update_color(board_id, x, y):
    user_id = get_user_id()
    board = Board.query.get_or_404(board_id)
    validate_coordinates(board, x, y)

    update = PixelColorUpdateSchema().load(request.get_json())
    pixel = update_pixel_color(board, user_id, x, y, update.color)

    return PixelResponseSchema().dump(pixel)
