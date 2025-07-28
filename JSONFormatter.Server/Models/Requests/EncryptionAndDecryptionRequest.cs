namespace JSONFormatter.Server.Models.Requests
{
    public class EncryptionAndDecryptionRequest
    {
        public string PlainText { get; set; }
        public string Target { get; set; } // New property
    }
}
