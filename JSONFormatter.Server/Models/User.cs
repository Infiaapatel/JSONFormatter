namespace JSONFormatter.Server.Models
{
    public class User
    {
        public int UserID { get; set; }                                                 
        public string? UserName { get; set; }
        public string? FullName { get; set; }
        public string? Email { get; set; }
        public byte[] Password { get; set; }
        public bool? IsActive { get; set; }           
        public int? UserAuthType { get; set; }
    }
}
