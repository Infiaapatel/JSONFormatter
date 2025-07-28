using JSONFormatter.Server.Models;
using System.Data;
using JSONFormatter.Server.Models.UserMaster_Insert;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using JSONFormatter.Server.Service;

namespace JSONFormatter.Server.Controllers
{
    


    [Route("[controller]")]
    public class AdminController : Controller
    {
        private readonly string _connectionString;
        public AdminController( ConnectionStringBuilder connectionStringBuilder)
        {
            
            _connectionString = connectionStringBuilder.GetConnectionString();
        }


        [HttpPost("UserMasterInsert")]
        public string insertUserMaster([FromBody] List<userMasterInsertModel> users)
        {
            var message = "";
            try
            {
                using (SqlConnection con = new SqlConnection(_connectionString))
                {
                    con.Open();
                    foreach (var user in users)
                    {
                        using (SqlCommand cmd = new SqlCommand("[dbo].[UserMater_CRUD]", con))
                        {
                            cmd.CommandType = CommandType.StoredProcedure;
                            cmd.Parameters.AddWithValue("@loginFlag", 0);
                            cmd.Parameters.AddWithValue("@userName", user.userName);
                            cmd.Parameters.AddWithValue("@fullName", user.fullname);
                            cmd.Parameters.AddWithValue("@Email", user.email);

                            cmd.ExecuteNonQuery();
                        }
                    }

                }
                message = "DB operation succeed";
            }
            catch
            {
                message = "DB operation failed!!";
            }
            return message;
        }
    }
}