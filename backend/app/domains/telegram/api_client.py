from __future__ import annotations

from typing import Any

import requests


class ApiCallError(RuntimeError):
    pass


def call_api(
    url: str,
    method: str = "GET",
    body: Any = None,
    headers: dict[str, str] | None = None,
    params: dict[str, Any] | None = None,
    timeout: int = 30,
) -> dict[str, Any]:
    method = method.upper().strip()
    headers = headers or {}

    try:
        response = requests.request(
            method=method,
            url=url,
            json=body if isinstance(body, (dict, list)) else None,
            data=None if isinstance(body, (dict, list)) else body,
            headers=headers,
            params=params,
            timeout=timeout,
        )
    except requests.RequestException as exc:
        raise ApiCallError(f"Request failed: {exc}") from exc

    content_type = response.headers.get("content-type", "")
    parsed_body: Any
    if "application/json" in content_type.lower():
        try:
            parsed_body = response.json()
        except ValueError:
            parsed_body = response.text
    else:
        parsed_body = response.text

    return {
        "ok": response.ok,
        "status_code": response.status_code,
        "reason": response.reason,
        "url": response.url,
        "content_type": content_type,
        "body": parsed_body,
    }
