; Alternativa com Inno Setup 6.3+: empacota a pasta gerada por "npm run pasta".
; Passos: npm install > npm run pasta > abrir este arquivo no Inno Setup > Build > Compile.

#define MyAppName "DiscórdiaHub"
#define MyAppVersion "1.6.2"
#define MyAppPublisher "Seu nome ou do seu grupo"
#define MyAppExe "DiscordiaHub.exe"

[Setup]
AppId={{A8D848F0-FC9B-4D48-AAF2-D300A8EE6179}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=DiscordiaHub-App-Setup
SetupIconFile=icone.ico
UninstallDisplayIcon={app}\{#MyAppExe}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar um atalho na Área de Trabalho"; GroupDescription: "Atalhos:"

[Files]
Source: "dist\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExe}"; Description: "Abrir o DiscórdiaHub agora"; Flags: postinstall nowait skipifsilent
