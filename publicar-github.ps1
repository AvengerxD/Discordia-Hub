<#
  PUBLICAR NO GITHUB - DiscórdiaHub
  =================================
  O que este script faz, em ordem:
    1. Confere se Git, Node e npm estão instalados.
    2. Pergunta (ou recebe por parâmetro) seu usuário e o nome do repositório do GitHub.
    3. Grava esses dados em package.json (é isso que liga a atualização automática do Windows).
    4. (Opcional) sobe o número da versão em package.json, package-lock.json e discordiahub.iss.
    5. Roda npm install, sela o sala.html e (opcional) roda os testes.
    6. Cria o repositório Git local, faz o commit e liga ao GitHub (cria o repositório sozinho se o
       "gh" estiver instalado).
    7. Envia o código (push) e cria a tag vX.Y.Z. A tag dispara, na nuvem do GitHub, a geração do
       instalador do Windows, do APK do Android e do teste de compilação do iOS.

  COMO USAR (no PowerShell, dentro da pasta do projeto):
      powershell -ExecutionPolicy Bypass -File .\publicar-github.ps1
  ou dê dois cliques em publicar-github.bat.

  PARÂMETROS (todos opcionais):
      -Usuario  seu-usuario        usuário ou organização no GitHub
      -Repo     nome-do-repo       nome do repositório
      -Versao   1.6.1              nova versão (se omitido, usa a do package.json)
      -PularTestes                 não roda "npm test" (mais rápido, menos seguro)
      -SemTag                      envia o código mas NÃO cria a tag (não gera instaladores)
      -Privado                     cria o repositório como privado (ATENÇÃO: o atualizador
                                   automático do Windows só funciona com repositório PÚBLICO)

  EXEMPLO:
      .\publicar-github.ps1 -Usuario maria -Repo discordiahub -Versao 1.6.1
#>
param(
  [string]$Usuario,
  [string]$Repo,
  [string]$Versao,
  [switch]$PularTestes,
  [switch]$SemTag,
  [switch]$Privado
)

# "Continue": no PowerShell 5.1, "Stop" transforma qualquer aviso de comando externo (stderr) em erro.
# As falhas reais são tratadas pela função Exec, que confere o código de saída.
$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot

function Titulo($t) { Write-Host ""; Write-Host "== $t ==" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "   OK: $t" -ForegroundColor Green }
function Aviso($t)  { Write-Host "   ATENCAO: $t" -ForegroundColor Yellow }
function Falha($t)  { Write-Host ""; Write-Host "ERRO: $t" -ForegroundColor Red; exit 1 }

