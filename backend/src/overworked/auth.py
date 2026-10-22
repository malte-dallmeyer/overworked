from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from overworked.db import get_db
from overworked.models import User

# Single-user mode: every request belongs to this user. Real accounts replace
# get_current_user() and nothing else.
SINGLE_USER_ID = 1


def ensure_single_user(db: Session) -> None:
    if db.get(User, SINGLE_USER_ID) is None:
        db.add(User(id=SINGLE_USER_ID, name="me"))
        db.commit()


def get_current_user(db: Annotated[Session, Depends(get_db)]) -> User:
    user = db.get(User, SINGLE_USER_ID)
    assert user is not None, "single user is created at startup"
    return user
