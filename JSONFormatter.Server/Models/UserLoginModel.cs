namespace JSONFormatter.Server.Models
{
    public class UserLoginModel
    {
        public string? UserName { get; set; }
        public string? Password { get; set; }
    }

    public static class Shared
    {
        public static string connectionString { get; set; }
    }

    public class AppSettings
    {
        public int? IsEncryptedWeb { get; set; }
        public string? IsWindowAuthentication { get; set; }
        public string? DataSource { get; set; }
        public string? InitialCatalog { get; set; }
        public string? UserName { get; set; }
        public string? Credential { get; set; }
        public string? Storage { get; set; }
    }

}
