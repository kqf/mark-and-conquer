import importlib

import pytest


@pytest.fixture
def api(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "pixels.db"))
    import app

    return importlib.reload(app)


@pytest.fixture
def client(api):
    return api.app.test_client()


@pytest.fixture
def other_client(api):
    return api.app.test_client()


@pytest.fixture
def clock(api, monkeypatch):
    class Clock:
        def __init__(self):
            self.now = 1_700_000_000_000

        def advance(self, ms):
            self.now += ms

    clock = Clock()
    monkeypatch.setattr(api, "now_ms", lambda: clock.now)
    return clock
