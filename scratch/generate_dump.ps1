$files = @(
    "README.md",
    "eslint.config.js",
    "index.html",
    "package.json",
    "tsconfig.app.json",
    "tsconfig.json",
    "tsconfig.node.json",
    "vite.config.ts"
)

$srcFiles = Get-ChildItem -Path src -Recurse -File | Where-Object { $_.Extension -match "\.(ts|tsx|css)$" } | ForEach-Object { Resolve-Path $_.FullName -Relative }

$allFiles = $files + $srcFiles

$outputFile = "codebase_dump.txt"
$outputFileUtf8 = "codebase_dump_utf8.txt"

if (Test-Path $outputFile) { Remove-Item $outputFile }
if (Test-Path $outputFileUtf8) { Remove-Item $outputFileUtf8 }

foreach ($f in $allFiles) {
    if (Test-Path $f) {
        $header = "`n--- FILE: $f ---`n"
        $content = Get-Content -Path $f -Raw
        
        Add-Content -Path $outputFile -Value $header
        Add-Content -Path $outputFile -Value $content
        Add-Content -Path $outputFile -Value "`n"

        Add-Content -Path $outputFileUtf8 -Value $header -Encoding UTF8
        Add-Content -Path $outputFileUtf8 -Value $content -Encoding UTF8
        Add-Content -Path $outputFileUtf8 -Value "`n" -Encoding UTF8
    }
}
