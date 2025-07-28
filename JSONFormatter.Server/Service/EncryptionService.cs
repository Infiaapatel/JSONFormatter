using Infinnium.Log.Business;

namespace JSONFormatter.Server.Service
{
    public class EncryptionService : IEncryptionService
    {
            private readonly ILogger<EncryptionService> _logger;
        private readonly Initializer _initializer; // Reference to the external DLL class

        public EncryptionService(ILogger<EncryptionService> logger)
        {
            _logger = logger;
            // Initialize the external DLL
            try
            {
                _initializer = new Initializer(); // Check for DLL dependencies
            }
            catch (Exception ex)
            {
                _logger.LogCritical(ex, "Failed to initialize external DLL");
                throw; // Rethrow to prevent service from starting
            }
        }

        public async Task<string> EncryptForWebAsync(string plainText)
        {
            try
            {
                _logger.LogInformation("Encrypting data for Web role");
                return await Task.FromResult(_initializer.GetInitializerForWeb(plainText, "VALID_KEY"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "EncryptForWebAsync failed");
                throw; // Ensure the controller catches this
            }
        }

        public async Task<string> DecryptForWebAsync(string encryptedText)
        {
            _logger.LogInformation("Decrypting data for Web role");
            // Call the appropriate method from the external DLL for Web role
            return await Task.FromResult(_initializer.GetDeInitializerForWeb(encryptedText, ""));
        }

        public async Task<string> EncryptForBackendAsync(string plainText)
        {
            _logger.LogInformation("Encrypting data for Backend role");
            // Call the appropriate method from the external DLL for Backend role
            return await Task.FromResult(_initializer.GetInitializer(plainText, ""));
        }

        public async Task<string> DecryptForBackendAsync(string encryptedText)
        {
            _logger.LogInformation("Decrypting data for Backend role");
            // Call the appropriate method from the external DLL for Backend role
            return await Task.FromResult(_initializer.GetDeInitializer(encryptedText, ""));
        }

        public async Task<string> EncryptForAnalyticsAsync(string plainText)
        {
            _logger.LogInformation("Encrypting data for Analytics role");
            // Call the appropriate method from the external DLL for Analytics role
            return await Task.FromResult(_initializer.GetInitializerForAnalytics(plainText, ""));
        }

        public async Task<string> DecryptForAnalyticsAsync(string encryptedText)
        {
            _logger.LogInformation("Decrypting data for Analytics role");
            // Call the appropriate method from the external DLL for Analytics role
            return await Task.FromResult(_initializer.GetDeInitializerForAnalytics(encryptedText, ""));
        }
    }
}
