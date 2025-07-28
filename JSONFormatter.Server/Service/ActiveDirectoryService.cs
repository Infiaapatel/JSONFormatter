using System.DirectoryServices.AccountManagement;
using Microsoft.Extensions.Configuration;

namespace JSONFormatter.Server.Service
{
    public class ActiveDirectoryService
    {
        private readonly string _domain;
        private readonly string _adUsername;
        private readonly string _adPassword;

        public ActiveDirectoryService(IConfiguration configuration)
        {
            _domain = configuration["ActiveDirectory:domain"];
            _adUsername = configuration["ActiveDirectory:harwareUserName"];
            _adPassword = configuration["ActiveDirectory:userCredential"];
        }

        public bool ValidateCredentials(string username, string password)
        {
            try
            {
                using (var context = new PrincipalContext(ContextType.Domain, _domain, _adUsername, _adPassword))
                {
                    bool isValid = context.ValidateCredentials(username, password);
                    if (isValid)
                    {
                        return true;
                    }
                    else
                    {
                        return false;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"AD Authentication failed: {ex.Message}");
                return false;
            }
        }
    }

}