# Roda um comando externo e para o script se ele falhar (o PowerShell não faz isso sozinho).
function Exec {
  param([string]$Exe, [string[]]$Argumentos)
  & $Exe @Argumentos
  if ($LASTEXITCODE -ne 0) { Falha "O comando falhou: $Exe $($Argumentos -join ' ')  (código $LASTEXITCODE)" }
}
function Existe($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Perguntar($texto, $padrao) {
  $r = Read-Host ($texto + $(if ($padrao) { " [$padrao]" } else { "" }))
  if ([string]::IsNullOrWhiteSpace($r)) { return $padrao } else { return $r.Trim() }
}
function Confirmar($texto) {
  $r = Read-Host "$texto [S/n]"
  return ($r -eq "" -or $r -match "^[sSyY]")
}
function LerTexto($caminho) { return [System.IO.File]::ReadAllText((Resolve-Path $caminho)) }
function GravarTexto($caminho, $texto, $comBom) {
  [System.IO.File]::WriteAllText((Join-Path $PSScriptRoot $caminho), $texto, (New-Object System.Text.UTF8Encoding $comBom))
}

# ---------------------------------------------------------------- 1. Ferramentas
Titulo "1/7  Conferindo as ferramentas"
if (-not (Existe "git"))  { Falha "Git não encontrado. Instale em https://git-scm.com/download/win e abra um novo PowerShell." }
if (-not (Existe "node")) { Falha "Node.js não encontrado. Instale a versão LTS em https://nodejs.org e abra um novo PowerShell." }
if (-not (Existe "npm"))  { Falha "npm não encontrado (ele vem junto com o Node.js)." }
Ok ("git " + (git --version))
Ok ("node " + (node --version))
$major = [int]((node --version).TrimStart("v").Split(".")[0])
if ($major -lt 22) { Aviso "O projeto usa Node 22 ou mais novo (o GitHub usa o 22). Você tem o $major." }
if (-not (Test-Path "package.json")) { Falha "package.json não encontrado. Rode o script dentro da pasta do projeto." }

# ---------------------------------------------------------------- 2. Repositório
Titulo "2/7  Dados do repositório no GitHub"
$remotoAtual = ""
if (Test-Path ".git") { $remotoAtual = (git remote get-url origin 2>$null) }
if ($remotoAtual -match "github\.com[:/]([^/]+)/([^/]+?)(\.git)?$") {
  if (-not $Usuario) { $Usuario = $Matches[1] }
  if (-not $Repo)    { $Repo = $Matches[2] }
  Ok "Repositório já ligado a este projeto: $Usuario/$Repo"
}
if (-not $Usuario) { $Usuario = Perguntar "Seu usuário (ou organização) no GitHub" "" }
if (-not $Repo)    { $Repo = Perguntar "Nome do repositório" "discordiahub" }
if ($Usuario -notmatch "^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$") { Falha "Usuário inválido: '$Usuario'." }
if ($Repo -notmatch "^[A-Za-z0-9._-]+$") { Falha "Nome de repositório inválido: '$Repo'." }
Ok "Vai publicar em https://github.com/$Usuario/$Repo"
if ($Privado) { Aviso "Repositório PRIVADO: a atualização automática do Windows NÃO vai funcionar (precisa ser público)." }
else { Aviso "Repositório PÚBLICO: qualquer pessoa vê os arquivos. Não deixe senhas (ex.: TURN) dentro do sala.html." }

# ---------------------------------------------------------------- 3. package.json
Titulo "3/7  Ligando o package.json ao repositório"
$pkg = LerTexto "package.json"
$pkg = [regex]::Replace($pkg, '"owner"\s*:\s*"[^"]*"', ('"owner": "' + $Usuario + '"'))
$pkg = [regex]::Replace($pkg, '"repo"\s*:\s*"[^"]*"',  ('"repo": "' + $Repo + '"'))
GravarTexto "package.json" $pkg $false
Ok "package.json > build > publish agora aponta para $Usuario/$Repo"

# ---------------------------------------------------------------- 4. Versão
Titulo "4/7  Versão"
$versaoAtual = (node -p "require('./package.json').version").Trim()
if ($Versao) {
  if ($Versao.StartsWith("v")) { $Versao = $Versao.Substring(1) }
  if ($Versao -notmatch "^\d+\.\d+\.\d+$") { Falha "Versão inválida '$Versao'. Use o formato 1.6.1" }
  if ($Versao -ne $versaoAtual) {
    Exec "npm" @("version", $Versao, "--no-git-tag-version", "--allow-same-version")
    if (Test-Path "discordiahub.iss") {
      $iss = LerTexto "discordiahub.iss"
      $iss = [regex]::Replace($iss, '(#define\s+MyAppVersion\s+")[^"]*(")', ('${1}' + $Versao + '${2}'))
      GravarTexto "discordiahub.iss" $iss $true
    }
    Ok "Versão alterada: $versaoAtual > $Versao"
  } else { Ok "Versão mantida em $Versao" }
} else {
  $Versao = $versaoAtual
  Ok "Mantendo a versão do package.json: $Versao"
  Write-Host "   (Para lançar uma versão nova, rode de novo com -Versao 1.6.1. O atualizador só avisa quem" 
  Write-Host "    já tem o app quando o número é MAIOR que o instalado.)"
}
$tag = "v$Versao"

# ---------------------------------------------------------------- 5. Dependências, selo, testes
Titulo "5/7  Dependências, selo de segurança e testes"
Exec "npm" @("install")
Ok "npm install concluído (package-lock.json atualizado; mande ele junto para o GitHub)"
Exec "npm" @("run", "selar")
Ok "sala.html selado"
Exec "node" @("mobile/build-web.js")
Remove-Item -Recurse -Force "www" -ErrorAction SilentlyContinue
Ok "pasta do app de celular gera sem erro"
if ($PularTestes) { Aviso "Testes pulados (-PularTestes)." }
else {
  Write-Host "   Baixando o navegador de teste (só demora na primeira vez)..."
  Exec "npx" @("playwright", "install", "chromium")
  Exec "npm" @("test")
  Ok "testes automáticos passaram"
}

# ---------------------------------------------------------------- 6. Git local
Titulo "6/7  Git local"
if (-not (Test-Path ".git")) { Exec "git" @("init"); Ok "repositório Git criado" }
Exec "git" @("branch", "-M", "main")
$nome = (git config user.name 2>$null); $email = (git config user.email 2>$null)
if (-not $nome)  { $nome  = Perguntar "Seu nome para os commits" ""; Exec "git" @("config", "user.name", $nome) }
if (-not $email) { $email = Perguntar "Seu e-mail para os commits (o mesmo do GitHub)" ""; Exec "git" @("config", "user.email", $email) }
Exec "git" @("add", "-A")
$mudancas = git status --porcelain
if ($mudancas) {
  Write-Host "   Arquivos que entram no commit:"
  git status --short | ForEach-Object { Write-Host "     $_" }
  if (git status --porcelain | Select-String -Pattern "node_modules|\.exe$|\.apk$") { Aviso "Há arquivos pesados (node_modules, .exe, .apk) no commit. Confira o .gitignore." }
  $msg = Perguntar "Mensagem do commit" "Versão $Versao"
  Exec "git" @("commit", "-m", $msg)
  Ok "commit criado"
} else { Ok "nada novo para commitar" }

# ---------------------------------------------------------------- 7. GitHub
Titulo "7/7  Enviando para o GitHub"
$remoto = (git remote get-url origin 2>$null)
if (-not $remoto) {
  if (Existe "gh") {
    Write-Host "   GitHub CLI (gh) encontrado."
    gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Host "   Faça o login no GitHub (siga as instruções na tela):"; Exec "gh" @("auth", "login") }
    $vis = if ($Privado) { "--private" } else { "--public" }
    if (Confirmar "Criar agora o repositório $Usuario/$Repo no GitHub ($vis)?") {
      Exec "gh" @("repo", "create", "$Usuario/$Repo", $vis, "--source", ".", "--remote", "origin")
      Ok "repositório criado e ligado"
    } else { Falha "Sem repositório não dá para enviar. Crie em https://github.com/new e rode de novo." }
  } else {
    Write-Host ""
    Write-Host "   O 'gh' não está instalado, então crie o repositório à mão:"
    Write-Host "     1) Abra https://github.com/new"
    Write-Host "     2) Nome: $Repo   | Visibilidade: $(if ($Privado) { 'Private' } else { 'Public' })"
    Write-Host "     3) NÃO marque 'Add a README', '.gitignore' nem 'license' (o repositório precisa nascer vazio)"
    Write-Host "     4) Clique em Create repository"
    [void](Read-Host "   Quando terminar, aperte ENTER")
    Exec "git" @("remote", "add", "origin", "https://github.com/$Usuario/$Repo.git")
    Ok "origin = https://github.com/$Usuario/$Repo.git"
  }
}
Write-Host "   Enviando o código. Se abrir uma janela do navegador, entre na sua conta do GitHub."
Write-Host "   (Se pedir senha no terminal, use um Personal Access Token com permissões 'repo' e 'workflow'.)"
Exec "git" @("push", "-u", "origin", "main")
Ok "código enviado"

