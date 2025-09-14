# Enhanced Extraordinary Analysis System

A powerful system that combines Serper API and Exa API to create comprehensive profiles of extraordinary individuals.

## Features

- **Dual Search Strategy**: Serper for discovery + Exa for deep content analysis
- **Comprehensive Data Collection**: GitHub, LinkedIn, news, academic papers, awards
- **AI-Powered Analysis**: CrewAI agents create detailed extraordinary profiles
- **No Scoring**: Focus on celebration and highlighting achievements
- **Structured Output**: Clean JSON profiles with evidence and sources

## Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up environment variables** in `.env`:
   ```bash
   SERPER_API_KEY=your_serper_key
   EXA_API_KEY=5b29f608-4bf9-4e47-a91a-aa487c62fec8
   ANTHROPIC_API_KEY=your_anthropic_key
   ```

## How It Works

### Search Pipeline
1. **Serper API**: Initial discovery of LinkedIn profiles and basic web search
2. **Exa API**: Deep dive into specific domains:
   - Academic papers and research
   - News articles and media coverage
   - Awards and recognition
   - Company-specific content

### Analysis Pipeline
1. **Data Formatting**: Combines all search results into structured format
2. **AI Analysis**: CrewAI agent analyzes using 7 criteria:
   - Impact
   - Prestige/Validation
   - Pioneering Work
   - Recognition by Institutions
   - Exceptional Young Talent
   - Technical Frontier
   - Builder/Startup Cred

3. **Profile Generation**: Creates comprehensive JSON profile with evidence

## Usage

### Basic Usage
```python
from main import ExtraordinaryAnalyzer

analyzer = ExtraordinaryAnalyzer()
result = analyzer.analyze_person("Sohum Gautam")
```

### Advanced Usage
```python
# Run multiple analyses
analyzer = ExtraordinaryAnalyzer()

people = ["Sohum Gautam", "Elon Musk", "Yann LeCun"]
for person in people:
    result = analyzer.analyze_person(person)
    print(f"Analysis complete for {person}")
```

## Output Structure

The system generates JSON profiles with:
- Basic info (name, title, company)
- Recognition and achievements
- Criteria hits for each category
- Sources with evidence
- Flags for weak evidence or conflicts

## API Keys Required

- **Serper API**: For LinkedIn and web search discovery
- **Exa API**: For high-quality content and academic sources
- **Anthropic API**: For AI analysis (Claude)

## File Structure

```
├── main.py                 # Main orchestrator
├── simple_search.py        # Serper API integration
├── exa_search.py          # Exa API integration
├── crew_agents.py         # CrewAI agents
├── crew_tasks.py          # CrewAI tasks
├── prompts/
│   └── extraordinary.txt  # Analysis prompt
├── profiles/              # Generated profiles
└── logs/                  # Search logs
```

## Benefits of Exa Integration

- **Higher Quality Content**: Academic papers, news articles, authoritative sources
- **Better Context**: More comprehensive understanding of achievements
- **Domain-Specific Search**: Targeted searches for research, awards, news
- **Enhanced Profiles**: Richer, more accurate extraordinary profiles
