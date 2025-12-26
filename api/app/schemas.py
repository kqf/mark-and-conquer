from dataclasses import dataclass
from typing import Optional
import marshmallow_dataclass


@dataclass
class BoardCreate:
    width: int
    height: int
    default_color: str = "#FFFFFF"

@dataclass
class BoardResponse:
    id: int
    width: int
    height: int
    default_color: str

BoardCreateSchema = marshmallow_dataclass.class_schema(BoardCreate)
BoardResponseSchema = marshmallow_dataclass.class_schema(BoardResponse)


@dataclass
class PixelResponse:
    board_id: int
    x: int
    y: int
    color: str
    owner_id: Optional[str]
    version: int
    updated_at: Optional[str]

@dataclass
class PixelColorUpdate:
    color: str

PixelResponseSchema = marshmallow_dataclass.class_schema(PixelResponse)
PixelColorUpdateSchema = marshmallow_dataclass.class_schema(PixelColorUpdate)
