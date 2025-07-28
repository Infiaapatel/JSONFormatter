using System.Text;

namespace JSONFormatter.Server.Service
{
    public class ConnectionStringBuilder
    {
        private readonly IConfiguration _configuration;

        public ConnectionStringBuilder(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public string GetConnectionString()
        {
            var dbSettings = _configuration.GetSection("DatabaseSettings");

            // Get database connection properties
            string server = dbSettings["Server"];
            string database = dbSettings["Database"];

            // Check if Windows Authentication is being used
            bool isWindowsAuth = false;
            if (!string.IsNullOrEmpty(dbSettings["IsWindowAuthentication"]))
            {
                isWindowsAuth = bool.Parse(dbSettings["IsWindowAuthentication"]);
            }

            // Build the connection string
            StringBuilder connectionString = new StringBuilder();
            connectionString.Append($"Server={server};");
            connectionString.Append($"Database={database};");

            if (isWindowsAuth)
            {
                // Use Windows Authentication
                connectionString.Append("Trusted_Connection=True;");
            }
            else
            {
                // Use SQL Server Authentication
                string username = dbSettings["UserId"];
                string password = dbSettings["Password"];
                connectionString.Append($"User Id={username};Password={password};");
            }

            // Always add TrustServerCertificate for convenience in development
            connectionString.Append("TrustServerCertificate=True;");

            return connectionString.ToString();
        }
    }
}