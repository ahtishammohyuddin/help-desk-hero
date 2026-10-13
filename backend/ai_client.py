"""Thin client for the Gemini API (generateContent endpoint, structured JSON output).

Why plain httpx and not Google's SDK: one small dependency we already have,
and it is easy to replace with a fake in tests so tests never call the real API.

Any failure (no key, network error, quota hit, bad reply) raises AIUnavailable.
The caller then falls back to pre-written text, so the game keeps working.
"""

from __future__ import annotations

import json
import time
from typing import Any, Protocol

import httpx

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class AIUnavailable(Exception):
    """The AI could not give a usable answer. Use fallback text instead."""


class AIClient(Protocol):
    """Anything with this method can be used as the AI (the real client or a test fake)."""

    def generate_json(self, system: str, prompt: str, schema: dict) -> dict: ...


class GeminiClient:
    def __init__(
        self,
        api_key: str,
        model: str,
        timeout: float = 15.0,
        cooldown_seconds: float = 60.0,
        transport: httpx.BaseTransport | None = None,
    ):
        self.api_key = api_key
        self.model = model
        self.cooldown_seconds = cooldown_seconds
        self._paused_until = 0.0
        self._http = httpx.Client(timeout=timeout, transport=transport)

    def generate_json(self, system: str, prompt: str, schema: dict) -> dict:
        # After a quota error, stop calling for a while instead of hammering the API.
        if time.monotonic() < self._paused_until:
            raise AIUnavailable("AI paused after a quota error")

        body: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": schema,
                "temperature": 0.7,
                "maxOutputTokens": 1024,
            },
        }
        try:
            response = self._http.post(
                API_URL.format(model=self.model),
                # Header, not ?key=, so the key never appears in URLs or server logs.
                headers={"x-goog-api-key": self.api_key},
                json=body,
            )
        except httpx.HTTPError as exc:
            raise AIUnavailable(f"network error: {exc.__class__.__name__}") from exc

        if response.status_code == 429:
            self._paused_until = time.monotonic() + self.cooldown_seconds
            raise AIUnavailable("quota or rate limit reached")
        if response.status_code != 200:
            raise AIUnavailable(f"AI returned HTTP {response.status_code}")

        try:
            text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
            data = json.loads(text)
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise AIUnavailable("AI reply was not the expected JSON") from exc
        if not isinstance(data, dict):
            raise AIUnavailable("AI reply was not a JSON object")
        return data
