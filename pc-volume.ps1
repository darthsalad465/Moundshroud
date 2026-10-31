param([string]$Action = 'get', [int]$Value = 0)
# Reads or changes the Windows master volume. Prints "level,muted" (level 0-100).
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int RegisterControlChangeNotify(IntPtr p); int UnregisterControlChangeNotify(IntPtr p); int GetChannelCount(out uint n);
  int SetMasterVolumeLevel(float l, ref Guid g); int SetMasterVolumeLevelScalar(float l, ref Guid g);
  int GetMasterVolumeLevel(out float l); int GetMasterVolumeLevelScalar(out float l);
  int SetChannelVolumeLevel(uint c, float l, ref Guid g); int SetChannelVolumeLevelScalar(uint c, float l, ref Guid g);
  int GetChannelVolumeLevel(uint c, out float l); int GetChannelVolumeLevelScalar(uint c, out float l);
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool m, ref Guid g); int GetMute(out bool m);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid iid, int ctx, IntPtr p, out IAudioEndpointVolume v); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int EnumAudioEndpoints(int f, int m, out IntPtr d); int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice d); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCom { }
public static class Vol {
  static IAudioEndpointVolume Ep() { IMMDevice d; ((IMMDeviceEnumerator)new MMDeviceEnumeratorCom()).GetDefaultAudioEndpoint(0, 1, out d); Guid iid = typeof(IAudioEndpointVolume).GUID; IAudioEndpointVolume v; d.Activate(ref iid, 23, IntPtr.Zero, out v); return v; }
  public static string Run(string a, int val) {
    IAudioEndpointVolume v = Ep(); Guid g = Guid.Empty; float l; bool m; v.GetMasterVolumeLevelScalar(out l); v.GetMute(out m);
    if (a == "set") v.SetMasterVolumeLevelScalar(Math.Max(0, Math.Min(100, val)) / 100f, ref g);
    else if (a == "up") v.SetMasterVolumeLevelScalar(Math.Min(1f, l + val / 100f), ref g);
    else if (a == "down") v.SetMasterVolumeLevelScalar(Math.Max(0f, l - val / 100f), ref g);
    else if (a == "mute") v.SetMute(true, ref g); else if (a == "unmute") v.SetMute(false, ref g);
    v.GetMasterVolumeLevelScalar(out l); v.GetMute(out m); return Math.Round(l * 100) + "," + (m ? "1" : "0");
  }
}
'@
[Console]::Out.Write([Vol]::Run($Action, $Value))
