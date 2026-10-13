"""Request and response shapes for the API.

Important: the public problem model has NO answer data. The correct answer,
the explanations and the hints are only returned by the answer and hint
endpoints, so the browser cannot read them before the player answers.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Health(BaseModel):
    status: str
    problems_loaded: int
    ai_enabled: bool


class ProblemSummary(BaseModel):
    id: str
    level: int
    category: str
    title: str


class Character(BaseModel):
    name: str
    department: str
    personality: str


class PublicOption(BaseModel):
    id: int  # position in the original file; used when answering
    text: str


class ProblemPublic(BaseModel):
    id: str
    level: int
    category: str
    title: str
    character: Character
    user_description: str
    options: list[PublicOption]
    hint_count: int


class AnswerRequest(BaseModel):
    option_id: int


class Explanation(BaseModel):
    option_id: int
    text: str
    correct: bool
    why: str


class AnswerResult(BaseModel):
    problem_id: str
    chosen_option_id: int
    is_correct: bool
    correct_option_id: int
    explanations: list[Explanation]
    real_world_tip: str | None = None


MAX_ATTEMPTS = 2  # first try, plus one second chance


class CheckRequest(BaseModel):
    option_id: int
    attempt: int = Field(1, ge=1, le=MAX_ATTEMPTS)  # which try this is
    next_hint: int = Field(1, ge=1, le=20)  # the hint number to send if this try is wrong


class CheckResult(BaseModel):
    """Result of one try.

    While `final` is false, the correct answer is NOT included: only why the chosen
    option is wrong, plus a hint. Everything is revealed once the ticket is final
    (answered correctly, or the last try was used).
    """

    problem_id: str
    attempt: int
    chosen_option_id: int
    is_correct: bool
    final: bool
    attempts_left: int
    chosen_why: str
    hint: str | None = None
    correct_option_id: int | None = None
    explanations: list[Explanation] | None = None
    real_world_tip: str | None = None


class HintResponse(BaseModel):
    problem_id: str
    number: int  # which hint this is, starting at 1
    total: int
    hint: str


# ---------- AI features ----------

Source = Literal["ai", "cache", "fallback"]


class RephraseResponse(BaseModel):
    problem_id: str
    user_description: str
    source: Source  # "fallback" means the pre-written text was used


class ChatTurn(BaseModel):
    role: Literal["junior", "senior"]
    text: str = Field(min_length=1, max_length=700)


class SeniorRequest(BaseModel):
    question: str = Field(min_length=2, max_length=300)
    history: list[ChatTurn] = Field(default_factory=list, max_length=6)


class SeniorResponse(BaseModel):
    problem_id: str
    answer: str
    source: Source
