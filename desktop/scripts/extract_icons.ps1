Add-Type -AssemblyName System.Drawing

$rendererDir = "L:\vue\zspark\desktop\src\renderer"

function Extract-AppIcon {
    param(
        [string]$exePath,
        [string]$outputName
    )
    if (Test-Path $exePath) {
        try {
            Write-Host "Extracting icon from $exePath..." -ForegroundColor Cyan
            $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath)
            $bitmap = $icon.ToBitmap()
            $destination = "$rendererDir\$outputName"
            $bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
            $bitmap.Dispose()
            $icon.Dispose()
            Write-Host "Successfully saved: $outputName" -ForegroundColor Green
            return $true
        } catch {
            Write-Host "Error extracting from $exePath - $_" -ForegroundColor Red
            return $false
        }
    }
    return $false
}

Write-Host "================ Starting Local Icon Extraction ================" -ForegroundColor Magenta

# 1. VS Code
$vscodePaths = @(
    "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe",
    "$env:ProgramFiles\Microsoft VS Code\Code.exe"
)
$vscodeDone = $false
foreach ($p in $vscodePaths) {
    if (Extract-AppIcon -exePath $p -outputName "vscode_logo.png") {
        $vscodeDone = $true
        break
    }
}
if (-not $vscodeDone) {
    Write-Host "VS Code not found. Keeping default AI icon." -ForegroundColor Yellow
}

# 2. Cursor
$cursorPaths = @(
    "L:\Program Files\cursor\Cursor.exe",
    "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe",
    "$env:ProgramFiles\cursor\Cursor.exe"
)
$cursorDone = $false
foreach ($p in $cursorPaths) {
    if (Extract-AppIcon -exePath $p -outputName "cursor_logo.png") {
        $cursorDone = $true
        break
    }
}
if (-not $cursorDone) {
    Write-Host "Cursor not found. Keeping default AI icon." -ForegroundColor Yellow
}

# 3. Zed
$zedPaths = @(
    "L:\Zed\Zed.exe",
    "$env:LOCALAPPDATA\Programs\Zed\zed.exe",
    "$env:ProgramFiles\Zed\zed.exe"
)
$zedDone = $false
foreach ($p in $zedPaths) {
    if (Extract-AppIcon -exePath $p -outputName "zed_logo.png") {
        $zedDone = $true
        break
    }
}
if (-not $zedDone) {
    Write-Host "Zed not found. Keeping default AI icon." -ForegroundColor Yellow
}

# 4. File Explorer
if (Extract-AppIcon -exePath "C:\Windows\explorer.exe" -outputName "folder_logo.png") {
    # Success
} else {
    Write-Host "File Explorer not found. Keeping default AI icon." -ForegroundColor Yellow
}

Write-Host "================ Local Icon Extraction Finished ================" -ForegroundColor Magenta
