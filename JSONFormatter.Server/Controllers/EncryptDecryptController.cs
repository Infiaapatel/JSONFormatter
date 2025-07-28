using JSONFormatter.Server.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using JSONFormatter.Server.Models.Requests;
using JSONFormatter.Server.Models;

namespace JSONFormatter.Server.Controllers
{
    [ApiController]
    [Route("api/EncryptDecryptController")]
    [Authorize]
    public class EncryptDecryptController : ControllerBase
    {
        private readonly ILogger<EncryptDecryptController> _logger;
        private readonly IEncryptionService _encryptionService;

        public EncryptDecryptController(ILogger<EncryptDecryptController> logger,
            IEncryptionService encryptionService) // Inject service that wraps the DLL functionality
        {
            _logger = logger;
            _encryptionService = encryptionService;
        }

        //api/encryptAndDecrypt/encrypt
        [HttpPost("encrypt")]
        public async Task<IActionResult> Encrypt([FromBody] EncryptionAndDecryptionRequest request)
        {
            _logger.LogInformation("Encrypt API called with target: {Target}", request.Target);
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
                var responseDetail = new ResponseDetails
                {
                    isSuccess = true,
                    Data = new
                    {
                        EncryptedText = encryptedResult
                    }
                };
                return Ok(responseDetail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during encryption process for target: {Target}", request.Target);
                var ErrorMessage = "An error occurred during encryption.";
                var responseDetail = new ResponseDetails
                {
                    isSuccess = false,
                    Data = new
                    {
                        EncryptedText = ErrorMessage
                    }
                };
                return Ok(responseDetail);
            }
        }

        [HttpPost("decrypt")]
        public async Task<IActionResult> Decrypt([FromBody] EncryptionAndDecryptionRequest request)
        {
            _logger.LogInformation("Decrypt API called with target: {Target}", request.Target);
            try
            {                
                string decryptedResult = request.Target switch
                {
                    "1" => await _encryptionService.DecryptForWebAsync(request.PlainText),
                    "2" => await _encryptionService.DecryptForBackendAsync(request.PlainText),
                    "3" => await _encryptionService.DecryptForAnalyticsAsync(request.PlainText),
                    _ => throw new ArgumentException("Invalid target specified")
                };
                var responseDetail = new ResponseDetails
                {
                    isSuccess = true,
                    Data = new
                    {
                        DecryptedText = decryptedResult
                    }
                };
                return Ok(responseDetail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during decryption process for target: {Target}", request.Target);
                var ErrorMessage = "An error occurred during decryption.";
                var responseDetail = new ResponseDetails
                {
                    isSuccess = false,
                    Data = new
                    {
                        DecryptedText = ErrorMessage
                    }
                };
                return Ok(responseDetail);
            }
        }
    }
}
