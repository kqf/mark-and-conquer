# Mark and Conquer: the API

The Flask backend: one file, one SQLite database, no ORM. It serves
`/api/*` and, once `web/` has been built, the SPA in `web/dist` from the
same origin.

## Development

```sh
pip install -r requirements.txt
pip install -e .
pytest tests/
```

Run it with `flask --app markandconquer.app run --debug`. For production,
`pip install -e .[server]` pulls in gunicorn:
`gunicorn markandconquer.app:app`.
