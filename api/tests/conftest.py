import pytest
from markandconquer import app as module

from markandconquer import app as module


@pytest.fixture
def api():
    """The module itself, for the constants and for the clock to patch."""
    return module


@pytest.fixture
def app(tmp_path):
    """A fresh app per test, pointed at a database of its own. No reload
    trick any more: create_app() is the thing that builds the state."""
    return module.create_app(db_path=tmp_path / "pixels.db")


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def other_client(app):
    return app.test_client()


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
