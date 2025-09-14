#!/usr/bin/env python3
"""
LinkedIn Profile Scraper
Scrapes LinkedIn profile data to extract comprehensive achievements and recognition
"""

import asyncio
import aiohttp
import logging
from typing import Dict, List, Optional
from bs4 import BeautifulSoup
import re
import json

class LinkedInScraper:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.session = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def scrape_profile(self, linkedin_url: str) -> Dict:
        """
        Scrape a LinkedIn profile and extract comprehensive data
        """
        try:
            self.logger.info(f"🔍 Scraping LinkedIn profile: {linkedin_url}")
            
            async with self.session.get(linkedin_url) as response:
                if response.status == 200:
                    html = await response.text()
                    return self._parse_linkedin_html(html, linkedin_url)
                else:
                    self.logger.warning(f"❌ Failed to scrape LinkedIn: {response.status}")
                    return {}
                    
        except Exception as e:
            self.logger.error(f"❌ Error scraping LinkedIn: {e}")
            return {}
    
    def _parse_linkedin_html(self, html: str, url: str) -> Dict:
        """
        Parse LinkedIn HTML and extract profile data
        """
        soup = BeautifulSoup(html, 'html.parser')
        
        profile_data = {
            'url': url,
            'name': '',
            'headline': '',
            'location': '',
            'about': '',
            'experience': [],
            'education': [],
            'skills': [],
            'achievements': [],
            'certifications': [],
            'projects': [],
            'volunteer': [],
            'recommendations': []
        }
        
        try:
            # Extract name
            name_element = soup.find('h1', class_='text-heading-xlarge')
            if not name_element:
                name_element = soup.find('h1', {'data-anonymize': 'person-name'})
            if name_element:
                profile_data['name'] = name_element.get_text(strip=True)
            
            # Extract headline
            headline_element = soup.find('div', class_='text-body-medium')
            if not headline_element:
                headline_element = soup.find('div', {'data-anonymize': 'headline'})
            if headline_element:
                profile_data['headline'] = headline_element.get_text(strip=True)
            
            # Extract location
            location_element = soup.find('span', class_='text-body-small')
            if location_element:
                profile_data['location'] = location_element.get_text(strip=True)
            
            # Extract about section
            about_section = soup.find('section', {'data-section': 'summary'})
            if about_section:
                about_text = about_section.find('div', class_='display-flex')
                if about_text:
                    profile_data['about'] = about_text.get_text(strip=True)
            
            # Extract experience
            experience_section = soup.find('section', {'data-section': 'experience'})
            if experience_section:
                profile_data['experience'] = self._extract_experience(experience_section)
            
            # Extract education
            education_section = soup.find('section', {'data-section': 'education'})
            if education_section:
                profile_data['education'] = self._extract_education(education_section)
            
            # Extract skills
            skills_section = soup.find('section', {'data-section': 'skills'})
            if skills_section:
                profile_data['skills'] = self._extract_skills(skills_section)
            
            # Extract achievements and recognition
            profile_data['achievements'] = self._extract_achievements(soup)
            
            # Extract certifications
            cert_section = soup.find('section', {'data-section': 'certifications'})
            if cert_section:
                profile_data['certifications'] = self._extract_certifications(cert_section)
            
            # Extract projects
            projects_section = soup.find('section', {'data-section': 'projects'})
            if projects_section:
                profile_data['projects'] = self._extract_projects(projects_section)
            
            # Extract volunteer experience
            volunteer_section = soup.find('section', {'data-section': 'volunteer'})
            if volunteer_section:
                profile_data['volunteer'] = self._extract_volunteer(volunteer_section)
            
            self.logger.info(f"✅ Successfully parsed LinkedIn profile: {profile_data['name']}")
            
        except Exception as e:
            self.logger.error(f"❌ Error parsing LinkedIn HTML: {e}")
        
        return profile_data
    
    def _extract_experience(self, experience_section) -> List[Dict]:
        """Extract work experience from LinkedIn"""
        experiences = []
        
        try:
            experience_items = experience_section.find_all('li', class_='experience-item')
            
            for item in experience_items:
                exp = {}
                
                # Extract job title
                title_elem = item.find('h3', class_='experience-item__title')
                if title_elem:
                    exp['title'] = title_elem.get_text(strip=True)
                
                # Extract company
                company_elem = item.find('h4', class_='experience-item__company')
                if company_elem:
                    exp['company'] = company_elem.get_text(strip=True)
                
                # Extract duration
                duration_elem = item.find('time', class_='experience-item__duration')
                if duration_elem:
                    exp['duration'] = duration_elem.get_text(strip=True)
                
                # Extract description
                desc_elem = item.find('div', class_='experience-item__description')
                if desc_elem:
                    exp['description'] = desc_elem.get_text(strip=True)
                
                if exp:
                    experiences.append(exp)
                    
        except Exception as e:
            self.logger.error(f"Error extracting experience: {e}")
        
        return experiences
    
    def _extract_education(self, education_section) -> List[Dict]:
        """Extract education from LinkedIn"""
        education = []
        
        try:
            edu_items = education_section.find_all('li', class_='education-item')
            
            for item in edu_items:
                edu = {}
                
                # Extract school
                school_elem = item.find('h3', class_='education-item__school')
                if school_elem:
                    edu['school'] = school_elem.get_text(strip=True)
                
                # Extract degree
                degree_elem = item.find('h4', class_='education-item__degree')
                if degree_elem:
                    edu['degree'] = degree_elem.get_text(strip=True)
                
                # Extract duration
                duration_elem = item.find('time', class_='education-item__duration')
                if duration_elem:
                    edu['duration'] = duration_elem.get_text(strip=True)
                
                if edu:
                    education.append(edu)
                    
        except Exception as e:
            self.logger.error(f"Error extracting education: {e}")
        
        return education
    
    def _extract_skills(self, skills_section) -> List[str]:
        """Extract skills from LinkedIn"""
        skills = []
        
        try:
            skill_items = skills_section.find_all('span', class_='skill-category-entity__name')
            
            for item in skill_items:
                skill = item.get_text(strip=True)
                if skill:
                    skills.append(skill)
                    
        except Exception as e:
            self.logger.error(f"Error extracting skills: {e}")
        
        return skills
    
    def _extract_achievements(self, soup) -> List[str]:
        """Extract achievements and recognition from LinkedIn"""
        achievements = []
        
        try:
            # Look for various achievement indicators
            achievement_keywords = [
                'award', 'honor', 'recognition', 'scholarship', 'fellowship',
                'certification', 'achievement', 'accomplishment', 'winner',
                'finalist', 'nominee', 'top', 'best', 'outstanding'
            ]
            
            # Search through all text content
            text_content = soup.get_text().lower()
            
            for keyword in achievement_keywords:
                if keyword in text_content:
                    # Find the context around the keyword
                    pattern = rf'.{{0,100}}{re.escape(keyword)}.{{0,100}}'
                    matches = re.findall(pattern, text_content, re.IGNORECASE)
                    
                    for match in matches:
                        if len(match.strip()) > 10:  # Filter out very short matches
                            achievements.append(match.strip())
            
            # Remove duplicates and limit results
            achievements = list(set(achievements))[:10]
            
        except Exception as e:
            self.logger.error(f"Error extracting achievements: {e}")
        
        return achievements
    
    def _extract_certifications(self, cert_section) -> List[Dict]:
        """Extract certifications from LinkedIn"""
        certifications = []
        
        try:
            cert_items = cert_section.find_all('li', class_='certification-item')
            
            for item in cert_items:
                cert = {}
                
                # Extract certification name
                name_elem = item.find('h3', class_='certification-item__name')
                if name_elem:
                    cert['name'] = name_elem.get_text(strip=True)
                
                # Extract issuing organization
                org_elem = item.find('h4', class_='certification-item__issuer')
                if org_elem:
                    cert['issuer'] = org_elem.get_text(strip=True)
                
                # Extract issue date
                date_elem = item.find('time', class_='certification-item__date')
                if date_elem:
                    cert['date'] = date_elem.get_text(strip=True)
                
                if cert:
                    certifications.append(cert)
                    
        except Exception as e:
            self.logger.error(f"Error extracting certifications: {e}")
        
        return certifications
    
    def _extract_projects(self, projects_section) -> List[Dict]:
        """Extract projects from LinkedIn"""
        projects = []
        
        try:
            project_items = projects_section.find_all('li', class_='project-item')
            
            for item in project_items:
                project = {}
                
                # Extract project name
                name_elem = item.find('h3', class_='project-item__name')
                if name_elem:
                    project['name'] = name_elem.get_text(strip=True)
                
                # Extract description
                desc_elem = item.find('div', class_='project-item__description')
                if desc_elem:
                    project['description'] = desc_elem.get_text(strip=True)
                
                # Extract duration
                duration_elem = item.find('time', class_='project-item__duration')
                if duration_elem:
                    project['duration'] = duration_elem.get_text(strip=True)
                
                if project:
                    projects.append(project)
                    
        except Exception as e:
            self.logger.error(f"Error extracting projects: {e}")
        
        return projects
    
    def _extract_volunteer(self, volunteer_section) -> List[Dict]:
        """Extract volunteer experience from LinkedIn"""
        volunteer = []
        
        try:
            volunteer_items = volunteer_section.find_all('li', class_='volunteer-item')
            
            for item in volunteer_items:
                vol = {}
                
                # Extract role
                role_elem = item.find('h3', class_='volunteer-item__role')
                if role_elem:
                    vol['role'] = role_elem.get_text(strip=True)
                
                # Extract organization
                org_elem = item.find('h4', class_='volunteer-item__organization')
                if org_elem:
                    vol['organization'] = org_elem.get_text(strip=True)
                
                # Extract duration
                duration_elem = item.find('time', class_='volunteer-item__duration')
                if duration_elem:
                    vol['duration'] = duration_elem.get_text(strip=True)
                
                if vol:
                    volunteer.append(vol)
                    
        except Exception as e:
            self.logger.error(f"Error extracting volunteer experience: {e}")
        
        return volunteer

