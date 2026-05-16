# ---------------------------------------------------------------------------
# One-time GCP setup + deploy for the Mark & Ari wedding website.
# Usage: .\deploy.ps1 -ProjectId weddingwebsite-496223
# ---------------------------------------------------------------------------
param(
    [Parameter(Mandatory)][string]$ProjectId,
    [string]$Region    = "us-central1",
    [string]$AdminUser = "admin",
    [string]$AdminPass = "admin"
)

$Service = "wedding-website"
$Repo    = "wedding"
$SqlInst = "wedding-db"
$DbName  = "wedding"
$DbUser  = "wedding_app"
$Image   = "$Region-docker.pkg.dev/$ProjectId/$Repo/$Service"

Write-Host ""
Write-Host "==> Project: $ProjectId   Region: $Region" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function New-RandomBase64([int]$bytes) {
    $buf = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($buf)
    return [Convert]::ToBase64String($buf)
}

function Write-TempFile([string]$content) {
    $tmp = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tmp, $content, (New-Object System.Text.UTF8Encoding $false))
    return $tmp
}

# Run a gcloud command, return its stdout, ignore stderr (informational noise)
function Invoke-Gcloud {
    $result = & gcloud @args 2>&1 | Where-Object { $_ -is [string] }
    return $result
}

function Assert-LastOk([string]$msg) {
    if ($LASTEXITCODE -ne 0) { throw $msg }
}

# ---------------------------------------------------------------------------
# 1. Enable APIs
# ---------------------------------------------------------------------------
Write-Host "==> 1. Enabling GCP APIs..." -ForegroundColor Yellow
& gcloud services enable `
    run.googleapis.com `
    sqladmin.googleapis.com `
    artifactregistry.googleapis.com `
    cloudbuild.googleapis.com `
    secretmanager.googleapis.com `
    --project=$ProjectId
Assert-LastOk "Failed to enable APIs"

# ---------------------------------------------------------------------------
# 2. Artifact Registry
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==> 2. Creating Artifact Registry repo..." -ForegroundColor Yellow
$repoList = Invoke-Gcloud artifacts repositories list `
    --location=$Region --project=$ProjectId `
    --filter="name:$Repo" --format="value(name)"
