<#
  ATUALIZAR - DiscórdiaHub  (dois cliques em ATUALIZAR.bat)
  =========================================================
  Publica uma atualização do começo ao fim, sem perguntas (só uma, opcional: "o que mudou?").
    1. Confere se há algo novo desde a última versão publicada.
    2. Sela o sala.html, confere o app de celular e roda os testes.
    3. Sobe o número da versão sozinho (1.6.0 -> 1.6.1) em package.json, package-lock.json e discordiahub.iss.
    4. Faz o commit, envia para o GitHub e cria a tag da versão.
    5. Espera o GitHub gerar o instalador do Windows e o APK do Android e avisa quando estiver pronto.
  Depois disso os amigos recebem sozinhos: no Windows quando abrirem o app, no Android ao abrir o app (aparece
  o botão "Atualização disponível: instalar").

  PRIMEIRA VEZ: se o projeto ainda não está ligado ao GitHub, ele chama o publicar-github.ps1 (que pergunta seu
  usuário e o nome do repositório). Nas próximas, é só abrir o ATUALIZAR.bat.

  PARÂMETROS (todos opcionais):
      -Tipo patch|minor|major   o quanto sobe a versão (padrão: patch, ex.: 1.6.0 -> 1.6.1)
      -Versao 1.7.0             define a versão exata
      -Mensagem "texto"         o que mudou (vai no commit); se omitido, ele pergunta (ENTER pula)
      -Rapido                   não roda os testes automáticos
      -SemEsperar               não espera o GitHub terminar de gerar os instaladores
#>
param(
  [ValidateSet("patch","minor","major")][string]$Tipo = "patch",
  [string]$Versao,
  [string]$Mensagem,
  [switch]$Rapido,
  [switch]$SemEsperar
)

$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

