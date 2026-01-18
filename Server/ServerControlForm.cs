using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using System.Threading.Tasks;
namespace ParrotnestServer
{
    public class ServerControlForm : Form
    {
        private Button btnStart;
        private Button btnStop;
        private Button btnCleanDB;
        private Button btnOpenBrowser;
        private RichTextBox txtLog;
        private ServerHost _serverHost;
        private bool _isRunning = false;
        public ServerControlForm()
        {
            InitializeComponent();
            _serverHost = new ServerHost(Log);
            this.Shown += async (s, e) => await StartServer();
        }
        private void InitializeComponent()
        {
            this.Text = "Parrotnest Server Manager";
            this.Size = new Size(800, 600);
            this.BackColor = Color.FromArgb(30, 30, 30);
            this.ForeColor = Color.White;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            Label lblTitle = new Label();
            lblTitle.Text = "Parrotnest Server";
            lblTitle.Font = new Font("Segoe UI", 24, FontStyle.Bold);
            lblTitle.Location = new Point(20, 20);
            lblTitle.AutoSize = true;
            lblTitle.ForeColor = Color.FromArgb(76, 175, 80);
            this.Controls.Add(lblTitle);
            Panel pnlButtons = new Panel();
            pnlButtons.Location = new Point(20, 80);
            pnlButtons.Size = new Size(740, 60);
            this.Controls.Add(pnlButtons);
            btnStart = CreateButton("Uruchom Serwer", 0, Color.FromArgb(76, 175, 80));
            btnStart.Click += async (s, e) => await StartServer();
            pnlButtons.Controls.Add(btnStart);
            btnStop = CreateButton("Zatrzymaj", 160, Color.FromArgb(244, 67, 54));
            btnStop.Click += async (s, e) => await StopServer();
            btnStop.Enabled = false;
            pnlButtons.Controls.Add(btnStop);
            btnCleanDB = CreateButton("Wyczyść Bazę", 320, Color.FromArgb(255, 152, 0));
            btnCleanDB.Click += BtnCleanDB_Click;
            pnlButtons.Controls.Add(btnCleanDB);
            btnOpenBrowser = CreateButton("Otwórz App", 480, Color.FromArgb(33, 150, 243));
            btnOpenBrowser.Click += (s, e) => System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("http://localhost:6069/login.php") { UseShellExecute = true });
            pnlButtons.Controls.Add(btnOpenBrowser);
            txtLog = new RichTextBox();
            txtLog.Location = new Point(20, 160);
            txtLog.Size = new Size(740, 380);
            txtLog.BackColor = Color.FromArgb(40, 40, 40);
            txtLog.ForeColor = Color.FromArgb(200, 200, 200);
            txtLog.Font = new Font("Consolas", 10);
            txtLog.ReadOnly = true;
            txtLog.BorderStyle = BorderStyle.None;
            this.Controls.Add(txtLog);
        }
        private Button CreateButton(string text, int x, Color backColor)
        {
            Button btn = new Button();
            btn.Text = text;
            btn.Location = new Point(x, 0);
            btn.Size = new Size(140, 40);
            btn.FlatStyle = FlatStyle.Flat;
            btn.BackColor = backColor;
            btn.ForeColor = Color.White;
            btn.Font = new Font("Segoe UI", 10, FontStyle.Bold);
            btn.Cursor = Cursors.Hand;
            btn.FlatAppearance.BorderSize = 0;
            return btn;
        }
        private void Log(string message)
        {
            if (txtLog.InvokeRequired)
            {
                txtLog.Invoke(new Action<string>(Log), message);
                return;
            }
            txtLog.AppendText(message + Environment.NewLine);
            txtLog.ScrollToCaret();
        }
        private async Task StartServer()
        {
            if (_isRunning) return;
            btnStart.Enabled = false;
            btnCleanDB.Enabled = false;
            try
            {
                await _serverHost.StartAsync();
                _isRunning = true;
                btnStop.Enabled = true;
            }
            catch (Exception ex)
            {
                Log($"BĹ‚Ä…d uruchamiania: {ex.Message}");
                btnStart.Enabled = true;
                btnCleanDB.Enabled = true;
            }
        }
        private async Task StopServer()
        {
            if (!_isRunning) return;
            btnStop.Enabled = false;
            try
            {
                await _serverHost.StopAsync();
                _isRunning = false;
                btnStart.Enabled = true;
                btnCleanDB.Enabled = true;
            }
            catch (Exception ex)
            {
                Log($"BĹ‚Ä…d zatrzymywania: {ex.Message}");
            }
        }
        private void BtnCleanDB_Click(object? sender, EventArgs e)
        {
            if (_isRunning)
            {
                MessageBox.Show("Zatrzymaj serwer przed czyszczeniem bazy!", "OstrzeĹĽenie", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            if (MessageBox.Show("Czy na pewno chcesz usunÄ…Ä‡ caĹ‚Ä… bazÄ™ danych? Ta operacja jest nieodwracalna.", "Potwierdzenie", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes)
            {
                try
                {
                    string dbPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "parrotnest.db");
                    string shmPath = dbPath + "-shm";
                    string walPath = dbPath + "-wal";
                    bool deleted = false;
                    if (File.Exists(dbPath))
                    {
                        File.Delete(dbPath);
                        deleted = true;
                    }
                    if (File.Exists(shmPath)) File.Delete(shmPath);
                    if (File.Exists(walPath)) File.Delete(walPath);
                    if (deleted)
                    {
                        Log("Baza danych zostaĹ‚a usuniÄ™ta.");
                    }
                    else
                    {
                        Log("Plik bazy danych nie istnieje.");
                    }
                }
                catch (Exception ex)
                {
                    Log($"BĹ‚Ä…d usuwania bazy: {ex.Message}");
                }
            }
        }
        protected override async void OnFormClosing(FormClosingEventArgs e)
        {
            if (_isRunning)
            {
                e.Cancel = true;
                await StopServer();
                e.Cancel = false;
                this.Close();
            }
            base.OnFormClosing(e);
        }
    }
}
