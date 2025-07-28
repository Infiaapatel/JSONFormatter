namespace JSONFormatter.Server.Service
{
    public interface IEncryptionService
    {
        
            Task<string> EncryptForWebAsync(string plainText);
            Task<string> DecryptForWebAsync(string encryptedText);

            Task<string> EncryptForBackendAsync(string plainText);
            Task<string> DecryptForBackendAsync(string encryptedText);

            Task<string> EncryptForAnalyticsAsync(string plainText);
            Task<string> DecryptForAnalyticsAsync(string encryptedText);
        
    }
}