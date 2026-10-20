"""
Validation Engine for verifying members, detailing models, and test cases against rules.
"""

from typing import List, Dict, Any, Tuple
from .model import Member
from .rules import RuleEngine, ConstraintViolation, ConstraintWarning


class ValidationEngine:
    """Verifies engineering models and runs validation test suites."""

    def __init__(self, rule_engine: RuleEngine = None):
        self.rule_engine = rule_engine or RuleEngine()

    def validate_member(self, member: Member) -> Tuple[bool, List[ConstraintWarning], List[str]]:
        """Validate a member engineering model."""
        errors: List[str] = []
        warnings: List[ConstraintWarning] = []

        # Check basic geometry
        if member.dimensions.get("length", 0) <= 0 and member.dimensions.get("span", 0) <= 0:
            errors.append("Member length/span must be greater than zero.")

        # Check cover
        if member.cover_nominal_mm < 15.0:
            errors.append(f"Nominal cover {member.cover_nominal_mm}mm is below the absolute minimum of 15mm.")

        # Check rebar groups
        for bg in member.bar_groups:
            if bg.count <= 0:
                errors.append(f"BarGroup {bg.group_id} has invalid count: {bg.count}")
            if bg.rebar.bar_size not in [6, 8, 10, 12, 16, 20, 25, 32, 40, 50]:
                warnings.append(ConstraintWarning(
                    "NON_STANDARD_BAR_SIZE",
                    f"Bar size {bg.rebar.bar_size}mm is not standard.",
                    "BS 8666"
                ))

        return len(errors) == 0, warnings, errors