if ($SemTag) {
  Aviso "-SemTag: nenhuma tag criada. Para gerar os instaladores depois, use a aba Actions > Run workflow."
} else {
  $existe = git tag --list $tag
  if ($existe) {
    Aviso "A tag $tag já existe neste computador."
    if (Confirmar "Apagar e recriar a tag $tag (use só se ainda NÃO foi publicada para os amigos)?") {
      Exec "git" @("tag", "-d", $tag)
      git push origin ":refs/tags/$tag" 2>$null
    } else { Falha "Escolha outra versão com -Versao (ex.: -Versao 1.6.2)." }
  }
  Exec "git" @("tag", "-a", $tag, "-m", "DiscórdiaHub $Versao")
  Exec "git" @("push", "origin", $tag)
  Ok "tag $tag enviada: o GitHub começou a gerar os instaladores"
}

# ---------------------------------------------------------------- fim
Write-Host ""
Write-Host "PRONTO." -ForegroundColor Green
Write-Host "  Acompanhar o build ...... https://github.com/$Usuario/$Repo/actions"
Write-Host "  Baixar os instaladores .. https://github.com/$Usuario/$Repo/releases   (em uns 5 a 15 minutos)"
Write-Host "     - DiscordiaHub-Setup-$Versao.exe  (Windows)   - DiscordiaHub-Android.apk  (Android)"
Write-Host "     - latest.yml e .blockmap (necessários para a atualização automática: não apague)"
Write-Host "  iPhone: não sai instalador pelo GitHub; veja o LEIA-ME-CELULAR.txt (Xcode / TestFlight)."
