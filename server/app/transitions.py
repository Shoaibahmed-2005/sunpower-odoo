"""State transition maps and validator."""
from app.errors import ApiError

TRANSITIONS = {
    "lead": {
        "NEW": ["CONTACTED", "QUALIFIED", "LOST"],
        "CONTACTED": ["QUALIFIED", "LOST"],
        "QUALIFIED": ["SURVEY_SCHEDULED", "LOST"],
        "SURVEY_SCHEDULED": ["SURVEY_APPROVED", "QUALIFIED", "LOST"],
        "SURVEY_APPROVED": ["QUOTED", "LOST"],
        "QUOTED": ["WON", "LOST"],
    },
    "survey": {
        "SCHEDULED": ["SUBMITTED"],
        "SUBMITTED": ["APPROVED", "REJECTED"],
    },
    "quotation": {
        "DRAFT": ["SENT", "CONFIRMED", "CANCELLED"],
        "SENT": ["CONFIRMED", "CANCELLED"],
    },
    "job": {
        "SCHEDULED": ["DISPATCHED"],
        "DISPATCHED": ["IN_PROGRESS"],
        "IN_PROGRESS": ["DONE"],
    },
    "dispatch": {
        "READY": ["DONE", "CANCELLED"],
    },
    "ticket": {
        "NEW": ["ASSIGNED"],
        "ASSIGNED": ["IN_REPAIR"],
        "IN_REPAIR": ["RESOLVED"],
        "RESOLVED": ["CLOSED"],
    },
    "invoice": {
        "DUE": ["PAID"],
    },
}


def assert_transition(entity: str, current, target) -> None:
    """Validate that moving `entity` from `current` to `target` is legal.

    Raises:
        ApiError(409, "Cannot move <entity> from <current> to <target>") if transition is forbidden.
    """
    curr_str = current.value if hasattr(current, "value") else str(current)
    target_str = target.value if hasattr(target, "value") else str(target)

    allowed = TRANSITIONS.get(entity, {}).get(curr_str, [])
    if target_str not in allowed:
        raise ApiError(409, f"Cannot move {entity} from {curr_str} to {target_str}")
