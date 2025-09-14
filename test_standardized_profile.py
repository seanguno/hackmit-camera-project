#!/usr/bin/env python3
"""
Test script for the new standardized profile generation system
This demonstrates how the f-string based approach works with research variables
"""

import asyncio
import json
from src.agents.extraordinary.main import ExtraordinaryAnalyzer

async def test_standardized_profile():
    """Test the new standardized profile generation"""
    print("🧪 Testing Standardized Profile Generation")
    print("=" * 50)
    
    # Initialize analyzer
    analyzer = ExtraordinaryAnalyzer()
    
    # Test with a sample person
    test_name = "Sohum Gautam"
    print(f"🔍 Testing with: {test_name}")
    
    try:
        # Run analysis
        result = await analyzer.analyze_person(test_name)
        
        print("\n✅ Analysis completed successfully!")
        print(f"📊 Profile generated with standardized format")
        
        # Display the standardized profile structure
        analysis_result = result.get('analysis_result', {})
        print(f"\n📋 Profile Structure:")
        print(f"  - Name: {analysis_result.get('name', 'N/A')}")
        print(f"  - Title: {analysis_result.get('title_role', 'N/A')}")
        print(f"  - Country: {analysis_result.get('country', 'N/A')}")
        print(f"  - Company: {analysis_result.get('company_affiliation', 'N/A')}")
        print(f"  - Claim to Fame: {analysis_result.get('claim_to_fame', 'N/A')}")
        print(f"  - Recognition Items: {len(analysis_result.get('recognition', []))}")
        print(f"  - Achievement Items: {len(analysis_result.get('built_or_achieved', []))}")
        print(f"  - Sources: {len(analysis_result.get('sources', []))}")
        
        # Show criteria hits
        criteria_hits = analysis_result.get('criteria_hits', {})
        print(f"\n🎯 Criteria Hits:")
        for category, items in criteria_hits.items():
            if items:
                print(f"  - {category}: {len(items)} items")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_standardized_profile())
    if success:
        print("\n🎉 Standardized profile generation test completed successfully!")
    else:
        print("\n💥 Test failed!")
