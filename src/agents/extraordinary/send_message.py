#!/usr/bin/env python3
"""
Simple script to send a message to the summary agent
"""
from uagents import Agent, Context
from models import TextMessage

# Create a simple client agent
client = Agent(name="message_sender", seed="sender_seed", port=8001)

@client.on_message(model=TextMessage)
async def handle_response(ctx: Context, sender: str, msg: TextMessage):
    print(f"🎉 Received response: {msg.text}")

def send_message(message_text: str):
    """Send a message to the summary agent"""
    print(f"📤 Sending message: '{message_text}'")
    
    # Summary agent address (from when you ran summary_agent.py)
    summary_agent_address = "agent1qtu6wt5jphhmdjau0hdhc002ashzjnueqe89gvvuln8mawm3m0xrwmn9a76"
    
    # Create message
    message = TextMessage(text=message_text)
    
    # Send message using the correct uAgents API
    import asyncio
    
    async def send_async():
        # Start the client
        await client.start()
        
        # Send message
        await client.send(summary_agent_address, message)
        
        print("✅ Message sent! Check the summary agent terminal for processing...")
        print("💡 The summary agent will process it and send back a response")
        
        # Keep running to receive responses
        await asyncio.sleep(5)  # Wait 5 seconds for response
    
    # Run the async function
    asyncio.run(send_async())

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Get message from command line argument
        message = " ".join(sys.argv[1:])
        send_message(message)
    else:
        # Default test message
        send_message("Sohum Gautam is a software engineer at UPenn")
    
    # Keep the client running to receive responses
    print("\n🔄 Client running... Press Ctrl+C to stop")
    try:
        client.run()
    except KeyboardInterrupt:
        print("\n👋 Client stopped")
