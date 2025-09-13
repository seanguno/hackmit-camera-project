#!/usr/bin/env python3
"""
Simple client to send messages to the summary agent
"""
from uagents import Agent, Context
from models import TextMessage

# Create a simple client agent with endpoint
client = Agent(name="message_sender", seed="sender_seed", port=8001, endpoint=["http://localhost:8001/submit"])

@client.on_message(model=TextMessage)
async def handle_response(ctx: Context, sender: str, msg: TextMessage):
    print(f"🎉 Received response: {msg.text}")

@client.on_interval(period=10.0)  # Send message every 10 seconds
async def send_test_message(ctx: Context):
    print("📤 Sending test message...")
    
    # Summary agent address (from when you ran summary_agent.py)
    summary_agent_address = "agent1qtu6wt5jphhmdjau0hdhc002ashzjnueqe89gvvuln8mawm3m0xrwmn9a76"
    
    # Create message
    message = TextMessage(text="Sohum Gautam is a software engineer at UPenn")
    
    # Send message
    await ctx.send(summary_agent_address, message)
    
    print("✅ Message sent! Check the summary agent terminal for processing...")
    
    # Stop after sending one message
    ctx.stop_agent()

if __name__ == "__main__":
    print("🚀 Starting message client...")
    print("📤 Will send a test message to the summary agent...")
    print("💡 Make sure your summary agent is running in another terminal!")
    print("🛑 Press Ctrl+C to stop")
    
    try:
        client.run()
    except KeyboardInterrupt:
        print("\n👋 Client stopped")
