#!/usr/bin/env python3
"""
Test LinkedIn scraper integration with the Extraordinary Analysis System
"""

import asyncio
import sys
import os
import logging

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from agents.extraordinary.main import ExtraordinaryAnalyzer
from agents.extraordinary.linkedin_scraper import scrape_linkedin_profiles

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_linkedin_scraper():
    """Test the LinkedIn scraper directly"""
    print("🔍 Testing LinkedIn Scraper...")
    
    # Test URLs (you can replace these with actual LinkedIn URLs)
    test_urls = [
        "https://www.linkedin.com/in/sohum-gautam-74a085241",
        "https://www.linkedin.com/in/sohum-gautam-02260733b"
    ]
    
    try:
        profiles = await scrape_linkedin_profiles(test_urls)
        
        print(f"✅ Scraped {len(profiles)} LinkedIn profiles")
        
        for i, profile in enumerate(profiles):
            print(f"\n=== Profile {i+1}: {profile.get('name', 'Unknown')} ===")
            print(f"Headline: {profile.get('headline', 'N/A')}")
            print(f"Location: {profile.get('location', 'N/A')}")
            print(f"Experience: {len(profile.get('experience', []))} items")
            print(f"Education: {len(profile.get('education', []))} items")
            print(f"Skills: {len(profile.get('skills', []))} items")
            print(f"Achievements: {len(profile.get('achievements', []))} items")
            print(f"Certifications: {len(profile.get('certifications', []))} items")
            print(f"Projects: {len(profile.get('projects', []))} items")
            print(f"Volunteer: {len(profile.get('volunteer', []))} items")
            
            # Show some sample data
            if profile.get('experience'):
                print(f"Sample Experience: {profile['experience'][0]}")
            if profile.get('achievements'):
                print(f"Sample Achievements: {profile['achievements'][:3]}")
                
    except Exception as e:
        print(f"❌ LinkedIn scraper test failed: {e}")
        logger.exception("LinkedIn scraper test error")

async def test_full_analysis_with_linkedin():
    """Test the full analysis system with LinkedIn integration"""
    print("\n🔍 Testing Full Analysis System with LinkedIn Integration...")
    
    try:
        # Initialize the analysis system
        analysis_system = ExtraordinaryAnalyzer()
        
        # Test with a name that has LinkedIn profiles
        name = "Sohum Gautam"
        
        print(f"📊 Analyzing: {name}")
        
        # Run the analysis
        result = await analysis_system.analyze_person(name)
        
        if result:
            print("✅ Analysis completed successfully!")
            print(f"Profile saved to: {result}")
        else:
            print("❌ Analysis failed")
            
    except Exception as e:
        print(f"❌ Full analysis test failed: {e}")
        logger.exception("Full analysis test error")

async def main():
    """Run all tests"""
    print("🚀 Starting LinkedIn Integration Tests...\n")
    
    # Test 1: LinkedIn scraper directly
    await test_linkedin_scraper()
    
    # Test 2: Full analysis system
    await test_full_analysis_with_linkedin()
    
    print("\n✅ All tests completed!")

if __name__ == "__main__":
    asyncio.run(main())
