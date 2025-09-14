#!/usr/bin/env python3
"""
Main runner for the Extraordinary Analysis System with LinkedIn Integration
"""

import asyncio
import sys
import os
from dotenv import load_dotenv

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from agents.extraordinary.main import ExtraordinaryAnalyzer

async def main():
    """Main function to run the analysis system"""
    load_dotenv()
    
    print("🚀 Starting Extraordinary Analysis System with LinkedIn Integration")
    print("=" * 60)
    
    # Initialize the analyzer
    analyzer = ExtraordinaryAnalyzer()
    
    # Get name from command line or use default
    if len(sys.argv) > 1:
        name = " ".join(sys.argv[1:])
    else:
        name = "Sohum Gautam"  # Default for testing
    
    print(f"📊 Analyzing: {name}")
    print("-" * 40)
    
    try:
        # Run the analysis
        result = await analyzer.analyze_person(name)
        
        if result:
            print("\n✅ Analysis completed successfully!")
            print(f"📁 Profile saved to: {result}")
        else:
            print("\n❌ Analysis failed")
            
    except Exception as e:
        print(f"\n❌ Error during analysis: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
