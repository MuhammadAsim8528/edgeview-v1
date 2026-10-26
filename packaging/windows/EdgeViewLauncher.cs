// Windows launcher only; the product backend remains Node/Express.
// Compile at build time with the Windows .NET Framework compiler. Customers
// must not need a compiler, npm, Git, or a global Node installation.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed class RuntimeOwner {
    private Process child;
    private readonly string root = AppDomain.CurrentDomain.BaseDirectory;
    private readonly JavaScriptSerializer json = new JavaScriptSerializer();
    internal int Port { get; private set; }
    internal int Pid { get { return child.Id; } }
    internal string BuildId { get; private set; }
    internal bool Start() {
        int port;
        string configured = Environment.GetEnvironmentVariable("PORT");
        if (String.IsNullOrEmpty(configured)) port = 3901;
        else if (!Int32.TryParse(configured, out port) || port < 1 || port > 65535) return false;
        Port = port;
        string metadataPath = Path.Combine(root, "dist", "build-info.json");
        if (!File.Exists(metadataPath) || new FileInfo(metadataPath).Length > 16384) return false;
        var metadata = json.Deserialize<Dictionary<string, object>>(File.ReadAllText(metadataPath));
        BuildId = Convert.ToString(metadata["buildId"]);
        if (BuildId.Length != 64) return false;
        var start = new ProcessStartInfo(Path.Combine(root, "runtime", "node.exe"));
        start.Arguments = "\"" + Path.Combine(root, "runtime-bootstrap.cjs") + "\"";
        start.WorkingDirectory = root;
        start.UseShellExecute = false; start.CreateNoWindow = true;
        start.RedirectStandardInput = true; start.RedirectStandardOutput = true; start.RedirectStandardError = true;
        start.EnvironmentVariables.Clear();
        foreach (string key in new [] { "SystemRoot", "WINDIR", "COMSPEC", "USERPROFILE", "TEMP", "TMP", "APPDATA", "LOCALAPPDATA" }) {
            string value = Environment.GetEnvironmentVariable(key);
            if (!String.IsNullOrEmpty(value)) start.EnvironmentVariables[key] = value;
        }
        string windows = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
        start.EnvironmentVariables["PATH"] = Path.Combine(windows, "System32") + ";" + Path.Combine(windows, "System32", "WindowsPowerShell", "v1.0");
        start.EnvironmentVariables["NODE_ENV"] = "production";
        start.EnvironmentVariables["PORT"] = Port.ToString();
        // Prototype storage namespace only. The Node runtime remains the single
        // authority validating the chosen data path and its ancestors.
        string data = Environment.GetEnvironmentVariable("EDGEVIEW_DATA_DIR");
        start.EnvironmentVariables["EDGEVIEW_DATA_DIR"] = String.IsNullOrEmpty(data)
            ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EdgeViewPrototype", "state") : data;
        start.EnvironmentVariables["EDGEVIEW_MONITORING_ENABLED"] = "0";
        child = new Process(); child.StartInfo = start;
        // Drain without retaining or displaying raw backend paths/errors/data.
        child.OutputDataReceived += delegate { }; child.ErrorDataReceived += delegate { };
        child.Start(); child.BeginOutputReadLine(); child.BeginErrorReadLine();
        DateTime deadline = DateTime.UtcNow.AddSeconds(45);
        while (DateTime.UtcNow < deadline && !child.HasExited) {
            try {
                var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + Port + "/api/health");
                request.Proxy = null; request.AllowAutoRedirect = false; request.Timeout = 1000; request.ReadWriteTimeout = 1000;
                using (var response = request.GetResponse())
                using (var reader = new StreamReader(response.GetResponseStream())) {
                    var text = new System.Text.StringBuilder(); var buffer = new char[2048]; int count;
                    while ((count = reader.Read(buffer, 0, buffer.Length)) > 0) {
                        if (text.Length + count > 32768) throw new InvalidDataException();
                        text.Append(buffer, 0, count);
                    }
                    var health = json.Deserialize<Dictionary<string, object>>(text.ToString());
                    var app = (Dictionary<string, object>)health["app"];
                    var build = (Dictionary<string, object>)app["build"];
                    if (Convert.ToInt32(app["pid"]) == child.Id && Convert.ToString(build["buildId"]) == BuildId) return true;
                }
            } catch { /* bounded readiness retry; never attach another listener */ }
            Thread.Sleep(100);
        }
        return false;
    }
    internal int Stop() {
        if (child == null) return 0;
        try {
            if (!child.HasExited) {
                try { child.StandardInput.WriteLine("shutdown"); child.StandardInput.Flush(); child.StandardInput.Close(); } catch (IOException) { }
                if (!child.WaitForExit(20000)) return -1;
            }
            return child.ExitCode;
        } catch (InvalidOperationException) { return 1; }
    }
    internal void OpenBrowser() {
        Process.Start(new ProcessStartInfo("http://127.0.0.1:" + Port + "/") { UseShellExecute = true });
    }
}

