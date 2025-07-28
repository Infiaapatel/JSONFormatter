using JSONFormatter.Server.Models;

namespace JSONFormatter.Server.Helper
{
    public class WebApiConfig
    {
        public static int IsEncryptedWeb { get; set; }
        //public static string MasterConnectionString { get; set; }
        //public static string StorageLocation { get; set; }

        public bool SetConfig(AppSettings appSettings)
        {
            try
            {
                IsEncryptedWeb = Convert.ToInt32(appSettings.IsEncryptedWeb);
            }
            catch (Exception)
            {
                IsEncryptedWeb = 3;
            }

            bool isWindowAuthentication = false;
            try
            {
                if (appSettings.IsWindowAuthentication?.ToLower() == "true")
                {
                    isWindowAuthentication = true;
                }
            }
            catch (Exception)
            {
            }
            return true;
        }

    }
}