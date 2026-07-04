# Local MongoDB for dev (no admin / Windows service required).
$root = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $root ".mongo-data"
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

$mongod = "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe"
if (-not (Test-Path $mongod)) {
  $mongod = (Get-Command mongod -ErrorAction SilentlyContinue).Source
}
if (-not $mongod) {
  Write-Error "mongod not found. Install MongoDB or start the MongoDB Windows service as admin."
  exit 1
}

Write-Host "Starting MongoDB on 127.0.0.1:27017 (data: $dataDir)"
& $mongod --dbpath $dataDir --port 27017 --bind_ip 127.0.0.1
