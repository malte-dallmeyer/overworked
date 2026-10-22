import pytest

from overworked.targets import quick_targets

H730, H800, H500 = 450, 480, 300


@pytest.mark.parametrize(
    ("started", "choices"),
    [
        # The examples from the story map: 7:30 and 8:00 count as two earlier starts.
        ([], [H730, H800]),
        ([H500], [H500, H730, H800]),
        ([H500, H500], [H500, H730, H800]),
        ([H500, H500, H500], [H500, H730, H800]),
        ([H500, H500, H500, H500], [H500, H800]),
        ([H500, H500, H500, H500, H500], [H500]),
    ],
)
def test_choices_are_the_targets_of_the_last_five_starts(started, choices):
    assert quick_targets(started).choices == choices


def test_choices_are_sorted_by_duration():
    assert quick_targets([H800, H730, 420]).choices == [420, H730, H800]


def test_prefills_the_last_target():
    assert quick_targets([H500, 420]).last == 420


def test_prefills_eight_hours_at_first():
    assert quick_targets([]).last == H800
