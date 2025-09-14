import os
import asyncio
import json
import logging
from datetime import datetime
from crewai import Crew
from dotenv import load_dotenv

# Import local modules
from .crew_agents import CrewAgents
from .crew_tasks import CrewTasks
from .simple_search import SimplePersonSearch
from .exa_search import ExaSearch

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

class ExtraordinaryAnalyzer:
    def __init__(self):
        self.agents = CrewAgents()
        self.tasks = CrewTasks()
        self.logger = setup_logging()

    async def analyze_person(self, name: str):
        """Main function to search and analyze a person"""
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
        
        # Format data for analysis
        scraped_data = self._format_search_data(name, search_result)
        
        print(f"📊 Search completed. Now analyzing for extraordinary qualities...")
        
        # Run analysis
        analysis_result = self._run_analysis(scraped_data)
        # analysis_result = scraped_data
        
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
        """Save profile as formatted JSON"""
        try:
            # Extract content from CrewAI output
            if hasattr(profile_data, 'raw'):
                raw_content = profile_data.raw
            elif hasattr(profile_data, 'content'):
                raw_content = profile_data.content
            else:
                raw_content = str(profile_data)
            
            # Parse JSON
            if isinstance(raw_content, str):
                try:
                    actual_data = json.loads(raw_content)
                except json.JSONDecodeError as e:
                    print(f"🔍 Debug: JSON decode error: {e}")
                    print(f"🔍 Debug: Raw content preview: {raw_content[:500]}...")
                    import re
                    # Try to extract JSON from the text
                    json_match = re.search(r'\{.*\}', raw_content, re.DOTALL)
                    if json_match:
                        try:
                            actual_data = json.loads(json_match.group())
                            print(f"🔍 Debug: Successfully extracted JSON with regex")
                        except json.JSONDecodeError as e2:
                            print(f"🔍 Debug: Regex extraction also failed: {e2}")
                            # Create a fallback structure
                            actual_data = {
                                "Name": "Unknown",
                                "Error": f"JSON parsing failed: {e}",
                                "RawContent": raw_content[:1000] + "..." if len(raw_content) > 1000 else raw_content
                            }
                    else:
                        actual_data = {
                            "Name": "Unknown", 
                            "Error": f"No JSON found in content: {e}",
                            "RawContent": raw_content[:1000] + "..." if len(raw_content) > 1000 else raw_content
                        }
            else:
                actual_data = raw_content
            
            # Add Exa results to the profile data
            if exa_results and isinstance(actual_data, dict):
                actual_data['exa_search_results'] = exa_results
            
            # Save as formatted JSON
            if isinstance(actual_data, dict) and 'Name' in actual_data:
                name = actual_data['Name'].replace(' ', '_').lower()
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                # Get the directory where this script is located
                script_dir = os.path.dirname(os.path.abspath(__file__))
                filename = os.path.join(script_dir, "profiles", f"{name}_analysis_{timestamp}.json")
                
                with open(filename, 'w') as f:
                    json.dump(actual_data, f, indent=2)
                
                print(f"📁 Profile saved to: {filename}")
                
                # Log key details
                self.logger.info(f"=== EXTRAORDINARY PROFILE ===")
                self.logger.info(f"Name: {actual_data.get('Name', 'Unknown')}")
                self.logger.info(f"Title: {actual_data.get('title_role', 'N/A')}")
                self.logger.info(f"Claim to Fame: {actual_data.get('claim_to_fame', 'N/A')}")
                
        except Exception as e:
            self.logger.error(f"Error saving profile: {e}")
            print(f"❌ Error saving profile: {e}")

    def _display_results(self, search_result: dict, analysis_result):
        """Display search and analysis results"""
        print(f"\n--- Search Results ---")
        print(f"GitHub: {search_result.get('github', {})}")
        print(f"Web Info: {search_result.get('web_info', {})}")
        
        print(f"\n--- Extraordinary Analysis ---")
        # Extract and display analysis result
        if hasattr(analysis_result, 'raw'):
            try:
                analysis_data = json.loads(analysis_result.raw)
                print(json.dumps(analysis_data, indent=2))
            except:
                print(analysis_result.raw)
        else:
            print(analysis_result)

def main():
    load_dotenv()
    
    print("--- Starting Extraordinary Analysis System ---")
    analyzer = ExtraordinaryAnalyzer()
    result = analyzer.analyze_person("elon musk")

if __name__ == "__main__":
    main()