"""
Rule Engine and Engineering Constraint Checking.
Supports strict distinction between DIRECTLY_STATED, DERIVED, INFERRED, and PROPOSED facts.
Preserves full source traceability and enforces Eurocode 2 / BS 8666 / IStructE detailing constraints.
"""

from enum import Enum
from typing import List, Dict, Any, Callable, Optional


class FactType(str, Enum):
    DIRECTLY_STATED = "DIRECTLY_STATED"  # Exact manual text or table
    DERIVED = "DERIVED"                  # Mathematical / logical deduction
    INFERRED = "INFERRED"                # Visual / diagram interpretation
    PROPOSED = "PROPOSED"                # Software representation / engineering recommendation


class ConstraintSeverity(str, Enum):
    MANDATORY = "SHALL_MUST"             # Code violation: stops generation or raises
    RECOMMENDED = "SHOULD"               # Strong recommendation: triggers warning
    PERMISSIBLE = "MAY"                  # Optional variation
    FORBIDDEN = "NOT_PERMITTED"          # Strictly disallowed practice


class Constraint:
    """Represents a rule-based constraint definition."""
    def __init__(self, constraint_id: str, description: str, severity: ConstraintSeverity = ConstraintSeverity.MANDATORY, source: str = ""):
        self.constraint_id = constraint_id
        self.description = description
        self.severity = severity
        self.source = source


class ConstraintViolation(Exception):
    """Raised when a mandatory detailing rule is violated."""
    def __init__(self, rule_id: str, message: str, source: str = "", fact_type: FactType = FactType.DIRECTLY_STATED):
        self.rule_id = rule_id
        self.message = message
        self.source = source
        self.fact_type = fact_type
        super().__init__(f"[{rule_id}] ({fact_type.value} from {source}): {message}")


class ConstraintWarning:
    """Warning for non-critical detailing deviation or recommendation."""
    def __init__(self, rule_id: str, message: str, source: str = "", severity: ConstraintSeverity = ConstraintSeverity.RECOMMENDED):
        self.rule_id = rule_id
        self.message = message
        self.source = source
        self.severity = severity

    def __repr__(self) -> str:
        return f"Warning[{self.rule_id}] ({self.severity.value}): {self.message} (Source: {self.source})"


class Rule:
    """An individual engineering rule with traceability."""
    def __init__(
        self,
        rule_id: str,
        name: str,
        source: str,
        fact_type: FactType,
        severity: ConstraintSeverity,
        check_fn: Callable[[Dict[str, Any]], bool],
        failure_msg: str,
    ):
        self.rule_id = rule_id
        self.name = name
        self.source = source
        self.fact_type = fact_type
        self.severity = severity
        self.check_fn = check_fn
        self.failure_msg = failure_msg

    def evaluate(self, context: Dict[str, Any]) -> Optional[Any]:
        """Evaluates rule against context. Returns violation or warning if failed."""
        try:
            passed = self.check_fn(context)
        except Exception as e:
            # Check function itself raised an error
            if self.severity == ConstraintSeverity.MANDATORY:
                raise ConstraintViolation(self.rule_id, f"Evaluation error: {str(e)}", self.source, self.fact_type)
            return ConstraintWarning(self.rule_id, f"Evaluation error: {str(e)}", self.source, self.severity)

        if not passed:
            if self.severity in (ConstraintSeverity.MANDATORY, ConstraintSeverity.FORBIDDEN):
                raise ConstraintViolation(self.rule_id, self.failure_msg, self.source, self.fact_type)
            else:
                return ConstraintWarning(self.rule_id, self.failure_msg, self.source, self.severity)
        return None


class RuleEngine:
    """
    Standard Rule Engine preserving source traceability and constraint validation.
    Maintains registered rules, evaluates parameter dictionaries, and collects warnings/violations.
    """
    def __init__(self):
        self.rules: List[Rule] = []
        self.warnings: List[ConstraintWarning] = []

    def register(self, rule: Rule) -> None:
        self.rules.append(rule)

    def add_rule(
        self,
        rule_id: str,
        name: str,
        source: str,
        fact_type: FactType,
        severity: ConstraintSeverity,
        check_fn: Callable[[Dict[str, Any]], bool],
        failure_msg: str,
    ) -> None:
        self.register(Rule(rule_id, name, source, fact_type, severity, check_fn, failure_msg))

    def evaluate(self, context: Dict[str, Any]) -> List[ConstraintWarning]:
        """Evaluates all registered rules against the context dict. Raises ConstraintViolation on mandatory failures."""
        self.warnings.clear()
        for rule in self.rules:
            result = rule.evaluate(context)
            if isinstance(result, ConstraintWarning):
                self.warnings.append(result)
        return list(self.warnings)

    def check_mandatory(self, rule_id: str, condition: bool, message: str, source: str, fact_type: FactType = FactType.DIRECTLY_STATED):
        """Direct check helper for mandatory code rules."""
        if not condition:
            raise ConstraintViolation(rule_id, message, source, fact_type)

    def check_recommended(self, rule_id: str, condition: bool, message: str, source: str):
        """Direct check helper for recommended detailing rules."""
        if not condition:
            self.warnings.append(ConstraintWarning(rule_id, message, source, ConstraintSeverity.RECOMMENDED))
