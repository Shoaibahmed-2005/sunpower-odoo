"""Date helper shared by stock validate and the seed."""
import calendar
from datetime import date


def add_months(start: date, months: int) -> date:
    """31 Jan + 1 month = 28/29 Feb: the day is clamped to the last day of the target month."""
    month_index = start.month - 1 + months
    year, month = start.year + month_index // 12, month_index % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)
