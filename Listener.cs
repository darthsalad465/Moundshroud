// Offline Assistant - hotkey listener (small native program, no dependencies).
//   Ctrl+Alt+A : open the assistant window / bring it forward / close it if it is already in front
//   Ctrl+Alt+Q : grab the selected text from any app and open the assistant with quick actions
//   Ctrl+Alt+W : grab the selected text and look it up in offline Wikipedia
//   Ctrl+Alt+D : grab the selected word and define it in the offline dictionary
//   Ctrl+Alt+N : quick capture - type a note (or "remind me ...") and press Enter\n//   Ctrl+Alt+V : open MOUNDSHROUD in voice mode (talk hands-free)
//   Ctrl+Alt+E : open MOUNDSHROUD at the emergency cards and contacts
//   Ctrl+Alt+C : open MOUNDSHROUD at the clipboard history (history itself is opt-in, data\clip-on)\n//   Ctrl+Alt+S : draw a box on the screen, read the text inside it (Windows OCR) and copy it
// Also shows reminders (data\reminders.tsv) as Windows notifications, even when the assistant window is closed.
// When the assistant window closes it tells the local server to shut down (which also stops the Ollama it started).
using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

public class Listener : Form
{
    const string URL = "http://127.0.0.1:47231";
    const string RUNKEY = @"Software\Microsoft\Windows\CurrentVersion\Run";
    static string Root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr h, int id, uint mod, uint vk);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr h, int id);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr ctx);
    [DllImport("user32.dll")] static extern bool AddClipboardFormatListener(IntPtr h);
    [DllImport("user32.dll")] static extern bool RemoveClipboardFormatListener(IntPtr h);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);

    NotifyIcon tray;
    System.Windows.Forms.Timer watch = new System.Windows.Forms.Timer();
    System.Windows.Forms.Timer rem = new System.Windows.Forms.Timer();
    bool seen = false, ocrBusy = false, ensuring = false; int watchTick = 0;

    [STAThread]
    static void Main()
    {
        bool created;
        Mutex m = new Mutex(true, "OfflineAssistantListenerExe", out created);
        if (!created) return;
        Application.EnableVisualStyles();
        Application.Run(new Listener());
        GC.KeepAlive(m);
    }

    public Listener()
    {
        ShowInTaskbar = false; FormBorderStyle = FormBorderStyle.None; Opacity = 0; WindowState = FormWindowState.Minimized;
        IntPtr h = Handle;                                   // force the window handle so hotkeys can be registered
        RegisterHotKey(h, 1, 3, 0x41);                       // Ctrl+Alt+A
        RegisterHotKey(h, 2, 3, 0x51);                       // Ctrl+Alt+Q
        RegisterHotKey(h, 3, 3, 0x57);                       // Ctrl+Alt+W
        RegisterHotKey(h, 4, 3, 0x44);                       // Ctrl+Alt+D
        RegisterHotKey(h, 5, 3, 0x53);                       // Ctrl+Alt+S
        RegisterHotKey(h, 6, 3, 0x4E);                       // Ctrl+Alt+N
        RegisterHotKey(h, 7, 3, 0x56);                       // Ctrl+Alt+V
        RegisterHotKey(h, 8, 3, 0x43);                       // Ctrl+Alt+C
        RegisterHotKey(h, 9, 3, 0x45);                       // Ctrl+Alt+E
        AddClipboardFormatListener(h);
        BuildTray();
        watch.Interval = 2000; watch.Tick += Watch; watch.Start();
        rem.Interval = 4000; rem.Tick += CheckReminders; rem.Start();
        CheckReminders(null, null);
    }
    protected override void SetVisibleCore(bool v) { base.SetVisibleCore(false); }
    protected override void WndProc(ref Message m)
    {
        if (m.Msg == 0x0312)
        {
            int id = m.WParam.ToInt32();
            if (id == 1) Toggle(); else if (id == 2) Selection(""); else if (id == 3) Selection("wiki");
            else if (id == 4) Selection("define"); else if (id == 5) ScreenText(); else if (id == 6) QuickCapture(); else if (id == 7) VoiceMode(); else if (id == 8) OpenMode("clip"); else if (id == 9) OpenMode("emergency");
        }
        else if (m.Msg == 0x031D) OnClip();
        base.WndProc(ref m);
    }

    // ---------- reminders ----------
    void CheckReminders(object s, EventArgs e)
    {
        try
        {
            string f = Path.Combine(Root, "data", "reminders.tsv");
            if (!File.Exists(f)) return;
            string[] lines = File.ReadAllLines(f, Encoding.UTF8);
            long now = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds;
            System.Collections.Generic.List<string> keep = new System.Collections.Generic.List<string>();
            System.Collections.Generic.List<string> due = new System.Collections.Generic.List<string>();
            System.Collections.Generic.List<string[]> dueRows = new System.Collections.Generic.List<string[]>();
            foreach (string ln in lines)
            {
                if (ln.Trim().Length == 0) continue;
                string[] p = ln.Split('\t'); long at;
                if (p.Length >= 3 && long.TryParse(p[1], out at) && at <= now) { due.Add(p[2]); dueRows.Add(p); } else keep.Add(ln);
            }
            if (due.Count == 0) return;
            string tmp = f + ".tmp"; File.WriteAllText(tmp, keep.Count == 0 ? "" : String.Join("\n", keep.ToArray()) + "\n", new UTF8Encoding(false));
            File.Copy(tmp, f, true); File.Delete(tmp);
            // daily verse rows look like "VERSE|reference|text": show only the newest one, and skip a verse that is more than 18 hours late (the PC was off)
            string[] lastVerse = null;
            foreach (string[] d in dueRows)
            {
                if (d[2].StartsWith("VERSE|"))
                {
                    long vat; if (long.TryParse(d[1], out vat) && now - vat < 18L * 3600L * 1000L) lastVerse = d;
                }
                else ShowReminder(d[0], d[2]);
            }
            if (lastVerse != null) ShowVerse(lastVerse[2]);
        }
        catch { }
    }
    // the verse of the day: a Windows notification plus a card with the whole verse
    void ShowVerse(string payload)
    {
        string[] parts = payload.Split(new char[] { '|' }, 3);
        string rf = parts.Length > 1 ? parts[1] : "", body = parts.Length > 2 ? parts[2] : payload;
        string shown = "“" + body + "”";
        Font vf = new Font("Georgia", 12.5f), rfont = new Font("Segoe UI Semibold", 10f);
        Size ms = TextRenderer.MeasureText(shown, vf, new Size(392, 4000), TextFormatFlags.WordBreak);
        int h = 36 + ms.Height + 12 + 22 + 16 + 30 + 16;
        Form pf = new Form(); pf.Text = "MOUNDSHROUD Verse of the day";
        pf.FormBorderStyle = FormBorderStyle.None; pf.StartPosition = FormStartPosition.Manual; pf.TopMost = true; pf.ShowInTaskbar = false;
        pf.BackColor = Color.FromArgb(18, 22, 40); pf.Size = new Size(424, h);
        Rectangle wa = Screen.PrimaryScreen.WorkingArea; pf.Location = new Point(wa.Right - 444, wa.Bottom - h - 20 - (popups % 3) * 40); popups++;
        pf.Paint += delegate(object s, PaintEventArgs e)
        {
            using (Pen p = new Pen(Color.FromArgb(139, 124, 255), 2)) e.Graphics.DrawRectangle(p, 1, 1, pf.Width - 3, pf.Height - 3);
            using (Font f1 = new Font("Segoe UI Semibold", 9f)) using (Brush b = new SolidBrush(Color.FromArgb(180, 170, 255))) e.Graphics.DrawString("MOUNDSHROUD  -  VERSE OF THE DAY", f1, b, 14, 10);
        };
        Label l = new Label(); l.Text = shown; l.Font = vf; l.ForeColor = Color.FromArgb(236, 238, 250); l.BackColor = Color.Transparent; l.SetBounds(16, 36, 392, ms.Height + 4); pf.Controls.Add(l);
        Label r = new Label(); r.Text = "- " + rf; r.Font = rfont; r.ForeColor = Color.FromArgb(150, 220, 205); r.BackColor = Color.Transparent; r.SetBounds(16, 36 + ms.Height + 12, 392, 22); pf.Controls.Add(r);
        string[] names = { "Open Moundshroud", "Dismiss" }; int[] xs = { 16, 140 };
        for (int i = 0; i < 2; i++)
        {
            Button b = new Button(); b.Text = names[i]; b.FlatStyle = FlatStyle.Flat; b.ForeColor = Color.FromArgb(236, 238, 250); b.BackColor = Color.FromArgb(30, 36, 66);
            b.FlatAppearance.BorderColor = Color.FromArgb(139, 124, 255); b.SetBounds(xs[i], h - 46, i == 0 ? 116 : 100, 30); bool openIt = i == 0;
            b.Click += delegate { if (openIt) OpenMode("verse"); pf.Close(); }; pf.Controls.Add(b);
        }
        pf.FormClosed += delegate { popups = Math.Max(0, popups - 1); };
        System.Windows.Forms.Timer tm = new System.Windows.Forms.Timer(); tm.Interval = 600000; tm.Tick += delegate { tm.Stop(); if (!pf.IsDisposed) pf.Close(); }; tm.Start();   // tidies itself away after 10 minutes
        pf.Show(); SetWindowPos(pf.Handle, new IntPtr(-1), 0, 0, 0, 0, 0x0013);     // topmost, without taking focus
        try { System.Media.SystemSounds.Asterisk.Play(); } catch { }
        string note = body.Length > 230 ? body.Substring(0, 227) + "..." : body, ttl = "Verse of the day - " + (rf.Length > 38 ? rf.Substring(0, 38) : rf);
        try { tray.ShowBalloonTip(15000, ttl, note, ToolTipIcon.Info); } catch { }
    }
    static void Snooze(string id, string text, int minutes)
    {
        try
        {
            string f = Path.Combine(Root, "data", "reminders.tsv"); long at = (long)(DateTime.UtcNow.AddMinutes(minutes) - new DateTime(1970, 1, 1)).TotalMilliseconds;
            File.AppendAllText(f, id + "\t" + at + "\t" + text.Replace('\t', ' ').Replace('\n', ' ') + "\n", new UTF8Encoding(false));
        }
        catch { }
    }
    int popups = 0;
    void ShowReminder(string id, string text)
    {
        Form pf = new Form(); pf.Text = "MOUNDSHROUD Reminder";
        pf.FormBorderStyle = FormBorderStyle.None; pf.StartPosition = FormStartPosition.Manual; pf.TopMost = true; pf.ShowInTaskbar = false;
        pf.BackColor = Color.FromArgb(4, 20, 36); pf.Size = new Size(380, 150);
        Rectangle wa = Screen.PrimaryScreen.WorkingArea; pf.Location = new Point(wa.Right - 400, wa.Bottom - 170 - (popups % 4) * 160); popups++;
        pf.Paint += delegate(object s, PaintEventArgs e)
        {
            using (Pen p = new Pen(Color.FromArgb(39, 211, 255), 2)) e.Graphics.DrawRectangle(p, 1, 1, pf.Width - 3, pf.Height - 3);
            using (Font f1 = new Font("Segoe UI Semibold", 9f)) using (Brush b = new SolidBrush(Color.FromArgb(125, 249, 255))) e.Graphics.DrawString("MOUNDSHROUD  -  REMINDER", f1, b, 14, 10);
        };
        Label l = new Label(); l.Text = text; l.ForeColor = Color.FromArgb(216, 244, 255); l.Font = new Font("Segoe UI", 12f); l.SetBounds(14, 34, 352, 60); l.BackColor = Color.Transparent;
        pf.Controls.Add(l);
        string[] names = { "Snooze 5 min", "Snooze 1 hour", "Dismiss" }; int[] mins = { 5, 60, 0 };
        for (int i = 0; i < 3; i++)
        {
            Button b = new Button(); b.Text = names[i]; b.FlatStyle = FlatStyle.Flat; b.ForeColor = Color.FromArgb(216, 244, 255); b.BackColor = Color.FromArgb(10, 38, 64);
            b.FlatAppearance.BorderColor = Color.FromArgb(39, 211, 255); b.SetBounds(14 + i * 118, 104, 112, 30); int m = mins[i];
            b.Click += delegate { if (m > 0) Snooze(id, text, m); pf.Close(); }; pf.Controls.Add(b);
        }
        pf.FormClosed += delegate { popups = Math.Max(0, popups - 1); };
        pf.Show(); SetWindowPos(pf.Handle, new IntPtr(-1), 0, 0, 0, 0, 0x0013);     // topmost, without taking focus
        try { System.Media.SystemSounds.Exclamation.Play(); } catch { }
        try { tray.ShowBalloonTip(10000, "Reminder", text, ToolTipIcon.Info); } catch { }
    }



    // ---------- clipboard history (only while data\clip-on exists; the web app switches it) ----------
    string lastClip = ""; int clipWrites = 0;
    static readonly System.Text.RegularExpressions.Regex SecretLike = new System.Text.RegularExpressions.Regex(@"^(?=\S{8,64}$)(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9])(?!.*://)\S+$|^\d[\d \-]{11,22}\d$");
    void OnClip()
    {
        try
        {
            string dir = Path.Combine(Root, "data"); if (!File.Exists(Path.Combine(dir, "clip-on"))) return;
            IDataObject d = Clipboard.GetDataObject(); if (d == null) return;
            if (d.GetDataPresent("ExcludeClipboardContentFromMonitorProcessing") || d.GetDataPresent("Clipboard Viewer Ignore")) return;   // password managers ask not to be recorded
            if (!Clipboard.ContainsText()) return;
            string t = Clipboard.GetText(); if (String.IsNullOrWhiteSpace(t) || t.Length > 8000 || t == lastClip) return;
            lastClip = t; if (SecretLike.IsMatch(t.Trim())) return;                                                                  // looks like a password or card number
            long at = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds;
            string f = Path.Combine(dir, "clipboard.jsonl");
            File.AppendAllText(f, "{\"id\":\"" + at + "\",\"at\":" + at + ",\"text\":" + JsonStr(t) + "}\n", new UTF8Encoding(false));
            if (++clipWrites % 20 == 0)
            {
                string[] all = File.ReadAllLines(f, Encoding.UTF8);
                if (all.Length > 150) { string[] keep = new string[100]; Array.Copy(all, all.Length - 100, keep, 0, 100); File.WriteAllText(f, String.Join("\n", keep) + "\n", new UTF8Encoding(false)); }
            }
        }
        catch { }
    }
    void OpenMode(string mode)
    {
        ThreadPool.QueueUserWorkItem(delegate
        {
            EnsureServer();
            try { PostJson("/api/incoming", "{\"mode\":\"" + mode + "\"}"); } catch { }
            IntPtr w = FindAssistant();
            if (w != IntPtr.Zero) BeginInvoke(new MethodInvoker(delegate { FocusWindow(w); }));
            else LaunchEdge();
        });
    }
    // ---------- quick capture (Ctrl+Alt+N) ----------
    Form quickForm = null;
    void QuickCapture()
    {
        if (quickForm != null && !quickForm.IsDisposed) { quickForm.Activate(); return; }
        Form f = new Form(); quickForm = f; f.Text = "MOUNDSHROUD Quick Note";
        f.FormBorderStyle = FormBorderStyle.None; f.StartPosition = FormStartPosition.Manual; f.TopMost = true; f.ShowInTaskbar = false;
        f.BackColor = Color.FromArgb(22, 25, 35); f.Size = new Size(620, 96);
        Rectangle wa = Screen.PrimaryScreen.WorkingArea; f.Location = new Point(wa.Left + (wa.Width - f.Width) / 2, wa.Top + wa.Height / 4);
        f.Paint += delegate(object s, PaintEventArgs e)
        {
            using (Pen p = new Pen(Color.FromArgb(139, 124, 255), 2)) e.Graphics.DrawRectangle(p, 1, 1, f.Width - 3, f.Height - 3);
            using (Font f1 = new Font("Segoe UI", 9f)) using (Brush b = new SolidBrush(Color.FromArgb(154, 163, 186))) e.Graphics.DrawString("Quick note  -  or type \"remind me to ... tomorrow at 9am\".  Enter to save, Esc to cancel.", f1, b, 16, 10);
        };
        TextBox tb = new TextBox(); tb.Font = new Font("Segoe UI", 14f); tb.BackColor = Color.FromArgb(29, 33, 46); tb.ForeColor = Color.FromArgb(236, 238, 245); tb.BorderStyle = BorderStyle.None;
        tb.SetBounds(16, 40, 588, 40); f.Controls.Add(tb);
        tb.KeyDown += delegate(object s, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Escape) { e.SuppressKeyPress = true; f.Close(); }
            else if (e.KeyCode == Keys.Enter)
            {
                e.SuppressKeyPress = true; string t = tb.Text.Trim(); f.Close();
                if (t.Length > 0) ThreadPool.QueueUserWorkItem(delegate { SaveQuick(t); });
            }
        };
        f.Deactivate += delegate { if (!f.IsDisposed) f.Close(); };
        f.Shown += delegate { f.Activate(); tb.Focus(); };
        f.Show(); SetForegroundWindow(f.Handle); tb.Focus();
    }
    void SaveQuick(string text)
    {
        try
        {
            EnsureServer();
            HttpWebRequest r = (HttpWebRequest)WebRequest.Create(URL + "/api/quick");
            r.Method = "POST"; r.ContentType = "application/json"; r.Timeout = 5000; r.Proxy = null;
            byte[] b = Encoding.UTF8.GetBytes("{\"text\":" + JsonStr(text) + "}"); r.ContentLength = b.Length;
            using (Stream s = r.GetRequestStream()) s.Write(b, 0, b.Length);
            string resp; using (HttpWebResponse res = (HttpWebResponse)r.GetResponse()) using (StreamReader sr = new StreamReader(res.GetResponseStream(), Encoding.UTF8)) resp = sr.ReadToEnd();
            string title = "Saved", msg = "Added to your Quick Inbox note.";
            if (resp.Contains("\"reminder\"")) { System.Text.RegularExpressions.Match m = System.Text.RegularExpressions.Regex.Match(resp, "\"when\":\"([^\"]*)\""); title = "Reminder set"; msg = m.Success ? m.Groups[1].Value : "OK"; }
            else if (resp.Contains("\"error\"")) { title = "Could not set that"; msg = "Try: remind me to call Sam tomorrow at 9am"; }
            BeginInvoke(new MethodInvoker(delegate { tray.ShowBalloonTip(3500, title, msg, ToolTipIcon.Info); }));
        }
        catch { BeginInvoke(new MethodInvoker(delegate { tray.ShowBalloonTip(3500, "Quick note failed", "Moundshroud could not save that.", ToolTipIcon.Warning); })); }
    }
    void VoiceMode()
    {
        ThreadPool.QueueUserWorkItem(delegate
        {
            EnsureServer();
            try { PostJson("/api/incoming", "{\"mode\":\"voice\"}"); } catch { }
            IntPtr w = FindAssistant();
            if (w != IntPtr.Zero) BeginInvoke(new MethodInvoker(delegate { FocusWindow(w); }));
            else LaunchEdge();
        });
    }
    // ---------- text from the screen (OCR) ----------
    class Snip : Form
    {
        public Rectangle Sel = Rectangle.Empty; Point a; bool drag; Bitmap shot;
        public Snip(Bitmap bmp, Rectangle area)
        {
            shot = bmp; FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.Manual; Bounds = area; TopMost = true; ShowInTaskbar = false;
            DoubleBuffered = true; Cursor = Cursors.Cross; KeyPreview = true;
        }
        protected override void OnKeyDown(KeyEventArgs e) { if (e.KeyCode == Keys.Escape) { Sel = Rectangle.Empty; DialogResult = DialogResult.Cancel; Close(); } }
        protected override void OnMouseDown(MouseEventArgs e) { if (e.Button == MouseButtons.Left) { a = e.Location; drag = true; Sel = new Rectangle(a, Size.Empty); } else { DialogResult = DialogResult.Cancel; Close(); } }
        protected override void OnMouseMove(MouseEventArgs e)
        {
            if (!drag) return;
            Sel = new Rectangle(Math.Min(a.X, e.X), Math.Min(a.Y, e.Y), Math.Abs(e.X - a.X), Math.Abs(e.Y - a.Y)); Invalidate();
        }
        protected override void OnMouseUp(MouseEventArgs e) { if (drag) { drag = false; DialogResult = Sel.Width > 6 && Sel.Height > 6 ? DialogResult.OK : DialogResult.Cancel; Close(); } }
        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics; g.DrawImage(shot, 0, 0, Width, Height);
            using (SolidBrush dim = new SolidBrush(Color.FromArgb(120, 5, 8, 20)))
            {
                if (Sel.Width > 0 && Sel.Height > 0)
                {
                    g.FillRectangle(dim, 0, 0, Width, Sel.Top); g.FillRectangle(dim, 0, Sel.Bottom, Width, Height - Sel.Bottom);
                    g.FillRectangle(dim, 0, Sel.Top, Sel.Left, Sel.Height); g.FillRectangle(dim, Sel.Right, Sel.Top, Width - Sel.Right, Sel.Height);
                    using (Pen p = new Pen(Color.FromArgb(124, 140, 255), 2)) g.DrawRectangle(p, Sel);
                }
                else g.FillRectangle(dim, 0, 0, Width, Height);
            }
            using (Font f = new Font("Segoe UI", 13)) using (SolidBrush b = new SolidBrush(Color.White))
                g.DrawString("Drag a box around the text you want to copy.  Esc to cancel.", f, b, 24, 20);
        }
    }
    void ScreenText()
    {
        if (ocrBusy) return; ocrBusy = true;
        string png = Path.Combine(Root, "data", "ocr-tmp.png");
        IntPtr old = SetThreadDpiAwarenessContext(new IntPtr(-2));       // system DPI aware: real pixels, so the text is sharp
        Bitmap crop = null;
        try
        {
            Thread.Sleep(250);                                            // let the hotkey keys come up
            Rectangle area = SystemInformation.VirtualScreen;
            Bitmap shot = new Bitmap(area.Width, area.Height);
            using (Graphics g = Graphics.FromImage(shot)) g.CopyFromScreen(area.Location, Point.Empty, area.Size);
            Rectangle sel;
            using (Snip sn = new Snip(shot, area)) { DialogResult r = sn.ShowDialog(); sel = sn.Sel; if (r != DialogResult.OK) { shot.Dispose(); ocrBusy = false; return; } }
            sel.Intersect(new Rectangle(0, 0, shot.Width, shot.Height));
            crop = shot.Clone(sel, shot.PixelFormat); shot.Dispose();
            if (crop.Width < 700)
            {   // small areas read better when enlarged
                int k = crop.Width < 300 ? 3 : 2; Bitmap big = new Bitmap(crop.Width * k, crop.Height * k);
                using (Graphics g = Graphics.FromImage(big)) { g.InterpolationMode = InterpolationMode.HighQualityBicubic; g.DrawImage(crop, 0, 0, big.Width, big.Height); }
                crop.Dispose(); crop = big;
            }
            Directory.CreateDirectory(Path.GetDirectoryName(png)); crop.Save(png, System.Drawing.Imaging.ImageFormat.Png);
        }
        catch { ocrBusy = false; SetThreadDpiAwarenessContext(old); if (crop != null) crop.Dispose(); return; }
        finally { SetThreadDpiAwarenessContext(old); }
        if (crop != null) crop.Dispose();
        ThreadPool.QueueUserWorkItem(delegate
        {
            string text = "";
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("powershell.exe", "-NoProfile -ExecutionPolicy Bypass -File \"" + Path.Combine(Root, "ocr.ps1") + "\" \"" + png + "\"");
                psi.UseShellExecute = false; psi.CreateNoWindow = true; psi.RedirectStandardOutput = true; psi.StandardOutputEncoding = Encoding.UTF8;
                using (Process p = Process.Start(psi)) { text = p.StandardOutput.ReadToEnd(); p.WaitForExit(20000); }
            }
            catch { }
            try { File.Delete(png); } catch { }
            text = text.Trim();
            BeginInvoke(new MethodInvoker(delegate
            {
                ocrBusy = false;
                if (text.Length == 0) { tray.ShowBalloonTip(4000, "No text found", "Try a slightly larger box with clearer text.", ToolTipIcon.Warning); return; }
                try { Clipboard.SetText(text); } catch { }
                ThreadPool.QueueUserWorkItem(delegate
                {
                    EnsureServer();
                    try { PostJson("/api/incoming", "{\"text\":" + JsonStr(text) + ",\"mode\":\"ocr\"}"); } catch { }
                    IntPtr w = FindAssistant();
                    if (w != IntPtr.Zero) BeginInvoke(new MethodInvoker(delegate { FocusWindow(w); }));
                    else LaunchEdge();
                });
            }));
        });
    }

    // ---------- tray icon ----------
    void BuildTray()
    {
        Bitmap bmp = new Bitmap(32, 32);
        using (Graphics g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (LinearGradientBrush b = new LinearGradientBrush(new Rectangle(0, 0, 32, 32), Color.FromArgb(124, 140, 255), Color.FromArgb(95, 212, 244), 45f))
                g.FillEllipse(b, 2, 2, 28, 28);
            // the logo in miniature: two mounds (an M) under a moon, clipped to the circle
            using (GraphicsPath clip = new GraphicsPath())
            {
                clip.AddEllipse(2, 2, 28, 28); g.SetClip(clip);
                g.FillEllipse(Brushes.White, 19.6f, 6.6f, 5.8f, 5.8f);
                using (GraphicsPath m = new GraphicsPath())
                {
                    m.AddBezier(new PointF(-1f, 28.5f), new PointF(4.5f, 13.5f), new PointF(11.5f, 13.5f), new PointF(16f, 23.5f));
                    m.AddBezier(new PointF(16f, 23.5f), new PointF(20.5f, 13.5f), new PointF(27.5f, 13.5f), new PointF(33f, 28.5f));
                    m.AddLine(33f, 28.5f, 33f, 33f); m.AddLine(33f, 33f, -1f, 33f); m.CloseFigure();
                    using (SolidBrush d = new SolidBrush(Color.FromArgb(235, 12, 15, 30))) g.FillPath(d, m);
                }
                g.ResetClip();
            }
        }
        ContextMenuStrip menu = new ContextMenuStrip();
        menu.Items.Add("Open MOUNDSHROUD  (Ctrl+Alt+A)", null, delegate { Toggle(); });
        menu.Items.Add("Quick note  (Ctrl+Alt+N)", null, delegate { QuickCapture(); });
        menu.Items.Add("Talk to MOUNDSHROUD  (Ctrl+Alt+V)", null, delegate { VoiceMode(); });
        menu.Items.Add("Emergency cards and contacts  (Ctrl+Alt+E)", null, delegate { OpenMode("emergency"); });
        ToolStripMenuItem auto = new ToolStripMenuItem("Start with Windows");
        auto.Checked = AutoStartOn();
        auto.Click += delegate { SetAutoStart(!AutoStartOn()); auto.Checked = AutoStartOn(); };
        menu.Items.Add(auto);
        menu.Items.Add("Quit", null, delegate { Shutdown(); });
        tray = new NotifyIcon();
        tray.Icon = Icon.FromHandle(bmp.GetHicon());
        try { string ip = System.IO.Path.Combine(Root, "web\\moundshroud.ico"); if (System.IO.File.Exists(ip)) tray.Icon = new Icon(ip, SystemInformation.SmallIconSize); } catch { }   // the royal emblem; the drawn mounds above are the fallback
        tray.Text = "MOUNDSHROUD - Ctrl+Alt+A";
        tray.ContextMenuStrip = menu;
        tray.Visible = true;
        tray.MouseClick += delegate(object s, MouseEventArgs e) { if (e.Button == MouseButtons.Left) Toggle(); };
    }
    static bool AutoStartOn() { using (RegistryKey k = Registry.CurrentUser.OpenSubKey(RUNKEY)) { return k != null && k.GetValue("OfflineAssistant") != null; } }
    static void SetAutoStart(bool on)
    {
        using (RegistryKey k = Registry.CurrentUser.OpenSubKey(RUNKEY, true))
        {
            if (on) k.SetValue("OfflineAssistant", "\"" + Application.ExecutablePath + "\"");
            else if (k.GetValue("OfflineAssistant") != null) k.DeleteValue("OfflineAssistant");
        }
    }
    void Shutdown()
    {
        try { PostJson("/api/shutdown", "{}"); } catch { }
        RemoveClipboardFormatListener(Handle); for (int i = 1; i <= 9; i++) UnregisterHotKey(Handle, i);
        tray.Visible = false; Application.Exit();
    }

    // ---------- window handling ----------
    static IntPtr FindAssistant()
    {
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate(IntPtr h, IntPtr l)
        {
            if (!IsWindowVisible(h)) return true;
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(h, sb, 256);
            if (sb.ToString() == "Offline Assistant") { found = h; return false; }
            return true;
        }, IntPtr.Zero);
        return found;
    }
    static void FocusWindow(IntPtr w) { if (IsIconic(w)) ShowWindow(w, 9); SetForegroundWindow(w); }
    void Toggle()
    {
        IntPtr w = FindAssistant();
        if (w == IntPtr.Zero) { ThreadPool.QueueUserWorkItem(delegate { EnsureServer(); LaunchEdge(); }); return; }
        if (w == GetForegroundWindow()) PostMessage(w, 0x0010, IntPtr.Zero, IntPtr.Zero);   // already in front -> close it (the hotkey is a toggle)
        else FocusWindow(w);
    }
    static string FirstExisting(params string[] paths) { foreach (string p in paths) if (File.Exists(p)) return p; return null; }
    static void LaunchEdge()
    {
        string edge = FirstExisting(@"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", @"C:\Program Files\Microsoft\Edge\Application\msedge.exe");
        if (edge == null) return;
        Rectangle wa = Screen.PrimaryScreen.WorkingArea;
        int w = Math.Min(720, wa.Width - 40), h = Math.Min(800, wa.Height - 40), x = Math.Max(0, wa.Right - w - 24), y = Math.Max(0, wa.Bottom - h - 24);
        string args = "--app=" + URL + " --user-data-dir=\"" + Root + "\\edge-profile\" --window-size=" + w + "," + h + " --window-position=" + x + "," + y +
                      " --no-first-run --no-default-browser-check --disable-background-mode " +
                      // privacy: no usage statistics, crash uploads, background fetches, pings, casting scans or cloud features (lib/privacy.js has the same list)
                      "--disable-background-networking --disable-component-update --disable-domain-reliability --no-pings --disable-breakpad --no-report-upload --metrics-recording-only --disable-default-apps --disable-features=Translate,MediaRouter,DialMediaRouteProvider,OptimizationHints,AutofillServerCommunication,msEdgeShoppingUI,msUndersideButton,msShowCopilotButtonInToolbar,msEdgeEnhanceImages,msSpeechRecognitionOnline";
        Process.Start(new ProcessStartInfo(edge, args) { UseShellExecute = false });
    }
    void Watch(object s, EventArgs e)
    {
        IntPtr w = FindAssistant();
        if (w != IntPtr.Zero)
        {
            seen = true;
            if (++watchTick % 5 == 0 && !ensuring) { ensuring = true; ThreadPool.QueueUserWorkItem(delegate { try { EnsureServer(); } catch { } ensuring = false; }); }   // the window is open but the server stopped (long sleep?): bring it back
        }
        else if (seen)
        {   // the window was closed -> shut the server (and the Ollama it started) down
            seen = false;
            ThreadPool.QueueUserWorkItem(delegate { try { PostJson("/api/shutdown", "{}"); } catch { } });
        }
    }

    // ---------- server ----------
    static bool ServerUp()
    {
        try
        {
            HttpWebRequest r = (HttpWebRequest)WebRequest.Create(URL + "/api/status");
            r.Timeout = 900; r.Proxy = null;
            using (HttpWebResponse res = (HttpWebResponse)r.GetResponse()) { return res.StatusCode == HttpStatusCode.OK; }
        }
        catch { return false; }
    }
    static void EnsureServer()
    {
        if (ServerUp()) return;
        string node = FirstExisting(@"C:\Program Files\nodejs\node.exe", @"C:\Program Files (x86)\nodejs\node.exe");
        if (node == null) node = "node";
        ProcessStartInfo psi = new ProcessStartInfo(node, "\"" + Root + "\\server.js\"");
        psi.WorkingDirectory = Root; psi.UseShellExecute = false; psi.CreateNoWindow = true; psi.WindowStyle = ProcessWindowStyle.Hidden;
        Process.Start(psi);
        for (int i = 0; i < 40; i++) { if (ServerUp()) return; Thread.Sleep(250); }
    }
    static void PostJson(string path, string json)
    {
        HttpWebRequest r = (HttpWebRequest)WebRequest.Create(URL + path);
        r.Method = "POST"; r.ContentType = "application/json"; r.Timeout = 3000; r.Proxy = null;
        byte[] b = Encoding.UTF8.GetBytes(json); r.ContentLength = b.Length;
        using (Stream s = r.GetRequestStream()) s.Write(b, 0, b.Length);
        using (r.GetResponse()) { }
    }
    static string JsonStr(string s)
    {
        StringBuilder sb = new StringBuilder("\"");
        foreach (char c in s)
        {
            if (c == '"') sb.Append("\\\""); else if (c == '\\') sb.Append("\\\\");
            else if (c == '\n') sb.Append("\\n"); else if (c == '\r') sb.Append("\\r"); else if (c == '\t') sb.Append("\\t");
            else if (c < ' ') sb.Append("\\u" + ((int)c).ToString("x4")); else sb.Append(c);
        }
        return sb.Append('"').ToString();
    }

    // ---------- selected text ----------
    void Selection(string mode)
    {
        for (int i = 0; i < 40; i++)
        {   // wait until the hotkey keys are released so Ctrl+C is a clean copy
            if (GetAsyncKeyState(0x11) < 0 || GetAsyncKeyState(0x12) < 0 || GetAsyncKeyState(0x51) < 0 || GetAsyncKeyState(0x57) < 0 || GetAsyncKeyState(0x44) < 0) Thread.Sleep(50); else break;
        }
        string old = null; try { if (Clipboard.ContainsText()) old = Clipboard.GetText(); } catch { }
        try { Clipboard.Clear(); } catch { }
        Thread.Sleep(120);
        try { SendKeys.SendWait("^c"); } catch { }
        Thread.Sleep(350);
        string txt = null; try { if (Clipboard.ContainsText()) txt = Clipboard.GetText(); } catch { }
        if (String.IsNullOrWhiteSpace(txt)) txt = old;
        else if (old != null && old != txt) { try { Clipboard.SetText(old); } catch { } }      // put the user's previous clipboard back
        string t = txt;
        ThreadPool.QueueUserWorkItem(delegate
        {
            EnsureServer();
            if (!String.IsNullOrWhiteSpace(t)) { try { PostJson("/api/incoming", "{\"text\":" + JsonStr(t) + (mode.Length > 0 ? ",\"mode\":\"" + mode + "\"" : "") + "}"); } catch { } }
            IntPtr w = FindAssistant();
            if (w != IntPtr.Zero) BeginInvoke(new MethodInvoker(delegate { FocusWindow(w); }));
            else LaunchEdge();
        });
    }
}


