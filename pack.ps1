$source='C:\Users\Admin\Documents\trae\WeChat'
$dest='C:\Users\Admin\Documents\trae\WeChat\server-deploy-new.zip'
if(Test-Path $dest){Remove-Item $dest}
$tempDir=Join-Path $env:TEMP 'tarot-deploy'
if(Test-Path $tempDir){Remove-Item $tempDir -Recurse -Force}
New-Item -ItemType Directory -Path $tempDir|Out-Null
Copy-Item (Join-Path $source 'server.ts') $tempDir
Copy-Item (Join-Path $source 'package.json') $tempDir
Copy-Item (Join-Path $source 'package-lock.json') $tempDir
Copy-Item (Join-Path $source 'tsconfig.json') $tempDir
Copy-Item (Join-Path $source '.env.example') $tempDir
Copy-Item (Join-Path $source 'admin.html') $tempDir
Copy-Item (Join-Path $source 'metadata.json') $tempDir
Copy-Item -Path (Join-Path $source 'dist') -Destination (Join-Path $tempDir 'dist') -Recurse
Copy-Item -Path (Join-Path $source 'src\services') -Destination (Join-Path $tempDir 'src\services') -Recurse
Copy-Item -Path (Join-Path $source 'src\data') -Destination (Join-Path $tempDir 'src\data') -Recurse
Copy-Item -Path (Join-Path $source 'src\lib') -Destination (Join-Path $tempDir 'src\lib') -Recurse
Copy-Item -Path (Join-Path $source 'cards') -Destination (Join-Path $tempDir 'cards') -Recurse
New-Item -ItemType Directory -Path (Join-Path $tempDir 'uploads\avatars') -Force|Out-Null
Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath $dest -Force
$sz=(Get-Item $dest).Length/1MB
Write-Host "Package created: server-deploy-new.zip ($([math]::Round($sz,2)) MB)"
