"""Help Desk Hero backend (FastAPI).

Run locally from the repo root:
    uvicorn backend.main:app --reload
Then open http://127.0.0.1:8000/docs for the interactive API page.

Settings (environment variables, all optional):
    PROBLEMS_DIR      folder with the problem JSON files (default: ./problems)
    ALLOWED_ORIGINS   comma-separated list of websites allowed to call the API
                      from a browser (default: * which means any site; the API
                      is read-only and has no logins, so this is acceptable
                      for development. Set it to your Netlify URL in production.)
    GEMINI_API_KEY    turns on the AI features. Without it the game runs in
                      fallback mode using only pre-written text.
    GEMINI_MODEL      default: gemini-3.5-flash-lite (a free-tier Flash-Lite model)
    AI_DAILY_LIMIT    max AI calls per day for the whole server (default 300)
    AI_CLIENT_LIMIT   max AI calls per player per 10 minutes (default 20)
"""

from __future__ import annotations

import os
import random
from pathlib import Path

from fastapi import FastAPI, HTTPException, Path as PathParam, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from backend.ai_client import AIClient, GeminiClient
from backend.ai_service import AIService
from backend.limits import RateLimiter
from backend.problems import ProblemStore
from backend.schemas import (
    MAX_ATTEMPTS,
    AnswerRequest,
    AnswerResult,
    CheckRequest,
    CheckResult,
    Explanation,
    Health,
    HintResponse,
    ProblemPublic,
    ProblemSummary,
    PublicOption,
    RephraseResponse,
    SeniorRequest,
    SeniorResponse,
)

DEFAULT_PROBLEMS_DIR = Path(__file__).resolve().parent.parent / "problems"
DEFAULT_MODEL = "gemini-3.5-flash-lite"
FROM_ENV = object()  # marker: "build the AI client from environment variables"


def _ai_client_from_env() -> AIClient | None:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        return None
    return GeminiClient(api_key=key, model=os.environ.get("GEMINI_MODEL", DEFAULT_MODEL))


def _client_id(request: Request) -> str:
    # Behind a host like Render, the real player address is in X-Forwarded-For.
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _origins_from_env() -> list[str]:
    raw = os.environ.get("ALLOWED_ORIGINS", "*")
    return [o.strip() for o in raw.split(",") if o.strip()] or ["*"]


