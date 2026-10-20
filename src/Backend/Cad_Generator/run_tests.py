"""
Direct test runner that streams output to stdout.
Avoids PowerShell NativeCommandError when unittest writes to stderr.
"""
import sys
import unittest

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = loader.discover("engineering_system/tests")
    runner = unittest.TextTestRunner(stream=sys.stdout, verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
