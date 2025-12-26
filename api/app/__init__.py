from flask import Flask
from .config import Config
from .extensions import db, ma
from .routes import api

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    ma.init_app(app)

    app.register_blueprint(api)

    return app
