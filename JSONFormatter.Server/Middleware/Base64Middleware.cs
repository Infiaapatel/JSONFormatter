using System.Security.Claims;
using System.Text;
using Newtonsoft.Json;
using Microsoft.AspNetCore.Authorization;
using JSONFormatter.Server.Helper;
using Microsoft.AspNetCore.Mvc.Controllers;

namespace JSONFormatter.Server.Middleware
{
    public class Base64Middleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<Base64Middleware> _logger;
        public Base64Middleware(RequestDelegate next, ILogger<Base64Middleware> logger)
        {
            _next = next;
            _logger = logger;
        }
        public async Task InvokeAsync(HttpContext context)
        {
            _logger.LogInformation("Processing request path: {Path}", context.Request.Path);

            if (IsSwaggerPath(context.Request.Path))
            {
                _logger.LogInformation("Skipping Base64 processing for Swagger path: {Path}", context.Request.Path);
                await _next(context);
                return;
            }

            if (IsAuthorizationRequired(context))
            {
                if (!TryRetrieveToken(context.Request, out var token))
                {
                    await WriteUnauthorizedResponseAsync(context, "Token not provided.");
                    return;
                }

                if (!context.User.Identity?.IsAuthenticated == true)
                {
                    await WriteUnauthorizedResponseAsync(context, "User not authenticated.");
                    return;
                }
                var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                context.Request.Headers.Remove("UserId");
                context.Request.Headers.Add("UserId", userId);
                if (userId != null)
                {
                    var userPermission = context.User.FindFirst("Permission")?.Value;
                    context.Request.Headers.Remove("rp");
                    context.Request.Headers.Add("rp", userPermission);
                    //if (!await ValidateTokenAsync(int.Parse(userId), token))
                    //{
                    //    await WriteUnauthorizedResponseAsync(context, "Invalid token.");
                    //    return;
                    //}
                }
                else
                {
                    await WriteUnauthorizedResponseAsync(context, "No user ID found.");
                    return;
                }
            }
            await _next(context);
        }
        private bool IsAuthorizationRequired(HttpContext context)
        {
            var endpoint = context.GetEndpoint();
            if (endpoint == null)
            {
                return false;
            }

            // Check if the endpoint or its metadata requires authorization
            var isAuthorized = IsActionAuthorized(endpoint) || IsControllerAuthorized(endpoint);

            // Skip authorization check if AllowAnonymous is specified
            var allowAnonymous = endpoint.Metadata.GetMetadata<AllowAnonymousAttribute>();
            return isAuthorized && allowAnonymous == null;
        }
        private bool IsActionAuthorized(Endpoint endpoint)
        {
            var actionDescriptor = endpoint.Metadata.GetMetadata<ControllerActionDescriptor>();
            if (actionDescriptor == null)
            {
                return false;
            }

            // Check for AuthorizeAttribute on the action method
            var authorizeAttributes = actionDescriptor.MethodInfo
                .GetCustomAttributes(typeof(AuthorizeAttribute), true)
                .Cast<AuthorizeAttribute>()
                .ToList();

            return authorizeAttributes.Any();
        }
        private bool IsControllerAuthorized(Endpoint endpoint)
        {
            var actionDescriptor = endpoint.Metadata.GetMetadata<ControllerActionDescriptor>();
            if (actionDescriptor == null)
            {
                return false;
            }

            // Check for AuthorizeAttribute on the controller
            var controllerAttributes = actionDescriptor.ControllerTypeInfo
                .GetCustomAttributes(typeof(AuthorizeAttribute), true)
                .Cast<AuthorizeAttribute>()
                .ToList();

            return controllerAttributes.Any();
        }
        private async Task WriteUnauthorizedResponseAsync(HttpContext context, string errorMessage)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            var responseMessage = new { IsSuccess = false, ErrorMessage = errorMessage };
            var jsonResponse = JsonConvert.SerializeObject(responseMessage);
            await context.Response.WriteAsync(jsonResponse);
        }
        private bool IsSwaggerPath(PathString path)
        {
            return path.StartsWithSegments("/swagger") ||
                   path.StartsWithSegments("/swagger/v1/swagger.json") ||
                   path.StartsWithSegments("/swagger-ui") ||
                   path.StartsWithSegments("/swagger-ui/index.html");
        }
       
        private static bool TryRetrieveToken(HttpRequest request, out string token)
        {
            token = null;

            // Check if the Authorization header is present
            if (request.Headers.TryGetValue("Authorization", out var authzHeaders))
            {
                // Log all headers for debugging
                foreach (var header in authzHeaders)
                {
                    Console.WriteLine($"Authorization Header: {header}");
                }

                // Process the Bearer token if present
                var bearerToken = authzHeaders.FirstOrDefault();
                if (!string.IsNullOrEmpty(bearerToken) && bearerToken.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                {
                    token = bearerToken.Substring("Bearer ".Length).Trim();
                    return !string.IsNullOrEmpty(token);
                }
            }

            // Log that no token was found
            Console.WriteLine("Token was not found in the Authorization header.");
            return false;
        }
    }
}
