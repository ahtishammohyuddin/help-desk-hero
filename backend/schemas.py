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
    character_name: str  # lets the game send the ticket to the matching employee
    gender: str
    hands_on: bool = False  # solved by investigating in the office instead of picking an option


class Character(BaseModel):
    name: str
    department: str
    personality: str
    gender: str


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
    hands_on: bool = False


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


class PhysicalStep(BaseModel):
    """A place in the office to walk to, and what to do there, after choosing the right fix."""

    place: Literal["printer", "parts_cabinet", "server_room"]
    action: str


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
    # Only sent when the answer is right: listing them earlier would give the answer away.
    physical_steps: list[PhysicalStep] | None = None


class HandsOn(BaseModel):
    """A hands-on scenario. The game simulates the office kit from this.

    It says what is broken (the player finds it by looking), but never the explanations
    or the tip: those come from /check or /hands-on/finish, as for normal tickets.
    Decoys are the problem's wrong options, offered as other things to try.
    """

    problem_id: str
    faults: list[str]
    goal: str
    required: list[str]
    decoys: list[PublicOption]


class FinishRequest(BaseModel):
    attempt: int = Field(1, ge=1, le=MAX_ATTEMPTS)  # 2 if the player tried one wrong thing first


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
