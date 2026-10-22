"""alarm repetition and snooze

Revision ID: 1a648b7d11ee
Revises: cd7de96c5a76
Create Date: 2026-10-22 15:18:57.768327
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "1a648b7d11ee"
down_revision: str | None = "cd7de96c5a76"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("work_sessions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("alarm_token", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("alarm_started_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("last_alarm_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("snoozed_until", sa.DateTime(), nullable=True))
        batch_op.drop_column("alarm_sent_at")

    # Existing sessions get a random secret as well (SQLite).
    op.execute("UPDATE work_sessions SET alarm_token = lower(hex(randomblob(24)))")

    with op.batch_alter_table("work_sessions", schema=None) as batch_op:
        batch_op.alter_column("alarm_token", existing_type=sa.String(length=64), nullable=False)
        batch_op.create_index(
            batch_op.f("ix_work_sessions_alarm_token"), ["alarm_token"], unique=True
        )


def downgrade() -> None:
    with op.batch_alter_table("work_sessions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("alarm_sent_at", sa.DATETIME(), nullable=True))
        batch_op.drop_index(batch_op.f("ix_work_sessions_alarm_token"))
        batch_op.drop_column("snoozed_until")
        batch_op.drop_column("last_alarm_at")
        batch_op.drop_column("alarm_started_at")
        batch_op.drop_column("alarm_token")
