import pytest
from pydantic import ValidationError

from overworked.config import Settings


def test_login_is_off_without_password():
    assert not Settings().login_required


def test_login_is_on_with_password():
    assert Settings(password="secret", secret_key="k" * 32).login_required


def test_a_password_needs_a_secret_key():
    with pytest.raises(ValidationError, match="OVERWORKED_SECRET_KEY"):
        Settings(password="secret")


def test_the_secret_key_must_be_long():
    with pytest.raises(ValidationError, match="OVERWORKED_SECRET_KEY"):
        Settings(password="secret", secret_key="short")


def test_an_empty_password_counts_as_none():
    assert not Settings(password="").login_required


def test_refuses_to_run_without_password_where_one_is_required():
    """The Docker image sets require_password, so no public instance runs unprotected."""
    with pytest.raises(ValidationError, match="OVERWORKED_PASSWORD"):
        Settings(require_password=True)
