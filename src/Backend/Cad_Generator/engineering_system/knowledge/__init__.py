"""
Preserved and categorized structural engineering detailing knowledge base.
All extracted parameters, formulas, rules, and tables are preserved verbatim
with full source traceability.
"""

import os
import json

KNOWLEDGE_DIR = os.path.dirname(os.path.abspath(__file__))

def load_topic_knowledge(topic: str, filename: str) -> dict:
    """Helper to load preserved knowledge JSON file by topic."""
    path = os.path.join(KNOWLEDGE_DIR, topic, filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    raise FileNotFoundError(f"Knowledge file not found: {path}")
