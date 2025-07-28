using JSONFormatter.Server.Models;
using JSONFormatter.Server.Service;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace JSONFormatter.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly string _connectionString;
        private readonly ActiveDirectoryService _activeDirectoryService;

        public UserController(IConfiguration configuration, ConnectionStringBuilder connectionStringBuilder, ActiveDirectoryService activeDirectoryService)
        {
            _config = configuration;
            _connectionString = connectionStringBuilder.GetConnectionString();
            _activeDirectoryService = activeDirectoryService;
        }


        [HttpPost("Authenticate")]
        public ResponseDetails Authenticate(UserLoginModel credentials)
        {
            User? user = null;

            // 1. Basic validation for input credentials.
            if (string.IsNullOrEmpty(credentials.UserName) || string.IsNullOrEmpty(credentials.Password))
            {
                return new ResponseDetails
                {
                    isSuccess = false,
                    Data = new { message = "Username and password are required." }
                };
            }

            // 2. Retrieve user details from the database based on the username.
            try
            {
                using (SqlConnection con = new SqlConnection(_connectionString))
                {
                    using (SqlCommand cmd = new SqlCommand("[dbo].[UserMater_CRUD]", con))
                    {
                        cmd.CommandType = CommandType.StoredProcedure;
                        cmd.Parameters.AddWithValue("@userName", credentials.UserName);
                        cmd.Parameters.AddWithValue("@loginFlag", 1);

                        con.Open();
                        using (SqlDataReader reader = cmd.ExecuteReader())
                        {
                            if (reader.Read())
                            {
                                user = new User
                                {
                                    UserID = Convert.ToInt32(reader["userId"]),
                                    UserName = reader["userName"].ToString(),
                                    Password = reader["userPassword"] as byte[],
                                    FullName = reader["fullName"].ToString(),
                                    Email = reader["email"].ToString(),
                                    IsActive = reader["isActive"] as bool?,
                                    UserAuthType = reader["userAuthType"] as int?
                                };
                            }
                        }
                    }
                }
            }
            catch (SqlException ex)
            {
                // Log the exception details (e.g., using a logging framework like Serilog or NLog)
                Console.WriteLine($"Database error: {ex.Message}");
                return new ResponseDetails { isSuccess = false, Data = new { message = "A database error occurred. Please try again later." } };
            }

            // 3. If no user is found with the given username, return a specific error.
            if (user == null)
            {
                return new ResponseDetails
                {
                    isSuccess = false,
                    Data = new { message = $"Invalid UserName, Please Try Again" }
                };
            }

            // Check if the user account is active
            if (user.IsActive == false)
            {
                return new ResponseDetails
                {
                    isSuccess = false,
                    Data = new { message = "This user account is not active." }
                };
            }

            // 4. If user is found, proceed with password validation based on auth type.
            // Active Directory Authentication
            if (user.UserAuthType == 2)
            {
                try
                {
                    bool isAdLoginValid = _activeDirectoryService.ValidateCredentials(credentials.UserName, credentials.Password);
                    if (isAdLoginValid)
                    {
                        // AD credentials are valid, generate token and return success.
                        return GenerateSuccessResponse(user);
                    }
                    else
                    {
                        // Username was correct, but AD password was wrong.
                        return new ResponseDetails { isSuccess = false, Data = new { message = "Password Is Incorrect, Please Enter Correct Password" } };
                    }
                }
                catch (Exception ex)
                {
                    // Log the exception for debugging AD connection issues
                    Console.WriteLine($"AD validation error: {ex.Message}");
                    return new ResponseDetails { isSuccess = false, Data = new { message = "An error occurred during Active Directory authentication." } };
                }
            }
            // Local Database Authentication
            else
            {
                if (user.Password == null || user.Password.Length == 0)
                {
                    return new ResponseDetails { isSuccess = false, Data = new { message = "No local password is set for this user." } };
                }

                byte[] hashedInputPassword = PasswordHasher.HashPassword(credentials.Password);
                bool isDbPasswordValid = hashedInputPassword.SequenceEqual(user.Password);

                if (isDbPasswordValid)
                {
                    // DB password is valid, generate token and return success.
                    return GenerateSuccessResponse(user);
                }
                else
                {
                    // Username was correct, but DB password was wrong.
                    return new ResponseDetails { isSuccess = false, Data = new { message = "Password Is Incorrect, Please Enter Correct Password" } };
                }
            }
        }

        private ResponseDetails GenerateSuccessResponse(User user)
        {
            string tokenString = GenerateJwtToken(user);
            return new ResponseDetails
            {
                isSuccess = true,
                Data = new
                {
                    Token = tokenString,
                    authenticationTypeID = user.UserAuthType,
                    message = "Login successful."
                }
            };
        }


        [HttpPost("Logout")]
        public IActionResult Logout()
        {
            var responseDetail = new ResponseDetails
            {
                isSuccess = true,
                Data = new { message = "Logout Successful" }
            };
            return Ok(responseDetail);
        }

        private string GenerateJwtToken(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(_config["Jwt:Key"]!);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.UserID.ToString()),
                    new Claim(ClaimTypes.Name, user.UserName!)
                }),
                Expires = DateTime.UtcNow.AddMinutes(60),
                Issuer = _config["Jwt:Issuer"],
                Audience = _config["Jwt:Audience"],
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(key),
                    SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        public static class PasswordHasher
        {
            public static byte[] HashPassword(string plainTextPassword)
            {
                using (SHA256 sha256 = SHA256.Create())
                {
                    return sha256.ComputeHash(Encoding.UTF8.GetBytes(plainTextPassword));
                }
            }
        }
    }
}
