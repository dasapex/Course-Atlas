$ErrorActionPreference = "Stop"

python scripts/extract_curriculum.py
hugo --gc --minify

Write-Host "Build complete: public/"