function Titulo($t) { Write-Host ""; Write-Host "== $t ==" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "   OK: $t" -ForegroundColor Green }
function Aviso($t)  { Write-Host "   ATENCAO: $t" -ForegroundColor Yellow }
function Falha($t)  { Write-Host ""; Write-Host "ERRO: $t" -ForegroundColor Red; exit 1 }
function Existe($c) { return [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Exec {
  param([string]$Exe, [string[]]$Argumentos)
  & $Exe @Argumentos
  if ($LASTEXITCODE -ne 0) { Falha "O comando falhou: $Exe $($Argumentos -join ' ')  (código $LASTEXITCODE)" }
}
function GitSaida { param([string[]]$Argumentos) $o = & git @Argumentos 2>$null; if ($LASTEXITCODE -ne 0) { return "" } else { return (($o | Out-String).Trim()) } }

# ---------------------------------------------------------------- 1. Ferramentas e repositório
Titulo "1/5  Conferindo"
if (-not (Existe "git"))  { Falha "Git não encontrado. Instale em https://git-scm.com/download/win e abra de novo." }
if (-not (Existe "node")) { Falha "Node.js não encontrado. Instale a versão LTS em https://nodejs.org e abra de novo." }
if (-not (Existe "npm"))  { Falha "npm não encontrado (vem junto com o Node.js)." }
if (-not (Test-Path "package.json")) { Falha "package.json não encontrado. Deixe este arquivo dentro da pasta do projeto." }

$remoto = ""
if (Test-Path ".git") { $remoto = GitSaida @("remote", "get-url", "origin") }
if (-not $remoto) {
  Write-Host ""
  Write-Host "   Este projeto ainda não está ligado ao GitHub. Vou abrir a publicação da PRIMEIRA vez." -ForegroundColor Yellow
  Write-Host "   (Ela pergunta seu usuário e o nome do repositório. Depois disso, é só abrir o ATUALIZAR.bat.)"
  Write-Host ""
  if (-not (Test-Path ".\publicar-github.ps1")) { Falha "publicar-github.ps1 não encontrado na pasta." }
  & ".\publicar-github.ps1"
  exit $LASTEXITCODE
}
if ($remoto -notmatch "github\.com[:/]([^/]+)/([^/]+?)(\.git)?$") { Falha "O remoto 'origin' não é do GitHub: $remoto" }
$Usuario = $Matches[1]; $Repo = $Matches[2]
Ok "Repositório: $Usuario/$Repo"

$ultimaTag = GitSaida @("describe", "--tags", "--abbrev=0")
$mudou = GitSaida @("status", "--porcelain")
$semNovidade = $false
if (-not $mudou -and $ultimaTag) {
  $cTag = GitSaida @("rev-list", "-n", "1", $ultimaTag)
  $cHead = GitSaida @("rev-parse", "HEAD")
  if ($cTag -and $cTag -eq $cHead) { $semNovidade = $true }
}
if ($semNovidade) {
  Write-Host ""
  Write-Host "Nada mudou desde a versão ${ultimaTag}: não há o que publicar." -ForegroundColor Yellow
  Write-Host "Edite os arquivos (ex.: o sala.html) e abra o ATUALIZAR.bat de novo."
  exit 0
}
if ($mudou) {
  Write-Host "   Arquivos alterados desde a última versão:"
  ($mudou -split "\r?\n") | ForEach-Object { Write-Host "     $_" }
} else { Ok "Há commits ainda não publicados." }
if ($mudou -match "node_modules|\.exe|\.apk|\.keystore|keystore-base64") { Aviso "Apareceu arquivo pesado ou secreto (node_modules, .exe, .apk, .keystore). Confira o .gitignore antes de continuar." }

# ---------------------------------------------------------------- 2. Selo, celular, testes
Titulo "2/5  Selo de segurança e testes"
if (-not (Test-Path "node_modules")) { Write-Host "   Primeira vez neste computador: instalando dependências (pode demorar)..."; Exec "npm" @("install") }
Exec "npm" @("run", "selar")
Ok "sala.html selado"
Exec "node" @("mobile/build-web.js")
Remove-Item -Recurse -Force "www" -ErrorAction SilentlyContinue
Ok "app de celular gera sem erro"
if ($Rapido) { Aviso "Testes pulados (-Rapido)." }
else {
  Write-Host "   Rodando os testes automáticos (alguns minutos)..."
  Exec "npx" @("playwright", "install", "chromium")
  Exec "npm" @("test")
  Ok "testes passaram"
}

# ---------------------------------------------------------------- 3. Versão
Titulo "3/5  Nova versão"
$atual = (node -p "require('./package.json').version").Trim()
if ($Versao) {
  if ($Versao.StartsWith("v")) { $Versao = $Versao.Substring(1) }
  if ($Versao -notmatch "^\d+\.\d+\.\d+$") { Falha "Versão inválida '$Versao'. Use o formato 1.6.1" }
  $nova = $Versao
} else {
  $p = $atual.Split(".") | ForEach-Object { [int]$_ }
  if ($Tipo -eq "major") { $nova = "$($p[0] + 1).0.0" }
  elseif ($Tipo -eq "minor") { $nova = "$($p[0]).$($p[1] + 1).0" }
  else { $nova = "$($p[0]).$($p[1]).$($p[2] + 1)" }
}
# nunca repete uma versão já publicada (local ou no GitHub): o atualizador só avisa quando o número SOBE
for ($i = 0; $i -lt 200; $i++) {
  $t = "v$nova"
  $usada = (GitSaida @("tag", "--list", $t)) -or (GitSaida @("ls-remote", "--tags", "origin", "refs/tags/$t"))
  if (-not $usada) { break }
  if ($Versao) { Falha "A versão $nova já foi publicada. Use outro número em -Versao." }
  $q = $nova.Split(".") | ForEach-Object { [int]$_ }
  $nova = "$($q[0]).$($q[1]).$($q[2] + 1)"
}
$tag = "v$nova"
Exec "npm" @("version", $nova, "--no-git-tag-version", "--allow-same-version")
if (Test-Path "discordiahub.iss") {
  $arq = Join-Path $PSScriptRoot "discordiahub.iss"
  $iss = [System.IO.File]::ReadAllText($arq)
  $iss = [regex]::Replace($iss, '(#define\s+MyAppVersion\s+")[^"]*(")', ('${1}' + $nova + '${2}'))
  [System.IO.File]::WriteAllText($arq, $iss, (New-Object System.Text.UTF8Encoding $true))
}
Ok "Versão: $atual -> $nova"

# ---------------------------------------------------------------- 4. Enviar
Titulo "4/5  Enviando para o GitHub"
if (-not $Mensagem) { $Mensagem = Read-Host "   O que mudou nesta versão? (ENTER para pular)" }
$msg = if ([string]::IsNullOrWhiteSpace($Mensagem)) { "Atualização $nova" } else { "v${nova}: " + $Mensagem.Trim() }
$nome = GitSaida @("config", "user.name"); $email = GitSaida @("config", "user.email")
if (-not $nome)  { $nome  = Read-Host "   Seu nome para os commits";  Exec "git" @("config", "user.name", $nome) }
if (-not $email) { $email = Read-Host "   Seu e-mail (o mesmo do GitHub)"; Exec "git" @("config", "user.email", $email) }
Exec "git" @("add", "-A")
if (GitSaida @("status", "--porcelain")) { Exec "git" @("commit", "-m", $msg); Ok "commit: $msg" }
Write-Host "   Se abrir o navegador, entre na sua conta do GitHub."
& git push -u origin HEAD
if ($LASTEXITCODE -ne 0) {
  # O GitHub tem algo que este computador não tem (ex.: README criado junto com o repositório). Junta e tenta de novo.
  Write-Host "   O GitHub tem alterações que você ainda não tem aqui. Juntando automaticamente..." -ForegroundColor Yellow
  $ramo = GitSaida @("rev-parse", "--abbrev-ref", "HEAD")
  Exec "git" @("fetch", "origin")
  $base = GitSaida @("merge-base", "HEAD", "origin/$ramo")
  if (-not $base) {
    # Históricos sem relação (o GitHub tem uma versão antiga publicada de outra pasta): mantém o histórico do GitHub
    # e aplica o estado atual do seu projeto por cima, em um único commit, sem conflitos.
    Write-Host "   O GitHub tem uma versão antiga do projeto. Mantendo o histórico dele e aplicando a sua por cima..." -ForegroundColor Yellow
    Exec "git" @("reset", "--soft", "origin/$ramo")
    Exec "git" @("commit", "-m", $msg)
  } else {
    & git pull origin $ramo --rebase
    if ($LASTEXITCODE -ne 0) {
      & git rebase --abort 2>$null
      Falha "Não consegui juntar sozinho (conflito). Nada foi perdido. Copie a mensagem acima e peça ajuda."
    }
  }
  Exec "git" @("push", "-u", "origin", "HEAD")
}
Ok "código enviado"
Exec "git" @("tag", "-a", $tag, "-m", "DiscórdiaHub $nova")
Exec "git" @("push", "origin", $tag)
Ok "tag $tag enviada: o GitHub começou a gerar o instalador e o APK"

# ---------------------------------------------------------------- 5. Esperar os arquivos
Titulo "5/5  Aguardando o GitHub gerar os arquivos"
$linkRel = "https://github.com/$Usuario/$Repo/releases/tag/$tag"
if ($SemEsperar) {
  Write-Host "   (-SemEsperar) Acompanhe em https://github.com/$Usuario/$Repo/actions"
} else {
  $api = "https://api.github.com/repos/$Usuario/$Repo/releases/tags/$tag"
  $pronto = $false; $ultimoFaltam = ""
  for ($i = 0; $i -lt 50; $i++) {
    Start-Sleep -Seconds 30
    $nomes = @()
    try {
      $r = Invoke-RestMethod -Uri $api -Headers @{ "User-Agent" = "DiscordiaHub-Atualizar" } -ErrorAction Stop
      $nomes = @($r.assets | ForEach-Object { $_.name })
    } catch { }
    $temExe = [bool]($nomes | Where-Object { $_ -like "DiscordiaHub-Setup-*.exe" })
    $temYml = $nomes -contains "latest.yml"
    $temApk = $nomes -contains "DiscordiaHub-Android.apk"
    $faltam = @()
    if (-not $temExe) { $faltam += "instalador do Windows" }
    if (-not $temYml) { $faltam += "latest.yml" }
    if (-not $temApk) { $faltam += "APK do Android" }
    if ($faltam.Count -eq 0) { $pronto = $true; break }
    $txt = $faltam -join ", "
    if ($txt -ne $ultimoFaltam) { Write-Host "   Ainda gerando: $txt ..."; $ultimoFaltam = $txt }
  }
  if ($pronto) { Ok "Tudo publicado: instalador do Windows, latest.yml e APK do Android" }
  else { Aviso "Passou de 25 minutos e ainda faltam arquivos. Veja o erro em https://github.com/$Usuario/$Repo/actions (ou se o repositório é PÚBLICO: a conferência automática só enxerga repositórios públicos)." }
}

Write-Host ""
Write-Host "PRONTO: versão $nova publicada." -ForegroundColor Green
Write-Host "  Página da versão ........ $linkRel"
Write-Host "  Windows: quem já tem o app recebe a atualização sozinho ao abri-lo."
Write-Host "  Android: ao abrir o app aparece 'Atualização $nova disponível: instalar'."
Write-Host "  iPhone: não atualiza por aqui (só TestFlight/App Store)."
