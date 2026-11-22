from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class ReplyBase(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=100)
    body: str = Field(min_length=1, max_length=1200)


class AdviceReply(ReplyBase):
    kind: Literal["advice"]


class ChecklistReply(ReplyBase):
    kind: Literal["checklist"]
    steps: list[Annotated[str, StringConstraints(min_length=1, max_length=200)]] = Field(min_length=1, max_length=6)


class DraftReply(ReplyBase):
    kind: Literal["draft"]


Reply = Annotated[AdviceReply | ChecklistReply | DraftReply, Field(discriminator="kind")]