async def scrape_linkedin_profiles(linkedin_urls: List[str]) -> List[Dict]:
    """
    Scrape multiple LinkedIn profiles
    """
    profiles = []
    
    async with LinkedInScraper() as scraper:
        for url in linkedin_urls:
            try:
                profile_data = await scraper.scrape_profile(url)
                if profile_data:
                    profiles.append(profile_data)
            except Exception as e:
                logging.error(f"Error scraping {url}: {e}")
                continue
    
    return profiles

# Test function
async def test_linkedin_scraper():
    """Test the LinkedIn scraper"""
    test_urls = [
        "https://www.linkedin.com/in/sohum-gautam-74a085241",
        "https://www.linkedin.com/in/sohum-gautam-02260733b"
    ]
    
    profiles = await scrape_linkedin_profiles(test_urls)
    
    for profile in profiles:
        print(f"\n=== LinkedIn Profile: {profile['name']} ===")
        print(f"Headline: {profile['headline']}")
        print(f"Location: {profile['location']}")
        print(f"Experience: {len(profile['experience'])} items")
        print(f"Education: {len(profile['education'])} items")
        print(f"Skills: {len(profile['skills'])} items")
        print(f"Achievements: {len(profile['achievements'])} items")
        print(f"Certifications: {len(profile['certifications'])} items")
        print(f"Projects: {len(profile['projects'])} items")
        print(f"Volunteer: {len(profile['volunteer'])} items")

if __name__ == "__main__":
    asyncio.run(test_linkedin_scraper())
