import os

import pytest


def test_board_describes_the_canvas(client):
    board = client.get("/api/board").get_json()
    assert board["width"] == 32
    assert board["height"] == 32
    assert board["background"] in board["palette"]


def test_board_starts_empty(client):
    assert client.get("/api/pixels").get_json() == []


def test_placed_pixel_shows_up_on_the_board(client):
    client.put("/api/pixels/3/4", json={"color": "#FF4500"})

    assert client.get("/api/pixels").get_json() == [
        {"x": 3, "y": 4, "color": "#FF4500"}
    ]


def test_placing_a_pixel_starts_the_cooldown(client, api, clock):
    response = client.put("/api/pixels/0/0", json={"color": "#FF4500"})

    assert response.status_code == 200
    assert response.get_json() == {"nextAllowedAt": clock.now + api.COOLDOWN_MS}


def test_cooldown_survives_a_reload(client):
    deadline = client.put("/api/pixels/0/0", json={"color": "#FF4500"}).get_json()

    assert client.get("/api/cooldown").get_json() == deadline


def test_cooldown_starts_at_zero(client):
    assert client.get("/api/cooldown").get_json() == {"nextAllowedAt": 0}


def test_second_pixel_during_the_cooldown_is_rejected(client, api, clock):
    client.put("/api/pixels/0/0", json={"color": "#FF4500"})

    response = client.put("/api/pixels/1/1", json={"color": "#FF4500"})

    assert response.status_code == 429
    assert response.headers["Retry-After"] == "5"
    assert response.get_json() == {"nextAllowedAt": clock.now + api.COOLDOWN_MS}


def test_pixel_rejected_by_the_cooldown_is_not_drawn(client, clock):
    client.put("/api/pixels/0/0", json={"color": "#FF4500"})

    client.put("/api/pixels/1/1", json={"color": "#FF4500"})

    assert client.get("/api/pixels").get_json() == [
        {"x": 0, "y": 0, "color": "#FF4500"}
    ]


def test_pixel_can_be_overwritten_once_the_cooldown_expires(client, api, clock):
    client.put("/api/pixels/3/4", json={"color": "#FF4500"})

    clock.advance(api.COOLDOWN_MS)
    response = client.put("/api/pixels/3/4", json={"color": "#2450A4"})

    assert response.status_code == 200
    assert client.get("/api/pixels").get_json() == [
        {"x": 3, "y": 4, "color": "#2450A4"}
    ]


def test_cooldown_is_per_user(client, other_client, clock):
    client.put("/api/pixels/0/0", json={"color": "#FF4500"})

    response = other_client.put("/api/pixels/1/1", json={"color": "#FF4500"})

    assert response.status_code == 200


@pytest.mark.parametrize("x, y", [(32, 0), (0, 32), (-1, 0), (0, -1)])
def test_pixel_outside_the_board_is_rejected(client, x, y):
    response = client.put(f"/api/pixels/{x}/{y}", json={"color": "#FF4500"})

    assert response.status_code == 400
    assert response.get_json() == {"error": "Pixel out of board bounds"}


def test_color_outside_the_palette_is_rejected(client):
    response = client.put("/api/pixels/0/0", json={"color": "#123456"})

    assert response.status_code == 400
    assert response.get_json() == {"error": "Color not in palette"}


def test_request_without_a_color_is_rejected(client):
    response = client.put("/api/pixels/0/0")

    assert response.status_code == 400
    assert response.get_json() == {"error": "Color not in palette"}


def test_rejected_pixel_does_not_start_a_cooldown(client):
    client.put("/api/pixels/0/0", json={"color": "#123456"})

    assert client.get("/api/cooldown").get_json() == {"nextAllowedAt": 0}


def test_health_reports_ok(client):
    assert client.get("/health").get_json() == {"status": "ok"}


@pytest.fixture
def built_frontend(api):
    """Skips a test when web/dist has not been built yet."""
    if not os.path.isfile(os.path.join(api.DIST, "index.html")):
        pytest.skip("frontend not built: run `npm run build` in web/")


def test_unknown_path_serves_the_spa(client, built_frontend):
    response = client.get("/some/deep/link")

    assert response.status_code == 200
    assert b"<div id=\"root\">" in response.data


def test_existing_file_is_served_as_is(client, built_frontend):
    assert client.get("/mockServiceWorker.js").status_code == 200
