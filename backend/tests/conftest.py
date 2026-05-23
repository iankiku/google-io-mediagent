import pytest
from unittest.mock import MagicMock


@pytest.fixture
def mock_genai_client():
    """A genai-style client where models.generate_content returns a settable text."""
    client = MagicMock()
    client.models = MagicMock()

    def make_response(text: str):
        resp = MagicMock()
        resp.text = text
        return resp

    client._set_response = lambda text: client.models.generate_content.configure_mock(
        return_value=make_response(text)
    )
    client._set_response("")
    return client
