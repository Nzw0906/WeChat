# 自动 Git 推送脚本
# 使用方法：双击运行或在 Trae 中执行

$ErrorActionPreference = "Stop"

# 刷新 PATH 以确保 git 可用
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 切换到脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# 检查 git 是否可用
try {
    git --version | Out-Null
} catch {
    Write-Host "[ERROR] Git 未安装或未配置 PATH" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

# 检查远程仓库是否配置
$remoteUrl = git remote get-url origin 2>$null
if (-not $remoteUrl) {
    Write-Host "[ERROR] 未配置远程仓库" -ForegroundColor Red
    Write-Host "请先在 GitHub/Gitee 创建仓库，然后运行以下命令添加远程仓库：" -ForegroundColor Yellow
    Write-Host "  git remote add origin 你的仓库地址" -ForegroundColor Cyan
    Read-Host "按回车退出"
    exit 1
}

# 检查是否有未提交的更改
$status = git status --porcelain
if (-not $status) {
    Write-Host "[INFO] 没有需要提交的更改" -ForegroundColor Green
    exit 0
}

# 显示更改文件
Write-Host "`n========== 待提交文件 ==========" -ForegroundColor Cyan
git status --short

# 获取提交信息（支持参数传入）
$commitMsg = if ($args[0]) { $args[0] } else { "chore: 自动保存" }

# 添加所有更改
Write-Host "`n[INFO] 正在添加文件..." -ForegroundColor Yellow
git add -A

# 提交
Write-Host "[INFO] 正在提交..." -ForegroundColor Yellow
git commit -m $commitMsg

# 推送
Write-Host "[INFO] 正在推送到远程..." -ForegroundColor Yellow
git push origin HEAD

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[SUCCESS] 已成功推送到远程仓库" -ForegroundColor Green
} else {
    Write-Host "`n[ERROR] 推送失败，请检查网络和远程仓库配置" -ForegroundColor Red
}

Write-Host "按回车退出..." -ForegroundColor Gray
Read-Host
