using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
namespace ParrotnestServer
{
    public static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            using var mutex = new Mutex(true, "ParrotnestServerApp", out bool createdNew);
            if (!createdNew) return;
            if (args.Contains("--server") || args.Contains("--nogui"))
            {
                RunHeadlessServer().GetAwaiter().GetResult();
                return;
            }
            ApplicationConfiguration.Initialize();
            Application.Run(new ServerControlForm());
        }
        static async Task RunHeadlessServer()
        {
            var host = new ServerHost(msg => Console.WriteLine(msg));
            try
            {
                await host.StartAsync();
                Console.WriteLine("Serwer uruchomiony (tryb bez GUI). Naciśnij Ctrl+C aby zakończyć.");
                await Task.Delay(-1);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Błąd uruchamiania: {ex.Message}");
            }
        }
    }
}
