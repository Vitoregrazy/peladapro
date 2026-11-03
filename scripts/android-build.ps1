param(
    [switch]$Release
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

# Create a clean ASCII junction if project path contains '&' so gradlew.bat (cmd.exe) does not split on '&'
$safeRoot = "C:\Users\vitor\antigravity\peladapro-build"
if ($projectRoot -match '&') {
    if (-not (Test-Path -LiteralPath $safeRoot)) {
        New-Item -ItemType Junction -Path $safeRoot -Target $projectRoot | Out-Null
    }
    $activeRoot = $safeRoot
} else {
    $activeRoot = $projectRoot
}

$androidDirectory = Join-Path $activeRoot 'android'
$androidStudioJava = 'C:\Program Files\Android\Android Studio\jbr'
$selectedJavaHome = $null

if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
    $selectedJavaHome = $env:JAVA_HOME
} elseif (Test-Path (Join-Path $androidStudioJava 'bin\java.exe')) {
    $selectedJavaHome = $androidStudioJava
} else {
    $javaCommand = Get-Command java.exe -ErrorAction SilentlyContinue
    if ($javaCommand) {
        $selectedJavaHome = Split-Path -Parent (Split-Path -Parent $javaCommand.Source)
    }
}

if (-not $selectedJavaHome) {
    throw 'Java nao encontrado. Instale o Android Studio com JBR ou configure JAVA_HOME.'
}

$env:JAVA_HOME = $selectedJavaHome
if (-not $env:ANDROID_HOME -and (Test-Path (Join-Path $env:LOCALAPPDATA 'Android\Sdk'))) {
    $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}

$assembleTask = if ($Release) { 'assembleRelease' } else { 'assembleDebug' }
$gradleTasks = @('--no-daemon', $assembleTask)

Push-Location $androidDirectory
try {
    & .\gradlew.bat @gradleTasks
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle terminou com o codigo $LASTEXITCODE."
    }
} finally {
    Pop-Location
}

$variant = if ($Release) { 'release' } else { 'debug' }
$apkDirectory = Join-Path $androidDirectory "app\build\outputs\apk\$variant"
$signedReleasePath = Join-Path $apkDirectory 'app-release.apk'
$unsignedReleasePath = Join-Path $apkDirectory 'app-release-unsigned.apk'
$apkPath = if ($Release -and (Test-Path $signedReleasePath)) {
    $signedReleasePath
} elseif ($Release) {
    $unsignedReleasePath
} else {
    Join-Path $apkDirectory 'app-debug.apk'
}

if (-not (Test-Path -LiteralPath $apkPath)) {
    throw "O APK esperado nao foi encontrado em $apkPath."
}

$rootCopyPath = Join-Path $projectRoot 'PeladaPro.apk'
Copy-Item -LiteralPath $apkPath -Destination $rootCopyPath -Force

Write-Host "APK gerado com sucesso:"
Write-Host " -> $apkPath"
Write-Host " -> $rootCopyPath"
