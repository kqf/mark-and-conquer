import pytest
from markandconquer.app import create_app


@pytest.fixture
def app(tmp_path):
    return create_app(db_path=tmp_path / "pixels.db")


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def other_client(app):
    return app.test_client()


@pytest.fixture
def clock():
    class Clock:
        def __init__(self):
            self.now = 1_700_000_000_000

        def advance(self, ms):
            self.now += ms

    return Clock()
