from uagents import Model

# Define a simple message model that both agents can use
class TextMessage(Model):
    text: str
