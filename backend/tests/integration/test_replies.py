import pytest

DRAFT = {"kind": "draft", "title": "Photo walk with Maya", "body": "Hey Maya, want to go on a photo walk?"}


@pytest.mark.parametrize(
    "reply",
    [
        DRAFT,
        {"kind": "advice", "title": "Start small", "body": "Suggest a short walk."},
        {"kind": "checklist", "title": "Plan a photo walk", "body": "Pick a route.", "steps": ["Invite Maya."]},
    ],
)
def test_reply_renders_with_no_saved_record(alice, reply):
    assert alice.ok("venn_show_reply", reply=reply) == {"view": "reply", "reply": reply}
    assert alice.ok("venn_saved_replies") == {"view": "saved_replies", "replies": []}


def test_saved_reply_roundtrip_and_owner_isolation(alice, bob):
    saved = alice.ok("venn_save_reply", reply=DRAFT)
    assert saved["saved"] is True
    assert alice.ok("venn_save_reply", reply=DRAFT) == saved
    reply_id = saved["reply_id"]
    assert alice.ok("venn_saved_replies")["replies"] == [{"reply_id": reply_id, "reply": DRAFT}]
    assert bob.ok("venn_saved_replies")["replies"] == []
    assert bob.err("venn_delete_saved_reply", reply_id=reply_id).startswith("NOT_FOUND")
    assert alice.ok("venn_delete_saved_reply", reply_id=reply_id) == {"deleted": True}
    assert alice.ok("venn_saved_replies")["replies"] == []


@pytest.mark.parametrize("tool", ["venn_show_reply", "venn_save_reply"])
def test_reply_rejects_secrets_and_raw_context(alice, tool):
    assert alice.err(tool, reply={**DRAFT, "body": "My password is secret."}).startswith("PRIVACY_VIOLATION")
    assert alice.call(tool, reply={**DRAFT, "conversation": "raw chat history"})["isError"]
    assert alice.ok("venn_saved_replies")["replies"] == []
