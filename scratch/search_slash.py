import os
import re

search_dir = r"e:\go-project\zspark\CodexMonitor-main\src"
patterns = {
    "startFork": r"\bstartFork\b",
    "startCompact": r"\bstartCompact\b",
    "startReview": r"\bstartReview\b",
    "startStatus": r"\bstartStatus\b",
    "startFast": r"\bstartFast\b",
    "startMcp": r"\bstartMcp\b",
    "startApps": r"\bstartApps\b",
}

for root, dirs, files in os.walk(search_dir):
    for file in files:
        if file.endswith((".ts", ".tsx")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                    for name, pat in patterns.items():
                        if re.search(pat, content):
                            # find line numbers
                            lines = content.split("\n")
                            for idx, line in enumerate(lines):
                                if re.search(pat, line):
                                    # Skip definition in useThreadMessaging.ts
                                    if "useThreadMessaging.ts" in path and "const start" in line:
                                        continue
                                    print(f"File: {path}:{idx+1} -> {line.strip()}")
            except Exception as e:
                print(f"Error reading {path}: {e}")
