param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent))

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$resourceJson = & node (Join-Path $ProjectRoot 'scripts/validate-extension.js') --json
if ($LASTEXITCODE -ne 0) { throw 'Extension validation failed.' }
$resources = $resourceJson | ConvertFrom-Json
$releaseDirectory = Join-Path $ProjectRoot 'dist'
New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
$archivePath = Join-Path $releaseDirectory "smart-download-organizer-$($resources.version).zip"
$files = @('manifest.json', 'INSTALL.txt', 'LICENSE', 'DESIGN-LICENSE.txt', 'icons/material/LICENSE') + @($resources.files)
$files = @($files | Sort-Object -Unique)
$archiveStream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($archiveStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($relativePath in $files) {
        $fullPath = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $relativePath))
        $rootPrefix = [System.IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\') + '\'
        if (-not $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Resource outside workspace: $relativePath" }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $fullPath, $relativePath.Replace('\', '/'), [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally {
    $archive.Dispose()
    $archiveStream.Dispose()
}

$hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText("$archivePath.sha256", "$hash  $([System.IO.Path]::GetFileName($archivePath))`n", [System.Text.UTF8Encoding]::new($false))
Write-Output "Created $archivePath"
Write-Output "$($files.Count) files; manifest.json is at ZIP root; no tests, posters, design masters or Git files."
Write-Output "SHA-256: $hash"
