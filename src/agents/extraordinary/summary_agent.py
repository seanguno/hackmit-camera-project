from uagents import Agent, Context
from models import TextMessage

from anthropic import AsyncAnthropic, APIConnectionError, RateLimitError, APIStatusError


agent = Agent(name="alice", seed="secret_seed_phrase", 
        port=8000, endpoint=["http://localhost:8000/submit"],
    )

anthropic = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
CLAUDE_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")
SYSTEM_PROMPT = (
    "You are a concise assistant that summarizes user text in 1–2 sentences, "
    "preserving key facts and names."
)

@agent.on_message(model=TextMessage)
async def handle_message(ctx: Context, sender: str, msg: TextMessage):
    print(f"📝 Received message from {sender}: {msg.text}")
    
    # Simple summary logic (you can replace with AI later)
    summary = f"Summary of '{msg.text}': This is a placeholder summary. You can integrate with Claude/OpenAI here!"
    
    print(f"✅ Sending summary: {summary}")
    
    # Send response back to sender
    await ctx.send(sender, TextMessage(text=summary))

if __name__ == "__main__":
    agent.run()
