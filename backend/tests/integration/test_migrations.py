from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

from overworked.db import make_engine
from overworked.migrations import upgrade_to_head
from overworked.models import Base


def test_migrations_produce_the_schema_of_the_models(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'db.sqlite'}")

    upgrade_to_head(engine)

    with engine.connect() as connection:
        context = MigrationContext.configure(connection)
        assert compare_metadata(context, Base.metadata) == []


def test_upgrading_twice_is_harmless(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'db.sqlite'}")

    upgrade_to_head(engine)
    upgrade_to_head(engine)
