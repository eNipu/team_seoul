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


class DiscussionReply(ReplyBase):
    kind: Literal["discussion"]
    question: str = Field(min_length=1, max_length=200)


class ThreadEntry(ReplyBase):
    body: str = Field(min_length=1, max_length=400)


class ThreadReply(ReplyBase):
    kind: Literal["thread"]
    entries: list[ThreadEntry] = Field(min_length=2, max_length=6)


Reply = Annotated[
    AdviceReply | ChecklistReply | DraftReply | DiscussionReply | ThreadReply,
    Field(discriminator="kind"),
]


class ReplyView(BaseModel):
    view: Literal["reply"] = "reply"
    reply: Reply


class SavedRepliesView(BaseModel):
    view: Literal["saved_replies"] = "saved_replies"
    count: int = Field(ge=0)


class SaveReplyResult(BaseModel):
    saved: Literal[True] = True
    reply_id: str


class DeleteReplyResult(BaseModel):
    deleted: Literal[True] = True
