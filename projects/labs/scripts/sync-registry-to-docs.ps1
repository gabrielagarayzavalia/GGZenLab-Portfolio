#Requires -Version 5.1
<#
.SYNOPSIS
  Copia catalog.json e instances.json a docs/qa/labs/data/ para GitHub Pages.
#>
$ErrorActionPreference = 'Stop'
$labsDir = Split-Path $PSScriptRoot -Parent
$root = Split-Path $labsDir -Parent
$root = Split-Path $root -Parent
$src = $labsDir
$dest = Join-Path $root 'docs/qa/labs/data'

if (-not (Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
}

$files = @('catalog.json', 'instances.json')
foreach ($name in $files) {
    $from = Join-Path $src $name
    $to = Join-Path $dest $name
    if (-not (Test-Path $from)) {
        throw "Missing source file: $from"
    }
    $raw = Get-Content -Raw -Path $from
    $null = $raw | ConvertFrom-Json
    Copy-Item -Path $from -Destination $to -Force
    Write-Host "Synced $name -> docs/qa/labs/data/"
}

$instances = Get-Content -Raw (Join-Path $dest 'instances.json') | ConvertFrom-Json
Write-Host "Instances in registry: $($instances.instances.Count)"
