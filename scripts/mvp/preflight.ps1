Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ensure-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

Step "Checking required commands"
Ensure-Command "node"
Ensure-Command "npm"
Ensure-Command "docker"
Write-Host "node: $(node -v)"
Write-Host "npm:  $(npm -v)"
Write-Host "docker: $(docker --version)"

Step "Ensuring .env exists"
if (-not (Test-Path ".env")) {
  throw "Missing .env at repo root. Create it before continuing."
}

Step "Starting Docker services"
docker compose -f "$repoRoot\docker-compose.yml" up -d

Step "Validating Prisma schema"
npx prisma validate --schema=packages/db/prisma/schema.prisma

Step "Checking Prisma migration status"
npx prisma migrate status --schema=packages/db/prisma/schema.prisma

Step "Generating Prisma client"
npx prisma generate --schema=packages/db/prisma/schema.prisma

Step "Running API typecheck"
npm run api:typecheck

Step "Preflight complete"
Write-Host "Environment is ready for MVP work." -ForegroundColor Green
