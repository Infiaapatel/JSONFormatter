using JSONFormatter.Server.Filters;
using JSONFormatter.Server.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;


namespace JSONFormatter.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [ServiceFilter(typeof(EncryptDecryptFilter))]
    [Authorize]
    public class encryptAndDecrypt : ControllerBase
    {
        private readonly ILogger<encryptAndDecrypt> _logger;
        private readonly IEncryptionService _encryptionService;

        public encryptAndDecrypt(ILogger<encryptAndDecrypt> logger,
            IEncryptionService encryptionService) // Inject service that wraps the DLL functionality)
        {
            _logger = logger;
            _encryptionService = encryptionService;

        }

        //api/encryptAndDecrypt/encrypt
        [HttpPost("encrypt")]
        public async Task<IActionResult> Encrypt([FromBody] EncryptionRequest request)
        {
            try
            {
                var normalizedtarget = request.Target?.Trim().ToLower();
                string encryptedResult = request.Target switch
                {
                    "1" => await _encryptionService.EncryptForWebAsync(request.PlainText),
                    "2" => await _encryptionService.EncryptForBackendAsync(request.PlainText),
                    "3" => await _encryptionService.EncryptForAnalyticsAsync(request.PlainText),
                    _ => throw new ArgumentException("Invalid target specified")
                };

                return Ok(new EncryptionResponse { EncryptedText = encryptedResult, Success = true }); ;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during encryption process");
                return StatusCode(500, new EncryptionResponse
                {
                    Success = false,
                    ErrorMessage = "An error occurred during encryption."
                });
            }
        }

        [HttpPost("decrypt")]
        public async Task<IActionResult> Decrypt([FromBody] DecryptionRequest request)
        {
            try
            {
                // Remove role checks and use request.Target
                string decryptedResult = request.Target switch
                {
                    "1" => await _encryptionService.DecryptForWebAsync(request.EncryptedText),
                    "2" => await _encryptionService.DecryptForBackendAsync(request.EncryptedText),
                    "3" => await _encryptionService.DecryptForAnalyticsAsync(request.EncryptedText),
                    _ => throw new ArgumentException("Invalid target specified")
                };

                return Ok(new DecryptionResponse { PlainText = decryptedResult, Success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during decryption process");
                return StatusCode(500, new DecryptionResponse
                {
                    Success = false,
                    ErrorMessage = "An error occurred during decryption."
                });
            }
        }
    }


    // Request and response models
    public class EncryptionRequest
    {
        public string PlainText { get; set; }
        public string Target { get; set; } // New property
    }

    public class EncryptionResponse
    {
        public string EncryptedText { get; set; }
        public bool Success { get; set; }
        public string ErrorMessage { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class DecryptionRequest
    {
        public string EncryptedText { get; set; }
        public string Target { get; set; } // New property
    }

    public class DecryptionResponse
    {
        public string PlainText { get; set; }
        public bool Success { get; set; }
        public string ErrorMessage { get; set; }
        public DateTime Timestamp { get; set; }
    }


}


namespace JSONFormatter.API.Services
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