#!/usr/bin/env python3
"""
Example usage of the Enhanced Extraordinary Analysis System
with Serper + Exa API integration
"""

from main import ExtraordinaryAnalyzer

def main():
    # Initialize the analyzer
    analyzer = ExtraordinaryAnalyzer()

    # Example 2: Analyze another person
    print("\n=== Example 2: Analyzing another person ===")
    result2 = analyzer.analyze_person("Elon Musk")
    

if __name__ == "__main__":
    main()
