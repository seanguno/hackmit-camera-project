import os
from dotenv import load_dotenv
from crewai import Agent, Task, Crew, Process, LLM

from crew_agents import CrewAgents

# Load environment variables from a .env file
load_dotenv()

def load_extraordinary_prompt():
    """Load the extraordinary analysis prompt from file"""
    try:
        with open('prompts/extraordinary.txt', 'r') as f:
            return f.read()
    except FileNotFoundError:
        return "You are an elite deep-research agent focused on identifying extraordinary individuals."

class CrewTasks:
    def __init__(self):
        self.extraordinary_prompt = load_extraordinary_prompt()

    def task_analyze_extraordinary(self, agent):
        """Task for celebrating and highlighting extraordinary individuals"""
        return Task(
            description=f'''You are tasked with creating a compelling profile that highlights why this person is extraordinary and celebrates their achievements.

{self.extraordinary_prompt}

IMPORTANT: You must analyze the person described in the SCRAPED_DETAILS input data. Do not use examples or make up information about other people.

SCRAPED_DETAILS TO ANALYZE:
{{scraped_data}}

Your specific task:
1. Read and analyze ALL the SCRAPED_DETAILS provided above - pay special attention to:
   - GitHub bio, repositories, and activity
   - LinkedIn profiles and all social media mentions
   - Web search results and any additional context
   - All professional roles, achievements, and affiliations

2. Apply the 7 criteria for "extraordinary" to highlight their strengths:
   - Impact (audience size, usage, measurable impact)
   - Prestige/Validation (elite orgs, major media recognition)
   - Pioneering Work (inventions, new platforms, scientific breakthroughs)
   - Recognition by Experts/Institutions (awards, fellowships, grants)
   - Exceptional Talent Young (early achievement, prodigy status)
   - Technical Excellence/Frontier (cutting-edge research, patents)
   - Builder/Startup Cred (founding teams, venture backing)

3. Highlight achievements for each criterion based on evidence found in the SCRAPED_DETAILS
4. Celebrate their potential and what makes them extraordinary
5. Identify specific evidence for each criterion from the SCRAPED_DETAILS
6. Celebrate their achievements and unique qualities

CRITICAL: Only analyze the person described in the SCRAPED_DETAILS input. Capture ALL available information from GitHub, LinkedIn, web search results, and any other sources provided.''',
            agent=agent,
            expected_output='A detailed extraordinary analysis with evidence-based reasoning in JSON format.'
        )