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
            if (args.Contains("--server") || args.Contains("--nogui"))
            {
                RunHeadlessServer(args).GetAwaiter().GetResult();
                return;
            }
            using var mutex = new Mutex(true, "ParrotnestServerApp", out bool createdNew);
            if (!createdNew) return;
            ApplicationConfiguration.Initialize();
            Application.Run(new ServerControlForm());
        }
        static async Task RunHeadlessServer(string[] args)
        {
            var asciiEnv = Environment.GetEnvironmentVariable("PARROTNEST_ASCII_BANNER");
            var showBanner = asciiEnv == "1" || args.Contains("--ascii-banner");
            if (showBanner)
            {
                Console.WriteLine("  _____                     _                   _   ");
                Console.WriteLine(" |  __ \\                   | |                 | |  ");
                Console.WriteLine(" | |__) |_ _ _ __ _ __ ___ | |_ _ __   ___  ___| |_ ");
                Console.WriteLine(" |  ___/ _` | '__| '__/ _ \\| __| '_ \\ / _ \\/ __| __| ");
                Console.WriteLine(" | |  | (_| | |  | | | (_) | |_| | | |  __/\\__ \\ |_ ");
                Console.WriteLine(" |_|   \\__,_|_|  |_|  \\___/ \\__|_| |_|\\___||___/\\__| ");
                Console.WriteLine("                                                     ");
            }
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
