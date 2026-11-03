$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class QuietDesktop {
 [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
 public static extern bool SystemParametersInfo(int action, int param, string value, int flags);
}
'@
$image = [System.Drawing.Image]::FromFile($env:QUIET_IMAGE)
try { $image.Save($env:QUIET_BMP, [System.Drawing.Imaging.ImageFormat]::Bmp) } finally { $image.Dispose() }
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name WallpaperStyle -Value '10'
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name TileWallpaper -Value '0'
if (-not [QuietDesktop]::SystemParametersInfo(20, 0, $env:QUIET_BMP, 3)) { throw 'Windows 无法应用壁纸' }
