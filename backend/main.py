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

import hashlib
import os
import random
from datetime import date as Date
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
    FinishRequest,
    HandsOn,
    Health,
    HintResponse,
    PhysicalStep,
    ProblemPublic,
    ProblemSummary,
    PublicOption,
    RephraseResponse,
    SeniorRequest,
    SeniorResponse,
    CoachRequest,
    CoachResponse,
    CoachTip,
    DailyChallenge,
    EscalateRequest,
    EscalationDetail,
    EscalationForm,
    EscalationResult,
    EscalationReview,
    EscalationTeam,
)
from backend.ai_service import coach_facts
from tools.validate_problems import CATEGORIES, ESCALATION_TEAMS

MAX_COACH_TIPS = 2
DAILY_COUNT = 5
DAILY_MAX_LEVEL = 2  # the daily challenge is for everyone, so it stays at levels 1 and 2


def daily_problem_ids(problems: list[dict], day: str, count: int = DAILY_COUNT) -> list[str]:
    """Pick the day's problems: the same for everyone on that date, different each day.

    Each eligible problem gets a score from a hash of (date, id); the lowest scores win.
    Only reviewed question tickets (not hands-on) at the daily levels are used.
    """
    eligible = [p["id"] for p in problems if "hands_on" not in p and p["level"] <= DAILY_MAX_LEVEL]
    ranked = sorted(eligible, key=lambda pid: hashlib.sha256(f"{day}|{pid}".encode()).hexdigest())
    return ranked[:count]

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
            {
                **p,
                "character_name": p["character"]["name"],
                "gender": p["character"]["gender"],
                "hands_on": "hands_on" in p,
            }
            for p in store_of(request).list(level=level, category=category)
        ]

    @app.get("/problems/{problem_id}", response_model=ProblemPublic)
    def get_problem(request: Request, problem_id: str) -> ProblemPublic:
        return public_problem(find_or_404(request, problem_id))

    @app.get("/daily/{day}", response_model=DailyChallenge)
    def daily(request: Request, day: str = PathParam(..., pattern=r"^\d{4}-\d{2}-\d{2}$")) -> DailyChallenge:
        """The daily challenge for a date (the player's own local date, YYYY-MM-DD)."""
        try:
            Date.fromisoformat(day)
        except ValueError:
            raise HTTPException(status_code=422, detail="Not a real date") from None
        store = store_of(request)
        ids = daily_problem_ids(store.list(), day)
        return DailyChallenge(date=day, problems=[public_problem(store.get(pid)) for pid in ids])

    def public_problem(problem: dict) -> ProblemPublic:
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
            hands_on="hands_on" in problem,
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
            if is_correct and problem.get("physical_steps"):
                result.physical_steps = [PhysicalStep(**step) for step in problem["physical_steps"]]
            if is_correct and problem.get("escalation"):
                result.escalation = escalation_form(problem["escalation"])
        elif body.next_hint <= len(problem["hints"]):
            result.hint = problem["hints"][body.next_hint - 1]
        return result

    def escalation_form(escalation: dict) -> EscalationForm:
        details = [EscalationDetail(id=i, text=d["text"]) for i, d in enumerate(escalation["details"])]
        random.shuffle(details)  # the order in the file must not give the answer away
        return EscalationForm(
            teams=[EscalationTeam(id=k, name=v) for k, v in ESCALATION_TEAMS.items()],
            details=details,
        )

    @app.post("/problems/{problem_id}/escalate", response_model=EscalationResult)
    def escalate(request: Request, problem_id: str, body: EscalateRequest) -> EscalationResult:
        """Check the escalation form against the reviewed answer in the problem file."""
        problem = find_or_404(request, problem_id)
        escalation = problem.get("escalation")
        if escalation is None:
            raise HTTPException(status_code=404, detail="This problem is not escalated")
        if body.team not in ESCALATION_TEAMS:
            raise HTTPException(status_code=400, detail="Unknown team")
        details = escalation["details"]
        chosen = set(body.details)
        if any(not 0 <= i < len(details) for i in chosen):
            raise HTTPException(status_code=400, detail="Unknown detail id")
        should = {i for i, d in enumerate(details) if d["send"]}
        team_correct = body.team == escalation["team"]
        return EscalationResult(
            problem_id=problem["id"],
            team_correct=team_correct,
            chosen_team=body.team,
            correct_team=EscalationTeam(id=escalation["team"], name=ESCALATION_TEAMS[escalation["team"]]),
            team_why=escalation["team_why"],
            details=[
                EscalationReview(id=i, text=d["text"], send=d["send"], chosen=i in chosen, why=d["why"])
                for i, d in enumerate(details)
            ],
            perfect=team_correct and chosen == should,
        )

    @app.get("/problems/{problem_id}/hands-on", response_model=HandsOn)
    def get_hands_on(request: Request, problem_id: str) -> HandsOn:
        problem = find_or_404(request, problem_id)
        scenario = problem.get("hands_on")
        if scenario is None:
            raise HTTPException(status_code=404, detail="This problem has no hands-on scenario")
        decoys = [PublicOption(id=i, text=o["text"]) for i, o in enumerate(problem["options"]) if not o["correct"]]
        random.shuffle(decoys)
        return HandsOn(
            problem_id=problem["id"],
            faults=scenario["faults"],
            goal=scenario["goal"],
            required=scenario.get("required", []),
            decoys=decoys,
        )

    @app.post("/problems/{problem_id}/hands-on/finish", response_model=CheckResult)
    def finish_hands_on(request: Request, problem_id: str, body: FinishRequest) -> CheckResult:
        """The player fixed it in the office. Wrong things they tried go through /check as normal."""
        problem = find_or_404(request, problem_id)
        if "hands_on" not in problem:
            raise HTTPException(status_code=404, detail="This problem has no hands-on scenario")
        options = problem["options"]
        correct_id = next(i for i, o in enumerate(options) if o["correct"])
        return CheckResult(
            problem_id=problem["id"],
            attempt=body.attempt,
            chosen_option_id=correct_id,
            is_correct=True,
            final=True,
            attempts_left=0,
            chosen_why=options[correct_id]["why"],
            correct_option_id=correct_id,
            explanations=[
                Explanation(option_id=i, text=o["text"], correct=o["correct"], why=o["why"])
                for i, o in enumerate(options)
            ],
            real_world_tip=problem.get("real_world_tip"),
        )

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

    @app.post("/coach", response_model=CoachResponse)
    def coach(request: Request, body: CoachRequest) -> CoachResponse:
        """A short end-of-shift note. Facts are worked out here; the AI only words them,
        and any advice comes from real-world tips in reviewed problems the player missed."""
        for topic in body.topics:
            if topic.category not in CATEGORIES:
                raise HTTPException(status_code=422, detail="Unknown category")
            if topic.first_try > topic.total:
                raise HTTPException(status_code=422, detail="first_try cannot exceed total")
        stats = body.model_dump()
        facts = coach_facts(stats)

        store = store_of(request)
        tips: list[dict] = []
        seen: set[str] = set()
        candidates = [store.get(pid) for pid in body.missed]  # unknown or unreviewed ids give None
        if facts["weakest"]:  # then a tip from the topic to practise
            candidates += sorted(store.list(category=facts["weakest"]["category"]), key=lambda p: p["id"])
        for problem in candidates:
            if problem and problem.get("real_world_tip") and problem["id"] not in seen:
                seen.add(problem["id"])
                tips.append({"problem_title": problem["title"], "tip": problem["real_world_tip"]})
            if len(tips) >= MAX_COACH_TIPS:
                break

        message, source = request.app.state.ai.coach(facts, tips, _client_id(request))
        return CoachResponse(message=message, tips=[CoachTip(**t) for t in tips], source=source)

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
