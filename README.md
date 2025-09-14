# Spark: *See the extraordinary in everyone instantly* 

Spark is an AI-powered tool built on the MentraOS glasses that lets people instantly discover the extraordinary individuals around them. By surfacing the factors and accomplishments that make a person remarkable, beyond just their job title or LinkedIn headline, Spark breaks the cold-start barrier in human connection. It provides baseline knowledge to help cultivate introductions, conversations, and relationships. Through this, Spark accelerates authentic connection and collaboration in real-world environments like conferences, hackathons, research labs, and entrepreneurial communities.

## Inspiration and Impact 
In today’s hyperconnected world, we constantly walk past extraordinary people without ever realizing it–founders, scientists, activists, creators–simply because their stories can be invisible in real life. We were inspired by this invisible “context gap” and wanted to make meaningful connections effortless and serendipitous, especially in environments like hackathons or conferences, where collaboration potential is high but often missed.

But Spark doesn’t just surface context, it remembers people you’ve met, logs interactions, and builds an evolving map of your personal network. It helps you reconnect later and pick up past conversations. This transforms fleeting moments, which could have been foregone conversations, into lasting connections. 

## Main Features 
1. Real-time photo capture using MentraOS + face recognition
2. AI-driven extraordinary profile data analysis & extraction (CrewAI, Claude, and Exa)
3. Voice-to-text, Summarization, + Next Steps
4. Multi-source scraping
5. Glasses-oriented UI (EJS + MentraOS SDK + debug tools)


## Stack 

| Level         | Description                                                                 |
|---------------|----------------------------------------------------------------------|
| Hardware            | [MentraOS Smart Glasses](https://mentra.glass/) - [GitHub](https://github.com/Mentra-Community/MentraOS)                          |
| Application Layer (Dev Server)     |   TypeScript/Node.js backend with Express |
| AI Agent Layer      |  AI Agent interface for face recognition and deep research - Claude API, Exa Research API, CrewAI API |
| Data Layer       |  Supabase PostgreSQL + local file storage |
| Integration Layer | Multiple external APIs and services | 

## Code Structure 

```
src/
├── agents/extraordinary/     # AI analysis system
├── api/                     # API endpoints
├── face_recognition/        # Face recognition service
├── gmail/                   # Email integration
├── voice/                   # Voice processing
└── views/                   # EJS templates
```

#### Usage 

1. Clone the repository:
`https://github.com/seanguno/hackmit-camera-project.git`

4. Install dependencies
  #### AI/ML Stack
  ```
  crewai                    #Multi-agent framework <br>
  langchain-anthropic       #Claude integration <br> 
  httpx                     #Async HTTP client <br> 
  exa-py                    #Exa API client <br>
  python-dotenv             #Environment management <br>
  ```
  
  #### Face Recognition
  ```
  requests>=2.28.0          #HTTP requests <br>
  opencv-python>=4.8.0     #Computer vision <br>
  fastapi>=0.104.0          #API framework <br>
  uvicorn>=0.24.0           #ASGI server <br>
  ```
  
  #### Voice Processing
  ```
  pyaudio==0.2.11           #Audio capture <br>
  numpy==1.24.3             #Audio processing <br>
  ```



## Team 
Sohum Gautam, UPenn M&T '29 <br>
Sean Guno, UIUC CS + Chemistry & Bioengineering '26 <br>
Pari Latawa, MIT CS + Bio '26 <br>
Mudit Marwaha, CS '26 

## Acknowledgements
Thank you to the MIT 2025 HackMIT organizing team. Thank you to all sponsors for guidance and API credits, especially Mentra OS, Extraordinary, Anthropic, and Y Combinator.

### Next Steps 
