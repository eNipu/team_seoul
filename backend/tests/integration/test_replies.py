import pytest
from sqlalchemy import select

from app.models import AnalyticsEvent

DRAFT = {"kind": "draft", "title": "Photo walk with Maya", "body": "Hey Maya, want to go on a photo walk?"}
DISCUSSION = {
    "kind": "discussion",
    "title": "Reaching out to Maya",
    "body": "You could start with a small shared memory.",
    "question": "What would you like her to know?",
}
THREAD = {
    "kind": "thread",
    "title": "Reaching out to Maya",
    "body": "One low-pressure way to get in touch.",
    "entries": [
        {"title": "Start with a photo", "body": "Pick one from your old route."},
        {"title": "Give it time", "body": "Wait to see how she responds."},
    ],
}


def saved_replies(user):
    result = user.call("venn_saved_replies")
    assert not result.get("isError")
    replies = result["_meta"]["replies"]
    assert result["structuredContent"] == {"view": "saved_replies", "count": len(replies)}
    return replies


@pytest.mark.parametrize(
    "reply",
    [
        DRAFT,
        {"kind": "advice", "title": "Start small", "body": "Suggest a short walk."},
        {"kind": "checklist", "title": "Plan a photo walk", "body": "Pick a route.", "steps": ["Invite Maya."]},
        DISCUSSION,
        THREAD,
    ],
)
def test_reply_renders_with_no_saved_record(alice, reply):
    assert alice.ok("venn_show_reply", reply=reply) == {"view": "reply", "reply": reply}
    assert saved_replies(alice) == []


@pytest.mark.parametrize("reply", [DRAFT, DISCUSSION, THREAD])
def test_saved_reply_roundtrip_and_owner_isolation(alice, bob, db, reply):
    alice.ok("venn_show_reply", reply=reply)
    events = select(AnalyticsEvent).where(AnalyticsEvent.event_type == "reply_saved")
    assert db.scalars(events).all() == []
    saved = alice.ok("venn_save_reply", reply=reply)
    assert saved["saved"] is True
    assert alice.ok("venn_save_reply", reply=reply) == saved
    reply_id = saved["reply_id"]
    assert saved_replies(alice) == [{"reply_id": reply_id, "reply": reply}]
    assert saved_replies(bob) == []
    assert [event.event_metadata for event in db.scalars(events)] == [{"category": reply["kind"], "count": 1}]
    assert bob.err("venn_delete_saved_reply", reply_id=reply_id).startswith("NOT_FOUND")
    assert alice.ok("venn_delete_saved_reply", reply_id=reply_id) == {"deleted": True}
    assert saved_replies(alice) == []


@pytest.mark.parametrize("tool", ["venn_show_reply", "venn_save_reply"])
def test_reply_rejects_secrets_and_raw_context(alice, tool):
    assert alice.err(tool, reply={**DRAFT, "body": "My password is secret."}).startswith("PRIVACY_VIOLATION")
    assert alice.err(tool, reply={**DISCUSSION, "question": "My password is secret."}).startswith("PRIVACY_VIOLATION")
    entry = {"title": "Keep the link", "body": "My password is secret."}
    assert alice.err(tool, reply={**THREAD, "entries": [THREAD["entries"][0], entry]}).startswith("PRIVACY_VIOLATION")
    assert alice.call(tool, reply={**DRAFT, "conversation": "raw chat history"})["isError"]
    assert alice.call(tool, reply={**THREAD, "entries": [entry]})["isError"]
    assert saved_replies(alice) == []


def test_reply_tools_advertise_structured_output_and_widget_visibility(alice):
    tools = {tool["name"]: tool for tool in alice.rpc("tools/list").json()["result"]["tools"]}
    show = tools["venn_show_reply"]
    assert show["outputSchema"]["properties"]["reply"]["discriminator"]["propertyName"] == "kind"
    assert show["_meta"]["ui"]["resourceUri"] == "ui://venn/app-v2.html"
    assert tools["venn_saved_replies"]["outputSchema"]["properties"].keys() == {"view", "count"}
    for name in ("venn_save_reply", "venn_delete_saved_reply"):
        assert tools[name]["_meta"]["ui"]["visibility"] == ["app"]
        assert tools[name]["outputSchema"]["type"] == "object"
