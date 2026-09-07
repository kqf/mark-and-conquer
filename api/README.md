# Mark and Conquer: the API

## Development

```sh
pip install -r requirements.txt
pip install -e .
pytest tests/
```

## Running the server

Starting with various servers

```bash
# For dev server use either
flask --app markandconquer.app run --debug

# or
python -m markandconquer.app

# For production use:
gunicorn 'markandconquer.app:create_app()'
```