if (-not ($repoList -match $Repo)) {
    & gcloud artifacts repositories create $Repo `
        --repository-format=docker `
        --location=$Region `
        --project=$ProjectId
    Assert-LastOk "Failed to create Artifact Registry repo"
} else {
    Write-Host "   Repo already exists, skipping."
}

# ---------------------------------------------------------------------------
# 3. Cloud SQL
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==> 3. Creating Cloud SQL instance (this takes ~5 minutes)..." -ForegroundColor Yellow
$sqlList = Invoke-Gcloud sql instances list `
    --project=$ProjectId --filter="name=$SqlInst" --format="value(name)"
if (-not ($sqlList -match $SqlInst)) {
    & gcloud sql instances create $SqlInst `
        --database-version=POSTGRES_15 `
        --tier=db-f1-micro `
        --region=$Region `
        --project=$ProjectId
    Assert-LastOk "Failed to create Cloud SQL instance"
} else {
    Write-Host "   SQL instance already exists, skipping."
}

Write-Host ""
Write-Host "==> 3b. Creating database..." -ForegroundColor Yellow
$dbList = Invoke-Gcloud sql databases list `
    --instance=$SqlInst --project=$ProjectId `
    --filter="name=$DbName" --format="value(name)"
if (-not ($dbList -match $DbName)) {
    & gcloud sql databases create $DbName `
        --instance=$SqlInst --project=$ProjectId
    Assert-LastOk "Failed to create database"
} else {
    Write-Host "   Database already exists, skipping."
}

Write-Host ""
Write-Host "==> 3c. Creating DB user..." -ForegroundColor Yellow
$DbPass   = New-RandomBase64 24
$userList = Invoke-Gcloud sql users list `
    --instance=$SqlInst --project=$ProjectId `
    --filter="name=$DbUser" --format="value(name)"
if (-not ($userList -match $DbUser)) {
    & gcloud sql users create $DbUser `
        --instance=$SqlInst `
        --password=$DbPass `
        --project=$ProjectId
    Assert-LastOk "Failed to create DB user"
} else {
    & gcloud sql users set-password $DbUser `
        --instance=$SqlInst `
        --password=$DbPass `
        --project=$ProjectId
    Assert-LastOk "Failed to update DB user password"
    Write-Host "   User already existed - password updated."
}

# ---------------------------------------------------------------------------
# 4. Secret Manager
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==> 4. Storing DATABASE_URL in Secret Manager..." -ForegroundColor Yellow
$Conn  = "${ProjectId}:${Region}:${SqlInst}"
$DbUrl = "postgresql://${DbUser}:${DbPass}@/${DbName}?host=/cloudsql/${Conn}"
$tmp   = Write-TempFile $DbUrl

$secretList = Invoke-Gcloud secrets list `
    --project=$ProjectId --filter="name:wedding-db-url" --format="value(name)"
if (-not ($secretList -match "wedding-db-url")) {
    & gcloud secrets create wedding-db-url --data-file=$tmp --project=$ProjectId
    if ($LASTEXITCODE -ne 0) { Remove-Item $tmp; throw "Failed to create secret" }
} else {
    & gcloud secrets versions add wedding-db-url --data-file=$tmp --project=$ProjectId
    if ($LASTEXITCODE -ne 0) { Remove-Item $tmp; throw "Failed to update secret" }
}
Remove-Item $tmp

# ---------------------------------------------------------------------------
# 5. Grant Cloud Run SA access to secret
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==> 5. Granting Cloud Run service account access to secret..." -ForegroundColor Yellow
$ProjectNum = (Invoke-Gcloud projects describe $ProjectId --format="value(projectNumber)") | Select-Object -Last 1
$CrSa       = "${ProjectNum}-compute@developer.gserviceaccount.com"
Write-Host "   Service account: $CrSa"

& gcloud secrets add-iam-policy-binding wedding-db-url `
    --member="serviceAccount:$CrSa" `
    --role="roles/secretmanager.secretAccessor" `
    --project=$ProjectId
Assert-LastOk "Failed to set IAM binding"

# ---------------------------------------------------------------------------
# 6. Build container image
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==> 6. Building container image with Cloud Build..." -ForegroundColor Yellow
& gcloud builds submit --tag "${Image}:latest" --project=$ProjectId .
Assert-LastOk "Cloud Build failed"

# ---------------------------------------------------------------------------
# 7. Deploy to Cloud Run
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==> 7. Deploying to Cloud Run..." -ForegroundColor Yellow
$SessionSecret = New-RandomBase64 32

& gcloud run deploy $Service `
    --image="${Image}:latest" `
    --region=$Region `
    --platform=managed `
    --allow-unauthenticated `
    --port=8080 `
    --min-instances=0 `
    --max-instances=5 `
    --memory=256Mi `
    --cpu=1 `
    --set-secrets="DATABASE_URL=wedding-db-url:latest" `
    --add-cloudsql-instances=$Conn `
    --set-env-vars="ADMIN_USER=$AdminUser,ADMIN_PASS=$AdminPass,SESSION_SECRET=$SessionSecret" `
    --project=$ProjectId
Assert-LastOk "Cloud Run deploy failed"

# ---------------------------------------------------------------------------
# 8. Seed the database via Cloud Build
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==> 8. Seeding the database..." -ForegroundColor Yellow

$seedYaml = @"
steps:
- name: 'node:20-alpine'
  entrypoint: sh
  args:
  - '-c'
  - 'npm ci --only=production && DATABASE_URL=`$`$DATABASE_URL node database/seed.js'
  secretEnv: ['DATABASE_URL']
availableSecrets:
  secretManager:
  - versionName: projects/$ProjectId/secrets/wedding-db-url/versions/latest
    env: DATABASE_URL
"@

$tmpYaml = Write-TempFile $seedYaml
& gcloud builds submit --no-source --config=$tmpYaml --project=$ProjectId
$seedExit = $LASTEXITCODE
Remove-Item $tmpYaml
if ($seedExit -ne 0) {
    Write-Warning "Seed step failed - you may need to re-run it manually."
}

# ---------------------------------------------------------------------------
# 9. Done
# ---------------------------------------------------------------------------
$SiteUrl = (Invoke-Gcloud run services describe $Service `
    --region=$Region --project=$ProjectId --format="value(status.url)") | Select-Object -Last 1

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " Done!" -ForegroundColor Green
Write-Host " Site URL : $SiteUrl" -ForegroundColor Green
Write-Host " Admin    : $SiteUrl/admin  (user: $AdminUser)" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next step - map your custom domain:" -ForegroundColor Cyan
Write-Host "  gcloud run domain-mappings create --service=$Service --domain=markarikurpiel.com --region=$Region --project=$ProjectId"
Write-Host "Then add the DNS records printed above to your Squarespace dashboard."
Write-Host ""