internal sealed class LauncherWindow : Form {
    private readonly RuntimeOwner owner = new RuntimeOwner();
    private readonly Label status = new Label();
    private readonly Button open = new Button();
    private readonly Button close = new Button();
    private bool starting = true, stopping, allowClose;
    internal LauncherWindow() {
        Text = "EdgeView — internal launcher candidate"; Width = 430; Height = 190;
        FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; StartPosition = FormStartPosition.CenterScreen;
        status.Text = "Starting EdgeView…"; status.SetBounds(20, 20, 375, 45);
        open.Text = "Open EdgeView"; open.SetBounds(20, 85, 160, 35); open.Enabled = false;
        close.Text = "Close EdgeView"; close.SetBounds(220, 85, 160, 35);
        Controls.Add(status); Controls.Add(open); Controls.Add(close);
        open.Click += delegate { try { owner.OpenBrowser(); } catch { status.Text = "Could not open your browser. Try Open EdgeView again."; } };
        close.Click += delegate { Close(); };
        Shown += async delegate {
            bool ready = false; try { ready = await Task.Run(() => owner.Start()); } catch { }
            starting = false; open.Enabled = ready;
            status.Text = ready ? "EdgeView is running. Use this window to close it safely." : "EdgeView could not start. Close another running instance and try again, or contact the owner.";
            if (ready) { try { owner.OpenBrowser(); } catch { status.Text = "EdgeView is ready. Select Open EdgeView to try your browser again."; } }
        };
        FormClosing += async delegate(object sender, FormClosingEventArgs e) {
            if (allowClose) return; e.Cancel = true;
            if (starting) { status.Text = "Please wait for startup to finish, then close EdgeView."; return; }
            if (stopping) return;
            stopping = true; open.Enabled = false; close.Enabled = false; status.Text = "Saving and closing EdgeView…";
            int code = await Task.Run(() => owner.Stop());
            stopping = false;
            if (code == -1) { status.Text = "EdgeView is still closing. Retry Close, or contact the owner. Do not restart it yet."; close.Enabled = true; return; }
            if (code != 0) MessageBox.Show("EdgeView closed with a recovery warning. Some recent changes may not have been saved. Please contact the owner.", "EdgeView", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            allowClose = true; Close();
        };
    }
}

internal static class Program {
    [STAThread]
    private static int Main(string[] args) {
        if (args.Length == 1 && args[0] == "--verify-runtime") {
            var owner = new RuntimeOwner();
            try {
                if (!owner.Start()) { owner.Stop(); Console.WriteLine("LAUNCH_FAILED"); return 1; }
                Console.WriteLine("READY " + owner.Pid); Console.Out.Flush();
                Console.ReadLine();
                return owner.Stop();
            } catch { owner.Stop(); Console.WriteLine("LAUNCH_FAILED"); return 1; }
        }
        if (args.Length != 0) return 2;
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new LauncherWindow()); return 0;
    }
}
