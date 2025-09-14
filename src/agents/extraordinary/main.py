import os
import asyncio
import json
import logging
from datetime import datetime
from crewai import Crew
from dotenv import load_dotenv

# Import local modules
try:
    from .crew_agents import CrewAgents
    from .crew_tasks import CrewTasks
    from .simple_search import SimplePersonSearch
    from .exa_search import ExaSearch
    from .linkedin_scraper import scrape_linkedin_profiles
except ImportError:
    # Fallback for when running as main script
    from crew_agents import CrewAgents
    from crew_tasks import CrewTasks
    from simple_search import SimplePersonSearch
    from exa_search import ExaSearch
    from linkedin_scraper import scrape_linkedin_profiles

def setup_logging():
    """Setup logging for profiles"""
    os.makedirs("profiles", exist_ok=True)
    
    logger = logging.getLogger('extraordinary_profiles')
    logger.setLevel(logging.INFO)
    
    handler = logging.FileHandler(f'profiles/extraordinary_analysis_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
    handler.setLevel(logging.INFO)
    
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    return logger

def generate_standardized_profile(research_data: dict, name: str) -> dict:
    """
    Generate a standardized profile using f-strings and research variables
    This ensures consistent output format regardless of AI prompt variations
    """
    
    # Extract variables from research data
    github_info = research_data.get('github_info', {})
    exa_results = research_data.get('exa_results', [])
    web_info = research_data.get('web_info', {})
    linkedin_profiles = research_data.get('linkedin_profiles', [])
    
    # Basic info extraction
    full_name = name
    bio = github_info.get('bio', '')
    location = github_info.get('location', '')
    company = github_info.get('company', '')
    website = github_info.get('blog', '') or github_info.get('html_url', '')
    
    # Extract photo URL
    photo_url = github_info.get('avatar_url', '')
    
    # Extract country from location
    country = location.split(',')[-1].strip() if location else 'Unknown'
    
    # Generate title/role
    title_role = f"{github_info.get('name', name)}"
    if company:
        title_role += f" at {company}"
    elif bio:
        # Extract role from bio
        bio_lower = bio.lower()
        if 'engineer' in bio_lower:
            title_role += " - Engineer"
        elif 'developer' in bio_lower:
            title_role += " - Developer"
        elif 'researcher' in bio_lower:
            title_role += " - Researcher"
        elif 'founder' in bio_lower:
            title_role += " - Founder"
        elif 'student' in bio_lower:
            title_role += " - Student"
    
    # Generate claim to fame from research
    claim_to_fame = generate_claim_to_fame(github_info, exa_results, name)
    
    # Extract recognition and achievements
    recognition = extract_recognition(exa_results, github_info, linkedin_profiles)
    built_or_achieved = extract_achievements(exa_results, github_info, web_info, linkedin_profiles)
    
    # Extract quote if available
    quote = extract_quote(exa_results, github_info)
    
    # Generate criteria hits
    criteria_hits = generate_criteria_hits(github_info, exa_results, name, built_or_achieved, recognition)
    
    # Generate sources
    sources = generate_sources(exa_results, github_info)
    
    # Create standardized profile
    profile = {
        "name": full_name,
        "photo": photo_url,
        "country": country,
        "title_role": title_role,
        "company_affiliation": company or "Independent",
        "claim_to_fame": claim_to_fame,
        "recognition": recognition,
        "built_or_achieved": built_or_achieved,
        "quote": quote,
        "criteria_hits": criteria_hits,
        "sources": sources
    }
    
    return profile

def generate_claim_to_fame(github_info: dict, exa_results: list, name: str) -> str:
    """Generate compelling claim to fame based on research data"""
    
    # Check for GitHub stars/forks
    public_repos = github_info.get('public_repos', 0)
    followers = github_info.get('followers', 0)
    
    # Look for notable projects in Exa results
    notable_projects = []
    if exa_results and isinstance(exa_results, list):
        for result in exa_results:
            title = result.get('title', '').lower()
            text = result.get('text', '').lower()
            
            if any(keyword in title or keyword in text for keyword in ['founder', 'ceo', 'cto', 'created', 'built', 'developed']):
                notable_projects.append(result.get('title', 'Notable project'))
    
    # Generate claim based on available data
    if public_repos > 50:
        return f"Open source contributor with {public_repos} repositories and {followers} GitHub followers"
    elif followers > 100:
        return f"Developer with {followers} GitHub followers and active in the tech community"
    elif notable_projects:
        return f"Creator of {notable_projects[0]} and other innovative projects"
    elif github_info.get('bio'):
        return f"{github_info.get('bio')}"
    else:
        return f"Emerging talent in technology and software development"

def extract_recognition(exa_results: list, github_info: dict, web_info: dict = None, linkedin_profiles: list = None) -> list:
    """Extract recognition and awards from research data using AI analysis"""
    import anthropic
    import json
    import re
    
    # Prepare all available data for AI analysis
    data_text = f"""
    GitHub Data: {github_info}
    
    Web Search Results: {web_info.get('search_results', {}) if web_info else {}}
    
    Exa Search Results: {exa_results}
    
    LinkedIn Profiles: {linkedin_profiles}
    """
    
    try:
        client = anthropic.Anthropic()
        
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            messages=[{
                "role": "user",
                "content": f"""
                Analyze the following research data about a person and extract their recognition, awards, honors, and institutional affiliations. 
                Return ONLY a JSON array of recognition strings, nothing else.
                
                Focus on:
                - University/college affiliations
                - Scholarships, fellowships, awards
                - Company recognitions
                - Professional certifications
                - Institutional honors
                - Notable achievements
                
                Be specific and descriptive. For example:
                - "Massachusetts Institute of Technology" not just "MIT"
                - "Coca-Cola Scholar" not just "Scholar"
                - "Apple Inc." not just "Apple"
                
                Data: {data_text}
                
                Return format: ["recognition1", "recognition2", "recognition3", ...]
                """
            }]
        )
        
        # Parse AI response
        ai_response = response.content[0].text.strip()
        
        # Try to extract JSON array from response
        json_match = re.search(r'\[.*?\]', ai_response, re.DOTALL)
        if json_match:
            recognition = json.loads(json_match.group())
        else:
            # Fallback: split by lines and clean up
            recognition = [line.strip().strip('"\'') for line in ai_response.split('\n') if line.strip()]
        
        # Filter out empty strings and limit to 8
        recognition = [r for r in recognition if r and len(r) > 3][:8]
        
        return recognition
        
    except Exception as e:
        print(f"⚠️ AI recognition extraction failed: {e}")
        # Fallback to basic GitHub data
        recognition = []
        followers = github_info.get('followers', 0)
        if followers > 0:
            recognition.append(f"GitHub: {followers} followers")
        
        return recognition

