# Usage: python manage_licenses.py [--check]

import sys
import subprocess

# List of licenses to block in your source-available project during the CI check
FORBIDDEN_LICENSES = "GPL;AGPL;LGPL"
OUTPUT_FILE = "THIRD-PARTY-NOTICES-PYTHON.txt"

# Packages to ignore because they are CI/tooling artifacts and change frequently
IGNORED_PACKAGES = "pip;setuptools;wheel;pip-licenses;pip-tools;uv;tzdata"

def run_command(command):
    """Executes a CLI command and returns the result."""
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        return result
    except subprocess.CalledProcessError as e:
        return e

def install_dependencies():
    """Ensures pip-licenses is installed."""
    print("📦 Checking/Installing pip-licenses...")
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "pip-licenses"], check=True)

def generate_licenses():
    """Generates the third-party license documentation file without versions."""
    print(f"📄 Generating {OUTPUT_FILE}...")
    cmd = [
        "pip-licenses",
        "--format=plain-vertical",
        "--with-license-file",
        "--no-license-path",
        "--no-version",
        f"--ignore-packages={IGNORED_PACKAGES}",
        f"--output-file={OUTPUT_FILE}"
    ]
    res = run_command(cmd)
    if isinstance(res, subprocess.CalledProcessError):
        print(f"❌ Generation failed: {res.stderr}")
        sys.exit(1)
        
    try:
        with open(OUTPUT_FILE, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        # Replace Windows CRLF with Unix LF
        content = content.replace("\r\n", "\n")
        with open(OUTPUT_FILE, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
    except Exception as e:
        print(f"⚠️ Warning: Could not normalize line endings: {e}")

    print(f"✅ License documentation successfully saved to '{OUTPUT_FILE}'!")

def check_licenses():
    """Checks project dependencies for forbidden licenses (for CI/CD)."""
    print("🔍 Checking Python dependencies for restricted licenses...")
    cmd = [
        "pip-licenses", 
        "--fail-on", FORBIDDEN_LICENSES, 
        "--summary",
        f"--ignore-packages={IGNORED_PACKAGES}"
    ]
    
    res = run_command(cmd)
    
    # pip-licenses returns exit code 1 if blocked licenses are discovered
    if isinstance(res, subprocess.CalledProcessError) and res.returncode == 1:
        print("\n❌ ERROR: Unallowed licenses were found!")
        # Print the problematic packages found by the tool
        print(res.output) 
        sys.exit(1)
    elif isinstance(res, subprocess.CalledProcessError):
        # A different error occurred
        print(f"❌ Unexpected error: {res.stderr}")
        sys.exit(1)
    
    print("✅ All licenses are allowed!")

if __name__ == "__main__":
    install_dependencies()
    
    # Evaluate command-line arguments
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        check_licenses()
    else:
        check_licenses()  # Always check licenses first
        # Default behavior without arguments: Generate documentation
        generate_licenses()
