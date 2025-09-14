import httpx
import asyncio
import json
import os
import logging
from datetime import datetime
from dotenv import load_dotenv
from typing import Dict, List

load_dotenv()

class ExaSearch:
    """Enhanced search using Exa API for high-quality content discovery"""
    
    def __init__(self):
        self.session = httpx.AsyncClient(timeout=30)
        self.exa_api_key = os.getenv("EXA_API_KEY")
        self.logger = logging.getLogger(__name__)
    
    async def enhance_search(self, name: str, initial_data: Dict) -> Dict:
        """Enhance search results using Exa API"""
        if not self.exa_api_key:
            self.logger.warning("⚠️ No Exa API key found")
            return initial_data
        
        self.logger.info(f"🔍 Enhancing search with Exa API for: {name}")
        
        enhanced_data = initial_data.copy()
        enhanced_data["exa_results"] = {}
        
        # Extract key information for targeted searches
        github_info = initial_data.get('github', {})
        linkedin_urls = initial_data.get('web_info', {}).get('linkedin_urls', [])
        
        # Create targeted search queries
        search_queries = self._create_search_queries(name, github_info, linkedin_urls)
        
        self.logger.info(f"📋 Exa API will search for:")
        for query_type, query in search_queries.items():
            self.logger.info(f"   {query_type.upper()}: {query}")
        
        # Run Exa searches
        for query_type, query in search_queries.items():
            try:
                self.logger.info(f"🔍 Exa searching: {query_type} - '{query}'")
                results = await self._search_exa(query, query_type, github_info)
                if results and results.get('results'):
                    enhanced_data["exa_results"][query_type] = results
                    result_count = len(results.get('results', []))
                    self.logger.info(f"✅ Exa found {result_count} results for {query_type}")
                    
                    # Log first few results for each query type
                    for i, result in enumerate(results['results'][:3], 1):
                        title = result.get('title', 'No title')
                        url = result.get('url', 'No URL')
                        self.logger.info(f"   {i}. {title} - {url}")
                else:
                    self.logger.info(f"❌ No Exa results found for {query_type}")
            except Exception as e:
                self.logger.error(f"❌ Exa search failed for {query_type}: {e}")
        
        total_exa_results = sum(len(results.get('results', [])) for results in enhanced_data["exa_results"].values())
        self.logger.info(f"📊 Exa API enhancement complete: {total_exa_results} total results across {len(enhanced_data['exa_results'])} query types")
        
        return enhanced_data
    
    def _create_search_queries(self, name: str, github_info: Dict, linkedin_urls: List) -> Dict:
        """Create targeted search queries for Exa API"""
        queries = {}
        
        # Extract general identifiers to make searches more precise
        bio = github_info.get('bio', '') or ''
        location = github_info.get('location', '') or ''
        company = github_info.get('company', '') or ''
        
        # Create more specific search queries with general identifiers
        specific_identifiers = []
        
        # Add company/organization from bio
        if company:
            specific_identifiers.append(company)
        
        # Add location if available
        if location:
            specific_identifiers.append(location)
        
        # Add key terms from bio (general approach)
        bio_lower = bio.lower()
        if any(word in bio_lower for word in ['university', 'college', 'institute']):
            # Extract university/institution names
            for word in bio.split():
                if any(term in word.lower() for term in ['university', 'college', 'institute', 'tech', 'mit', 'stanford', 'harvard', 'berkeley']):
                    specific_identifiers.append(word)
        
        # Add professional keywords
        if any(word in bio_lower for word in ['ceo', 'founder', 'director', 'professor', 'researcher']):
            for word in bio.split():
                if any(term in word.lower() for term in ['ceo', 'founder', 'director', 'professor', 'researcher']):
                    specific_identifiers.append(word)
        
        # Build specific query with identifiers (limit to 3 most relevant)
        identifier_string = ' '.join(specific_identifiers[:3]) if specific_identifiers else ''
        
        # Basic name search with identifiers
        if identifier_string:
            queries["general"] = f'"{name}" {identifier_string}'
        else:
            queries["general"] = f'"{name}"'
        
        # Academic/research focused
        if any(word in bio_lower for word in ['research', 'ai', 'ml', 'phd', 'professor', 'academic']):
            if identifier_string:
                queries["academic"] = f'"{name}" {identifier_string} research papers publications'
            else:
                queries["academic"] = f'"{name}" research papers publications'
        
        # Company/organization focused
        if company:
            queries["company"] = f'"{name}" "{company}"'
        
        # News and media coverage
        queries["news"] = f'"{name}" news interview article'
        
        # Awards and recognition
        queries["awards"] = f'"{name}" award recognition honor'
        
        # LinkedIn content
        if linkedin_urls:
            queries["linkedin_content"] = f'"{name}" linkedin profile achievements'
        
        return queries
    
    async def _search_exa(self, query: str, query_type: str, github_info: Dict) -> Dict:
        """Search using Exa API"""
        try:
            url = "https://api.exa.ai/search"
            headers = {
                "x-api-key": self.exa_api_key,
                "Content-Type": "application/json"
            }
            
            payload = {
                "query": query,
                "type": "neural",
                "numResults": 10,
                "useAutoprompt": True
            }
            
            response = await self.session.post(url, headers=headers, json=payload)
            response.raise_for_status()
            
            data = response.json()
            results = data.get('results', [])
            
            # Filter results to ensure they match the correct person
            filtered_results = self._filter_relevant_results(results, query, github_info)
            
            self.logger.info(f"Exa API response for {query_type}: {len(results)} total results, {len(filtered_results)} relevant results")
            
            # Update the data with filtered results
            data['results'] = filtered_results
            return data
            
        except Exception as e:
            self.logger.error(f"Exa API request failed: {e}")
            return {}
    
    def _get_domain_filters(self, query_type: str) -> List[str]:
        """Get domain filters based on query type"""
        domain_filters = {
            "academic": [
                "scholar.google.com",
                "arxiv.org",
                "paperswithcode.com",
                "researchgate.net",
                "academia.edu"
            ],
            "news": [
                "techcrunch.com",
                "wired.com",
                "forbes.com",
                "bloomberg.com",
                "reuters.com",
                "bbc.com"
            ],
            "awards": [
                "nobelprize.org",
                "turing.acm.org",
                "ieee.org",
                "acm.org"
            ],
            "general": [
                "wikipedia.org",
                "github.com",
                "stackoverflow.com"
            ]
        }
        
        domains = domain_filters.get(query_type, [])
        if domains:
            self.logger.info(f"🎯 Exa targeting domains for {query_type}: {', '.join(domains)}")
        
        return domains
    
    def _filter_relevant_results(self, results: List[Dict], name: str, github_info: Dict) -> List[Dict]:
        """Filter Exa results to ensure they match the correct person"""
        filtered = []
        bio = github_info.get('bio', '').lower()
        location = github_info.get('location', '').lower()
        company = github_info.get('company', '')
        
        # Extract general relevant keywords from bio and profile
        relevant_keywords = []
        
        # Add location keywords
        if location:
            relevant_keywords.append(location.lower())
        
        # Add company keywords
        if company:
            relevant_keywords.append(company.lower())
        
        # Add general professional keywords from bio
        bio_words = bio.split()
        for word in bio_words:
            if any(term in word.lower() for term in ['university', 'college', 'institute', 'tech', 'ai', 'research', 'ceo', 'founder', 'director', 'professor']):
                relevant_keywords.append(word.lower())
        
        # Add common professional terms
        if any(word in bio for word in ['ai', 'artificial intelligence']):
            relevant_keywords.extend(['ai', 'artificial intelligence'])
        if any(word in bio for word in ['research', 'researcher']):
            relevant_keywords.append('research')
        if any(word in bio for word in ['founder', 'ceo', 'startup']):
            relevant_keywords.extend(['founder', 'ceo', 'startup'])
        
        # Remove duplicates and limit to reasonable number
        relevant_keywords = list(set(relevant_keywords))[:5]
        
        for result in results:
            title = result.get('title', '').lower()
            text = result.get('text', '').lower()
            url = result.get('url', '').lower()
            
            # Check if result contains relevant keywords
            result_text = f"{title} {text} {url}"
            
            # Check if the name appears in the result (basic relevance check)
            name_in_result = name.lower() in result_text
            
            # If we have specific keywords, check if at least one is present OR if name appears
            if relevant_keywords:
                if any(keyword in result_text for keyword in relevant_keywords) or name_in_result:
                    filtered.append(result)
                    self.logger.info(f"✅ Relevant result: {result.get('title', 'No title')}")
                else:
                    self.logger.info(f"❌ Irrelevant result (no keywords): {result.get('title', 'No title')}")
            else:
                # If no specific keywords, include results that mention the name
                if name_in_result:
                    filtered.append(result)
                    self.logger.info(f"✅ Relevant result (name match): {result.get('title', 'No title')}")
                else:
                    self.logger.info(f"❌ Irrelevant result (no name): {result.get('title', 'No title')}")
        
        return filtered
    
    async def close(self):
        """Close the HTTP session"""
        await self.session.aclose()