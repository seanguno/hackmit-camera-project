#!/usr/bin/env python3
"""
Simple Person Search Agent
Takes a name and scrapes basic info from GitHub and web search
"""

import httpx
import asyncio
import json
from dotenv import load_dotenv
import os
import http.client
import json


load_dotenv()

from typing import Dict, Optional

class SimplePersonSearch:
    """Simple person search that gets basic info"""
    
    def __init__(self):
        self.session = httpx.AsyncClient(timeout=30)
        self.serper_api_key = os.getenv("SERPER_API_KEY")
    
    async def search_person(self, name: str) -> Dict:
        """Search for person information"""
        print(f"🔍 Searching for: {name}")
        
        result = {
            "name": name,
            "github": {},
            "web_info": {}
        }
        
        # Get GitHub info
        github_info = await self.get_github_info(name)
        if github_info:
            result["github"] = github_info
        
        # Get basic web info
        web_info = await self.get_web_info(name)
        if web_info:
            result["web_info"] = web_info
        
        return result
    
    async def get_github_info(self, name: str) -> Optional[Dict]:
        """Get GitHub information"""
        try:
            print("📱 Checking GitHub...")
            
            # Search GitHub users
            response = await self.session.get(
                "https://api.github.com/search/users",
                params={"q": name, "per_page": 1}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("items"):
                    user = data["items"][0]
                    
                    # Get detailed user info
                    user_response = await self.session.get(user["url"])
                    if user_response.status_code == 200:
                        user_data = user_response.json()
                        
                        return {
                            "username": user_data.get("login"),
                            "name": user_data.get("name"),
                            "bio": user_data.get("bio"),
                            "location": user_data.get("location"),
                            "company": user_data.get("company"),
                            "blog": user_data.get("blog"),
                            "url": user_data.get("html_url"),
                            "repos": user_data.get("public_repos", 0),
                            "followers": user_data.get("followers", 0)
                        }
        except Exception as e:
            print(f"❌ GitHub search failed: {e}")
        
        return None
    
    async def get_web_info(self, name: str) -> Optional[Dict]:
        """Get web information using Serper API"""
        try:
            print("🌐 Searching web with Serper API...")
            
            # Use Serper API for real web search
            search_results = await self.search_with_serper(name)
            
            # Extract LinkedIn and other social profiles from results
            linkedin_urls = self.extract_linkedin_urls(search_results)
            twitter_urls = self.extract_twitter_urls(search_results)
            other_profiles = self.extract_other_profiles(search_results)
            
            return {
                "linkedin_urls": linkedin_urls,
                "twitter_urls": twitter_urls,
                "other_profiles": other_profiles,
                "search_results": search_results,
                "search_query": f'"{name}" linkedin profile'
            }
        except Exception as e:
            print(f"❌ Web search failed: {e}")
            # Fallback to basic URLs
            return {
                "linkedin": f"https://linkedin.com/in/{name.lower().replace(' ', '-')}",
                "twitter": f"https://twitter.com/{name.lower().replace(' ', '')}",
                "search_query": f'"{name}"'
            }
    
    async def search_with_serper(self, name: str) -> Dict:
        """Search using Serper API"""
        try:
            if not self.serper_api_key:
                print("⚠️ No Serper API key found, using fallback")
                return {}
            
            # Create search query
            query = f'"{name}" linkedin profile'
            
            # Make request to Serper API
            payload = json.dumps({"q": query})
            headers = {
                'X-API-KEY': self.serper_api_key,
                'Content-Type': 'application/json'
            }
            
            conn = http.client.HTTPSConnection("google.serper.dev")
            conn.request("POST", "/search", payload, headers)
            res = conn.getresponse()
            data = res.read()
            
            result = json.loads(data.decode("utf-8"))
            print(f"✅ Found {len(result.get('organic', []))} search results")
            
            return result
            
        except Exception as e:
            print(f"❌ Serper API failed: {e}")
            return {}
    
    def extract_linkedin_urls(self, search_results: Dict) -> list[str]:
        """Extract LinkedIn URLs from search results"""
        linkedin_urls = []
        
        organic_results = search_results.get('organic', [])
        for result in organic_results:
            url = result.get('link', '')
            if 'linkedin.com/in/' in url:
                linkedin_urls.append(url)
                print(f"✅ Found LinkedIn: {url}")
        
        # Remove duplicates and limit to top 3
        return list(dict.fromkeys(linkedin_urls))[:3]
    
    def extract_twitter_urls(self, search_results: Dict) -> list[str]:
        """Extract Twitter URLs from search results"""
        twitter_urls = []
        
        organic_results = search_results.get('organic', [])
        for result in organic_results:
            url = result.get('link', '')
            if 'twitter.com/' in url or 'x.com/' in url:
                twitter_urls.append(url)
                print(f"✅ Found Twitter: {url}")
        
        return list(dict.fromkeys(twitter_urls))[:2]
    
    def extract_other_profiles(self, search_results: Dict) -> Dict[str, str]:
        """Extract other social profiles from search results"""
        profiles = {}
        
        organic_results = search_results.get('organic', [])
        for result in organic_results:
            url = result.get('link', '')
            title = result.get('title', '').lower()
            
            # Check for different platforms
            if 'instagram.com/' in url:
                profiles['instagram'] = url
            elif 'facebook.com/' in url:
                profiles['facebook'] = url
            elif 'youtube.com/' in url or 'youtu.be/' in url:
                profiles['youtube'] = url
            elif 'github.com/' in url:
                profiles['github'] = url
        
        return profiles
    
    async def close(self):
        """Close the session"""
        await self.session.aclose()

def print_summary(result: Dict):
    """Print a nice summary"""
    name = result["name"]
    github = result.get("github", {})
    web = result.get("web_info", {})
    
    print(f"\n🎯 **{name}**")
    print("=" * 50)
    
    if github:
        print("📱 GitHub:")
        if github.get("name"):
            print(f"   Name: {github['name']}")
        if github.get("bio"):
            print(f"   Bio: {github['bio']}")
        if github.get("location"):
            print(f"   Location: {github['location']}")
        if github.get("company"):
            print(f"   Company: {github['company']}")
        if github.get("url"):
            print(f"   Profile: {github['url']}")
        if github.get("repos"):
            print(f"   Repos: {github['repos']}")
    
    if web:
        print("\n🌐 Web & Social (via Serper API):")
        
        # LinkedIn URLs
        linkedin_urls = web.get("linkedin_urls", [])
        if linkedin_urls:
            print("   LinkedIn:")
            for i, url in enumerate(linkedin_urls, 1):
                print(f"     {i}. {url}")
        else:
            print("   LinkedIn: Not found in search results")
        
        # Twitter URLs
        twitter_urls = web.get("twitter_urls", [])
        if twitter_urls:
            print("   Twitter:")
            for i, url in enumerate(twitter_urls, 1):
                print(f"     {i}. {url}")
        
        # Other profiles
        other_profiles = web.get("other_profiles", {})
        if other_profiles:
            print("   Other Profiles:")
            for platform, url in other_profiles.items():
                print(f"     {platform.title()}: {url}")
        
        # Show search query used
        search_query = web.get("search_query", "")
        if search_query:
            print(f"   Search Query: {search_query}")

async def main():
    """Main function"""
    searcher = SimplePersonSearch()
    
    try:
        # Test with Sohum Gautam
        result = await searcher.search_person("Sohum Gautam")
        
        print("\n📊 Raw Data:")
        print(json.dumps(result, indent=2))
        
        print_summary(result)
        
    except Exception as e:
        print(f"❌ Error: {e}")
    
    finally:
        await searcher.close()

if __name__ == "__main__":
    asyncio.run(main())
