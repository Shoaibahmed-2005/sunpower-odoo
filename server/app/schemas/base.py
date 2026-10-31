"""Base for every request/response model: Python uses snake_case, the API speaks camelCase."""
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    # alias_generator: qty_on_hand <-> qtyOnHand · populate_by_name: our code can still use snake_case
    # from_attributes: build a response straight from a SQLAlchemy object
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)
