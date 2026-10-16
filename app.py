"""Entry point for hosting on Vercel (free Hobby plan).

Vercel looks for a FastAPI instance named `app` in app.py. The real app lives in backend/main.py;
this file just exposes it. Locally you still run: uvicorn backend.main:app --reload
"""

from backend.main import app  # noqa: F401
