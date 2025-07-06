import asyncio

async def process_event(event: dict):
    """Dummy pipeline processing; returns topic, value, headers."""
    await asyncio.sleep(0)  # simulate async work
    if event.get("bad_json"):
        # for tests: event indicates should go to DLQ
        return "rau_events_dlq", {"error": "bad"}, {"reason": "bad_event"}
    return "alerts", event, {}