def create_app(problems_dir: Path | None = None, ai_client: object = FROM_ENV) -> FastAPI:
    """Build the app. A function (not a global) so tests can pass their own
    problem folder and a fake AI client (pass ai_client=None for fallback mode)."""
    folder = problems_dir or Path(os.environ.get("PROBLEMS_DIR", DEFAULT_PROBLEMS_DIR))
    client = _ai_client_from_env() if ai_client is FROM_ENV else ai_client

    app = FastAPI(title="Help Desk Hero API", version="0.2.0")
    app.state.store = ProblemStore(folder)
    app.state.ai = AIService(
        client,  # type: ignore[arg-type]
        limiter=RateLimiter(
            per_client=int(os.environ.get("AI_CLIENT_LIMIT", 20)),
            daily_total=int(os.environ.get("AI_DAILY_LIMIT", 300)),
        ),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins_from_env(),
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    def store_of(request: Request) -> ProblemStore:
        return request.app.state.store

    def find_or_404(request: Request, problem_id: str) -> dict:
        problem = store_of(request).get(problem_id)
        if problem is None:
            raise HTTPException(status_code=404, detail="Problem not found")
        return problem

    @app.get("/health", response_model=Health)
    def health(request: Request) -> Health:
        # The game polls this to show "Waking up the office..." while a free host wakes up.
        return Health(
            status="ok",
            problems_loaded=len(store_of(request)),
            ai_enabled=request.app.state.ai.enabled,
        )

    @app.get("/problems", response_model=list[ProblemSummary])
    def list_problems(
        request: Request,
        level: int | None = Query(None, ge=1, le=5),
        category: str | None = None,
    ) -> list[dict]:
        return [
            {**p, "character_name": p["character"]["name"], "gender": p["character"]["gender"]}
            for p in store_of(request).list(level=level, category=category)
        ]

    @app.get("/problems/{problem_id}", response_model=ProblemPublic)
    def get_problem(request: Request, problem_id: str) -> ProblemPublic:
        problem = find_or_404(request, problem_id)
        # Shuffle so the correct answer is not always in the same place.
        # Each option keeps its original id so answers can still be checked.
        indexed = list(enumerate(problem["options"]))
        random.shuffle(indexed)
        return ProblemPublic(
            id=problem["id"],
            level=problem["level"],
            category=problem["category"],
            title=problem["title"],
            character=problem["character"],
            user_description=problem["user_description"],
            options=[PublicOption(id=i, text=o["text"]) for i, o in indexed],
            hint_count=len(problem["hints"]),
        )

    @app.post("/problems/{problem_id}/answer", response_model=AnswerResult)
    def answer_problem(request: Request, problem_id: str, body: AnswerRequest) -> AnswerResult:
        problem = find_or_404(request, problem_id)
        options = problem["options"]
        if not 0 <= body.option_id < len(options):
            raise HTTPException(status_code=400, detail="Unknown option id")

        correct_id = next(i for i, o in enumerate(options) if o["correct"])
        return AnswerResult(
            problem_id=problem["id"],
            chosen_option_id=body.option_id,
            is_correct=body.option_id == correct_id,
            correct_option_id=correct_id,
            explanations=[
                Explanation(option_id=i, text=o["text"], correct=o["correct"], why=o["why"])
                for i, o in enumerate(options)
            ],
            real_world_tip=problem.get("real_world_tip"),
        )

    @app.post("/problems/{problem_id}/check", response_model=CheckResult)
    def check_answer(request: Request, problem_id: str, body: CheckRequest) -> CheckResult:
        """One try at a ticket. Used by the game; gives a second chance after a wrong first try."""
        problem = find_or_404(request, problem_id)
        options = problem["options"]
        if not 0 <= body.option_id < len(options):
            raise HTTPException(status_code=400, detail="Unknown option id")

        chosen = options[body.option_id]
        correct_id = next(i for i, o in enumerate(options) if o["correct"])
        is_correct = body.option_id == correct_id
        final = is_correct or body.attempt >= MAX_ATTEMPTS
        result = CheckResult(
            problem_id=problem["id"],
            attempt=body.attempt,
            chosen_option_id=body.option_id,
            is_correct=is_correct,
            final=final,
            attempts_left=0 if final else MAX_ATTEMPTS - body.attempt,
            chosen_why=chosen["why"],
        )
        if final:
            result.correct_option_id = correct_id
            result.explanations = [
                Explanation(option_id=i, text=o["text"], correct=o["correct"], why=o["why"])
                for i, o in enumerate(options)
            ]
            result.real_world_tip = problem.get("real_world_tip")
        elif body.next_hint <= len(problem["hints"]):
            result.hint = problem["hints"][body.next_hint - 1]
        return result

    @app.get("/problems/{problem_id}/hints/{number}", response_model=HintResponse)
    def get_hint(
        request: Request,
        problem_id: str,
        number: int = PathParam(..., ge=1),
    ) -> HintResponse:
        problem = find_or_404(request, problem_id)
        hints = problem["hints"]
        if number > len(hints):
            raise HTTPException(status_code=404, detail="No more hints for this problem")
        return HintResponse(
            problem_id=problem["id"], number=number, total=len(hints), hint=hints[number - 1]
        )

    @app.post("/problems/{problem_id}/rephrase", response_model=RephraseResponse)
    def rephrase(request: Request, problem_id: str) -> RephraseResponse:
        problem = find_or_404(request, problem_id)
        text, source = request.app.state.ai.rephrase(problem, _client_id(request))
        return RephraseResponse(problem_id=problem["id"], user_description=text, source=source)

    @app.post("/problems/{problem_id}/ask", response_model=SeniorResponse)
    def ask_senior(request: Request, problem_id: str, body: SeniorRequest) -> SeniorResponse:
        # The game only shows this button after the player has answered.
        problem = find_or_404(request, problem_id)
        answer, source = request.app.state.ai.ask_senior(
            problem,
            body.question,
            [turn.model_dump() for turn in body.history],
            _client_id(request),
        )
        return SeniorResponse(problem_id=problem["id"], answer=answer, source=source)

    return app


app = create_app()
