; Per-user installer around electron-builder's dist/win-unpacked. Build with `npm run dist:setup`,
; which passes AppVersion from package.json.
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{2BD957FD-F92E-4118-B6E0-6AEDB79B63BF}
AppName=Bellavellum
AppVersion={#AppVersion}
; No admin rights: installs to %LOCALAPPDATA%\Programs\Bellavellum.
PrivilegesRequired=lowest
DefaultDirName={autopf}\Bellavellum
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=Bellavellum-Setup
SetupIconFile=..\build\icon.ico
UninstallDisplayIcon={app}\Bellavellum.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\dist\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Bellavellum"; Filename: "{app}\Bellavellum.exe"
Name: "{autodesktop}\Bellavellum"; Filename: "{app}\Bellavellum.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Bellavellum.exe"; Description: "{cm:LaunchProgram,Bellavellum}"; Flags: nowait postinstall skipifsilent

; The data folder itself stays: it holds the DM's maps and scenes.
[UninstallDelete]
Type: files; Name: "{app}\data-path.txt"

[Code]
var
  DataPage: TInputDirWizardPage;

procedure InitializeWizard;
begin
  DataPage := CreateInputDirPage(wpSelectDir,
    'Datenordner', 'Wo sollen Karten und Szenen gespeichert werden?',
    'Bellavellum legt hier die Ordner "assets" und "scenes" an. Der Ordner bleibt beim Deinstallieren erhalten.' + #13#10#13#10 +
    'Daten vom USB-Stick übernehmen: den Inhalt des Ordners "data" vom Stick in diesen Ordner kopieren.',
    False, '');
  DataPage.Add('');
  DataPage.Values[0] := GetPreviousData('DataDir', ExpandConstant('{userdocs}\Bellavellum'));
end;

procedure RegisterPreviousData(PreviousDataKey: Integer);
begin
  SetPreviousData(PreviousDataKey, 'DataDir', DataPage.Values[0]);
end;

{ The app reads data-path.txt next to its exe; see src/main/dataDir.ts. }
procedure CurStepChanged(CurStep: TSetupStep);
var
  Lines: TArrayOfString;
begin
  if CurStep = ssPostInstall then
  begin
    SetArrayLength(Lines, 1);
    Lines[0] := DataPage.Values[0];
    if not ForceDirectories(Lines[0]) or not SaveStringsToUTF8File(ExpandConstant('{app}\data-path.txt'), Lines, False) then
      MsgBox('Der Datenordner konnte nicht eingerichtet werden: ' + Lines[0], mbError, MB_OK);
  end;
end;
