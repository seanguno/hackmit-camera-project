import httpx
import asyncio
import json
import os
import http.client
import logging
from datetime import datetime
from dotenv import load_dotenv
from typing import Dict

load_dotenv()

def setup_logging():
    """Setup logging configuration"""
    os.makedirs("logs", exist_ok=True)
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(f'logs/search_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)

class SimplePersonSearch:
    """Simple person search that gets basic info from GitHub and web"""
    
    def __init__(self):
        self.session = httpx.AsyncClient(timeout=30)
        self.serper_api_key = os.getenv("SERPER_API_KEY")
        self.logger = setup_logging()
    
    async def search_person(self, name: str) -> Dict:
        """Search for person information"""
        self.logger.info(f"🔍 Searching for: {name}")
        
        result = {
            "name": name,
            "github": {},
            "web_info": {}
        }
        
        # Search GitHub
        github_info = await self._search_github(name)
        if github_info:
            result["github"] = github_info
            self.logger.info(f"✅ Found GitHub profile: {github_info.get('username', 'Unknown')}")
        
        # Search web
        web_info = await self._search_web(name)
        if web_info:
            result["web_info"] = web_info
            self.logger.info(f"✅ Found {len(web_info.get('linkedin_urls', []))} LinkedIn profiles, {len(web_info.get('twitter_urls', []))} Twitter profiles")
        
        self.logger.info(f"📊 Complete search result for {name}:")
        self.logger.info(json.dumps(result, indent=2))
        
        return result
    
    async def _search_github(self, name: str) -> Dict:
        """Search GitHub for user"""
        self.logger.info("📱 Checking GitHub...")
        
        try:
            # Search for user
            search_url = f"https://api.github.com/search/users?q={name}&per_page=1"
            response = await self.session.get(search_url)
            response.raise_for_status()
            
            data = response.json()
            if not data.get('items'):
                return {}
            
            user = data['items'][0]
            username = user['login']
            
            # Get detailed user info
            user_url = f"https://api.github.com/users/{username}"
            user_response = await self.session.get(user_url)
            user_response.raise_for_status()
            
            user_data = user_response.json()
            
            return {
                "username": user_data.get('login', ''),
                "name": user_data.get('name', ''),
                "bio": user_data.get('bio', ''),
                "location": user_data.get('location', ''),
                "company": user_data.get('company', ''),
                "blog": user_data.get('blog', ''),
                "url": user_data.get('html_url', ''),
                "repos": user_data.get('public_repos', 0),
                "followers": user_data.get('followers', 0)
            }
            
        except Exception as e:
            self.logger.error(f"❌ GitHub search failed: {e}")
            return {}
    
    async def _search_web(self, name: str) -> Dict:
        """Search web for person information"""
        self.logger.info("🌐 Searching web with Serper API...")
        
        if not self.serper_api_key:
            self.logger.warning("⚠️ No Serper API key found")
            return {}
        
        # Try multiple search queries
        search_queries = [
            f'"{name}" linkedin profile',
            f'"{name}" linkedin',
            f'{name} linkedin'
        ]
        
        for query in search_queries:
            self.logger.info(f"Trying search query: {query}")
            search_results = await self._search_with_serper(query)
            
            if search_results and 'organic' in search_results:
                linkedin_urls = self._extract_linkedin_urls(search_results)
                if linkedin_urls:
                    self.logger.info(f"Found LinkedIn URLs with query: {query}")
                    return {
                        "linkedin_urls": linkedin_urls,
                        "twitter_urls": [],
                        "other_profiles": {},
                        "search_results": {query: search_results},
                        "search_query": query
                    }
        
        return {
            "linkedin_urls": [],
            "twitter_urls": [],
            "other_profiles": {},
            "search_results": {},
            "search_query": ""
        }
    
    async def _search_with_serper(self, query: str) -> Dict:
        """Search using Serper API"""
        try:
            url = "https://google.serper.dev/search"
            headers = {
                'X-API-KEY': self.serper_api_key,
                'Content-Type': 'application/json'
            }
            payload = {"q": query}
            
            response = await self.session.post(url, headers=headers, json=payload)
            response.raise_for_status()
            
            result = response.json()
            organic_results = result.get('organic', [])
            if organic_results:
                self.logger.info(f"✅ Found {len(organic_results)} search results for query: {query}")
                self.logger.info("First few search results:")
                for i, result_item in enumerate(organic_results[:3]):
                    self.logger.info(f"  {i+1}. {result_item.get('title', 'No title')} - {result_item.get('link', 'No link')}")
            return result
            
        except Exception as e:
            self.logger.error(f"❌ Serper API request failed: {e}")
            return {}
    
    def _extract_linkedin_urls(self, search_results: Dict) -> list:
        """Extract LinkedIn URLs from search results"""
        linkedin_urls = []
        
        # Check organic results
        organic_results = search_results.get('organic', [])
        for result in organic_results:
            link = result.get('link', '')
            if 'linkedin.com/in/' in link or 'linkedin.com/pub/' in link or 'linkedin.com/company/' in link:
                linkedin_urls.append(link)
                self.logger.info(f"✅ Found LinkedIn: {link}")
        
        # Check knowledge graph
        knowledge_graph = search_results.get('knowledgeGraph', {})
        if knowledge_graph:
            # Look for LinkedIn in knowledge graph
            for key, value in knowledge_graph.items():
                if isinstance(value, str) and 'linkedin.com' in value:
                    linkedin_urls.append(value)
                    self.logger.info(f"✅ Found LinkedIn in knowledge graph: {value}")
        
        return list(set(linkedin_urls))  # Remove duplicates
    
    async def close(self):
        """Close the HTTP session"""
        await self.session.aclose()