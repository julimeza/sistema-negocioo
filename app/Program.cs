using Microsoft.Web.WebView2.WinForms;
using System;
using System.Windows.Forms;

namespace SistemaNegocioApp
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            ApplicationConfiguration.Initialize();

            Form ventana = new Form();
            ventana.Text = "Sistema Negocio";
            ventana.Width = 1200;
            ventana.Height = 800;

            WebView2 web = new WebView2()
            {
                Dock = DockStyle.Fill
            };

            ventana.Controls.Add(web);

            ventana.Shown += async (s, e) =>
            {
                await web.EnsureCoreWebView2Async();

                // Reintentar hasta que el servidor esté arriba
                bool cargado = false;
                int reintentos = 0;

                while (!cargado && reintentos < 20)
                {
                    try
                    {
                        web.CoreWebView2.Navigate("http://localhost:3000");
                        cargado = true;
                    }
                    catch
                    {
                        reintentos++;
                        await Task.Delay(300);
                    }
                }
            };

            Application.Run(ventana);
        }
    }
}