def extract_achievements(exa_results: list, github_info: dict, web_info: dict = None, linkedin_profiles: list = None) -> list:
    """Extract built/achieved items from research data using AI analysis"""
    import anthropic
    import json
    import re
    
    # Prepare all available data for AI analysis
    data_text = f"""
    GitHub Data: {github_info}
    
    Web Search Results: {web_info.get('search_results', {}) if web_info else {}}
    
    Exa Search Results: {exa_results}
    
    LinkedIn Profiles: {linkedin_profiles}
    """
    
    try:
        client = anthropic.Anthropic()
        
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": f"""
                Analyze the following research data about a person and extract their key achievements, accomplishments, and notable work. 
                Return ONLY a JSON array of achievement strings, nothing else.
                
                Focus on:
                - Professional roles and positions
                - Educational achievements
                - Awards, scholarships, recognitions
                - Projects, startups, companies founded
                - Research work, publications
                - Notable affiliations
                - Technical accomplishments
                
                Be specific and descriptive. For example:
                - "CEO at [Company Name]" not just "CEO experience"
                - "Computer Science @ MIT" not just "MIT student"
                - "Coca-Cola Scholar" not just "Scholar"
                
                Data: {data_text}
                
                Return format: ["achievement1", "achievement2", "achievement3", ...]
                """
            }]
        )
        
        # Parse AI response
        ai_response = response.content[0].text.strip()
        
        # Try to extract JSON array from response
        json_match = re.search(r'\[.*?\]', ai_response, re.DOTALL)
        if json_match:
            achievements = json.loads(json_match.group())
        else:
            # Fallback: split by lines and clean up
            achievements = [line.strip().strip('"\'') for line in ai_response.split('\n') if line.strip()]
        
        # Filter out empty strings and limit to 10
        achievements = [a for a in achievements if a and len(a) > 3][:10]
        
        return achievements
        
    except Exception as e:
        print(f"⚠️ AI achievement extraction failed: {e}")
        # Fallback to basic GitHub data
        achievements = []
        public_repos = github_info.get('public_repos', 0)
        followers = github_info.get('followers', 0)
        
        if public_repos > 0:
            achievements.append(f"{public_repos} GitHub repositories")
        if followers > 0:
            achievements.append(f"{followers} GitHub followers")
        
        return achievements

def extract_quote(exa_results: list, github_info: dict) -> str:
    """Extract a quote if available"""
    # Look for quotes in Exa results
    if exa_results and isinstance(exa_results, list):
        for result in exa_results:
            text = result.get('text', '')
            if '"' in text:
                # Extract text between quotes
                start = text.find('"')
                end = text.find('"', start + 1)
                if end > start:
                    return text[start+1:end]
    
    return ""

def generate_criteria_hits(github_info: dict, exa_results: list, name: str, achievements: list = None, recognition: list = None) -> dict:
    """Generate criteria hits based on research data"""
    
    criteria_hits = {
        "impact": [],
        "prestige_validation": [],
        "pioneering_work": [],
        "recognition_by_institutions": [],
        "exceptional_young": [],
        "technical_frontier": [],
        "builder_startup_cred": []
    }
    
    # Use achievements and recognition if provided
    all_achievements = achievements or []
    all_recognition = recognition or []
    
    # Impact criteria - look for high-impact work
    for achievement in all_achievements:
        achievement_lower = achievement.lower()
        if any(keyword in achievement_lower for keyword in ['founder', 'ceo', 'startup', 'company', 'nonprofit', 'organization']):
            criteria_hits["impact"].append(achievement)
        elif any(keyword in achievement_lower for keyword in ['research', 'published', 'patent', 'innovation']):
            criteria_hits["pioneering_work"].append(achievement)
        elif any(keyword in achievement_lower for keyword in ['ai', 'machine learning', 'deep learning', 'neural', 'algorithm', 'software', 'engineering']):
            criteria_hits["technical_frontier"].append(achievement)
    
    # Prestige validation - look for top institutions and companies
    for achievement in all_achievements:
        achievement_lower = achievement.lower()
        if any(keyword in achievement_lower for keyword in ['mit', 'stanford', 'harvard', 'berkeley', 'carnegie mellon', 'caltech']):
            criteria_hits["prestige_validation"].append(achievement)
        elif any(keyword in achievement_lower for keyword in ['google', 'apple', 'microsoft', 'meta', 'amazon', 'tesla', 'openai', 'anthropic']):
            criteria_hits["prestige_validation"].append(achievement)
    
    # Recognition by institutions
    for rec in all_recognition:
        rec_lower = rec.lower()
        if any(keyword in rec_lower for keyword in ['scholar', 'award', 'honor', 'fellowship', 'grant', 'prize', 'recognition']):
            criteria_hits["recognition_by_institutions"].append(rec)
    
    # Exceptional young - look for age-related achievements
    for achievement in all_achievements:
        achievement_lower = achievement.lower()
        if any(keyword in achievement_lower for keyword in ['youngest', 'teen', 'student', 'undergraduate', 'sophomore', 'freshman']):
            criteria_hits["exceptional_young"].append(achievement)
    
    # Builder/startup cred - look for entrepreneurial activities
    for achievement in all_achievements:
        achievement_lower = achievement.lower()
        if any(keyword in achievement_lower for keyword in ['founder', 'startup', 'entrepreneur', 'built', 'created', 'launched']):
            criteria_hits["builder_startup_cred"].append(achievement)
    
    # Fallback to basic GitHub data if no rich data
    if not all_achievements and not all_recognition:
        # Impact criteria
        followers = github_info.get('followers', 0)
        if followers > 100:
            criteria_hits["impact"].append(f"GitHub: {followers} followers")
        
        # Technical frontier
        bio = github_info.get('bio', '') or ''
        bio_lower = bio.lower()
        if any(keyword in bio_lower for keyword in ['ai', 'machine learning', 'blockchain', 'crypto', 'biotech']):
            criteria_hits["technical_frontier"].append("Working in cutting-edge technology")
        
        # Builder/startup cred
        if any(keyword in bio_lower for keyword in ['founder', 'ceo', 'cto', 'startup']):
            criteria_hits["builder_startup_cred"].append("Entrepreneurial experience")
    
    # Check Exa results for additional criteria
    if exa_results and isinstance(exa_results, list):
        for result in exa_results:
            title = result.get('title', '').lower()
            text = result.get('text', '').lower()
            
            if any(keyword in title or keyword in text for keyword in ['stanford', 'mit', 'harvard', 'openai', 'google', 'microsoft']):
                criteria_hits["prestige_validation"].append(result.get('title', 'Elite organization'))
            
            if any(keyword in title or keyword in text for keyword in ['award', 'fellowship', 'grant', 'scholarship']):
                criteria_hits["recognition_by_institutions"].append(result.get('title', 'Institutional recognition'))
    
    return criteria_hits

def generate_sources(exa_results: list, github_info: dict) -> list:
    """Generate sources list from research data"""
    sources = []
    
    # Add GitHub as source
    if github_info.get('html_url'):
        sources.append({
            "fact": "GitHub profile information",
            "evidence": f"Bio: {github_info.get('bio', 'N/A')}, Location: {github_info.get('location', 'N/A')}",
            "source_hint": github_info.get('html_url', 'GitHub')
        })
    
    # Add Exa results as sources
    if exa_results and isinstance(exa_results, list):
        for i, result in enumerate(exa_results[:5]):  # Limit to 5 sources
            sources.append({
                "fact": f"Research finding {i+1}",
                "evidence": result.get('text', '')[:200] + "..." if len(result.get('text', '')) > 200 else result.get('text', ''),
                "source_hint": result.get('url', 'Unknown source')
            })
    
    return sources

class ExtraordinaryAnalyzer:
    def __init__(self):
        self.agents = CrewAgents()
        self.tasks = CrewTasks()
        self.logger = setup_logging()

    async def analyze_person(self, name: str):
        """Main function to search and analyze a person using standardized profile generation"""
        print(f"🔍 Searching for: {name}")
        
        # Search for person
        searcher = SimplePersonSearch()
        search_result = await searcher.search_person(name)
        try:
            await searcher.close()
        except:
            pass  # Ignore closing errors
        
        # Enhance with Exa API
        exa_searcher = ExaSearch()
        search_result = await exa_searcher.enhance_search(name, search_result)
        try:
            await exa_searcher.close()
        except:
            pass  # Ignore closing errors
        
        print(f"📊 Search completed. Now scraping LinkedIn profiles...")
        
        # Scrape LinkedIn profiles for additional data
        linkedin_urls = search_result.get('web_info', {}).get('linkedin_urls', [])
        linkedin_profiles = []
        
        if linkedin_urls:
            try:
                linkedin_profiles = await scrape_linkedin_profiles(linkedin_urls[:2])  # Limit to 2 profiles
                print(f"✅ Scraped {len(linkedin_profiles)} LinkedIn profiles")
            except Exception as e:
                print(f"⚠️ LinkedIn scraping failed: {e}")
                linkedin_profiles = []
        
        print(f"📊 Now generating standardized profile...")
        
        # Generate standardized profile using f-strings and research variables
        research_data = {
            'github_info': search_result.get('github', {}),
            'exa_results': search_result.get('exa_results', []),
            'web_info': search_result.get('web_info', {}),
            'linkedin_profiles': linkedin_profiles
        }
        
        analysis_result = generate_standardized_profile(research_data, name)
        
        # Save and display results
        self._save_profile(analysis_result, search_result.get('exa_results', {}))
        self._display_results(search_result, analysis_result)
        
        return {
            'search_result': search_result,
            'analysis_result': analysis_result
        }

    def _format_search_data(self, name: str, search_result: dict) -> str:
        """Format search data for analysis"""
        github_info = search_result.get('github', {})
        web_info = search_result.get('web_info', {})
        exa_results = search_result.get('exa_results', {})
        
        # Extract LinkedIn content
        linkedin_snippets = []
        for query, results in web_info.get('search_results', {}).items():
            if 'organic' in results:
                for item in results['organic']:
                    if 'linkedin.com' in item.get('link', ''):
                        linkedin_snippets.append(f"LinkedIn: {item.get('title', '')} - {item.get('snippet', '')}")
        
        # Format Exa results
        exa_content = self._format_exa_results(exa_results)
        
        return f"""
        SCRAPED_DETAILS:
        Name: {name}
        
        GitHub Information:
        - Username: {github_info.get('username', 'N/A')}
        - Name: {github_info.get('name', 'N/A')}
        - Bio: {github_info.get('bio', 'N/A')}
        - Location: {github_info.get('location', 'N/A')}
        - Company: {github_info.get('company', 'N/A')}
        - Blog: {github_info.get('blog', 'N/A')}
        - URL: {github_info.get('url', 'N/A')}
        - Repositories: {github_info.get('repos', 'N/A')}
        - Followers: {github_info.get('followers', 'N/A')}
        
        LinkedIn Profiles Found:
        {chr(10).join([f"- {url}" for url in web_info.get('linkedin_urls', [])])}
        
        LinkedIn Content & Posts:
        {chr(10).join(linkedin_snippets[:10])}
        
        Web Search Results:
        {json.dumps(web_info.get('search_results', {}), indent=2)[:2000]}
        
        Additional Web Information:
        - Twitter URLs: {web_info.get('twitter_urls', [])}
        - Other Profiles: {web_info.get('other_profiles', {})}
        
        {exa_content}
        """
    
    def _format_exa_results(self, exa_results: dict) -> str:
        """Format Exa search results for analysis"""
        if not exa_results:
            return ""
        
        formatted_content = "\nEnhanced Search Results (Exa API):\n"
        
        for query_type, results in exa_results.items():
            if 'results' in results and results['results']:
                formatted_content += f"\n{query_type.upper()} Results:\n"
                for i, result in enumerate(results['results'][:5], 1):  # Limit to top 5
                    title = result.get('title', 'No title')
                    url = result.get('url', 'No URL')
                    text = result.get('text', 'No content')[:500]  # Limit text length
                    formatted_content += f"{i}. {title}\n   URL: {url}\n   Content: {text}...\n\n"
        
        return formatted_content

    def _run_analysis(self, scraped_data: str):
        """Run the extraordinary analysis"""
        analyst = self.agents.extraordinary_analyst_agent()
        task = self.tasks.task_analyze_extraordinary(analyst)
        
        crew = Crew(
            agents=[analyst],
            tasks=[task],
            verbose=True,
        )
        
        return crew.kickoff(inputs={'scraped_data': scraped_data})

    def _save_profile(self, profile_data, exa_results=None):
        """Save the standardized analysis result to a JSON file"""
        try:
            # The profile_data is now a standardized dictionary
            if isinstance(profile_data, dict):
                # Add Exa results to the profile data
                if exa_results:
                    profile_data['exa_search_results'] = exa_results
                
                # Save as formatted JSON
                name = profile_data.get('name', 'unknown').replace(' ', '_').lower()
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                # Get the directory where this script is located
                script_dir = os.path.dirname(os.path.abspath(__file__))
                filename = os.path.join(script_dir, "profiles", f"{name}_analysis_{timestamp}.json")
                
                with open(filename, 'w') as f:
                    json.dump(profile_data, f, indent=2)
                
                print(f"📁 Profile saved to: {filename}")
                
                # Log key details
                self.logger.info(f"=== STANDARDIZED EXTRAORDINARY PROFILE ===")
                self.logger.info(f"Name: {profile_data.get('name', 'Unknown')}")
                self.logger.info(f"Title: {profile_data.get('title_role', 'N/A')}")
                self.logger.info(f"Claim to Fame: {profile_data.get('claim_to_fame', 'N/A')}")
                self.logger.info(f"Country: {profile_data.get('country', 'N/A')}")
                self.logger.info(f"Recognition: {len(profile_data.get('recognition', []))} items")
                self.logger.info(f"Achievements: {len(profile_data.get('built_or_achieved', []))} items")
                
            else:
                self.logger.error(f"Invalid profile data format: {type(profile_data)}")
                print(f"❌ Invalid profile data format: {type(profile_data)}")
                
        except Exception as e:
            self.logger.error(f"Error saving profile: {e}")
            print(f"❌ Error saving profile: {e}")

    def _display_results(self, search_result: dict, analysis_result):
        """Display search and analysis results"""
        print(f"\n--- Search Results ---")
        print(f"GitHub: {search_result.get('github', {})}")
        print(f"Web Info: {search_result.get('web_info', {})}")
        
        print(f"\n--- Standardized Extraordinary Profile ---")
        # Display the standardized analysis result
        if isinstance(analysis_result, dict):
            print(f"Name: {analysis_result.get('name', 'Unknown')}")
            print(f"Title: {analysis_result.get('title_role', 'N/A')}")
            print(f"Country: {analysis_result.get('country', 'N/A')}")
            print(f"Company: {analysis_result.get('company_affiliation', 'N/A')}")
            print(f"Claim to Fame: {analysis_result.get('claim_to_fame', 'N/A')}")
            print(f"Recognition: {analysis_result.get('recognition', [])}")
            print(f"Achievements: {analysis_result.get('built_or_achieved', [])}")
            print(f"Quote: {analysis_result.get('quote', 'N/A')}")
            print(f"Criteria Hits: {json.dumps(analysis_result.get('criteria_hits', {}), indent=2)}")
        else:
            print(f"Analysis result: {analysis_result}")

async def main():
    load_dotenv()
    
    print("--- Starting Extraordinary Analysis System ---")
    analyzer = ExtraordinaryAnalyzer()
    result = await analyzer.analyze_person("Sohum Gautam")

if __name__ == "__main__":
    asyncio.run(main())