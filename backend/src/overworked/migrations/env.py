from alembic import context
from sqlalchemy import Connection

from overworked.config import Settings
from overworked.db import make_engine
from overworked.models import Base, UTCDateTime


def render_item(type_, obj, autogen_context):
    # Migrations must not import app code that may change later; on disk it is a plain DateTime.
    if type_ == "type" and isinstance(obj, UTCDateTime):
        return "sa.DateTime()"
    return False


def skip_empty_revision(context, revision, directives):
    # Only relevant for `alembic revision --autogenerate`.
    if directives[0].upgrade_ops.is_empty():
        directives[:] = []
        print("Keine Änderungen an den Modellen, keine Migration erzeugt.")


def run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        # Batch mode: SQLite can only alter tables by recreating them.
        render_as_batch=True,
        render_item=render_item,
        process_revision_directives=skip_empty_revision,
    )
    with context.begin_transaction():
        context.run_migrations()


connection = context.config.attributes.get("connection")
if connection is not None:
    # Called from the app (upgrade_to_head) with an open connection.
    run_migrations(connection)
else:
    # Called from the alembic CLI, e.g. `uv run alembic revision --autogenerate -m "..."`.
    url = context.config.get_main_option("sqlalchemy.url") or Settings().database_url
    with make_engine(url).connect() as cli_connection:
        run_migrations(cli_connection)
