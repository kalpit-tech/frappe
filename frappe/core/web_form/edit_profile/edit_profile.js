frappe.ready(function() {
	// bind events here
	var div_reset_password_button = document.createElement("div");
	div_reset_password_button.className = "page-header d-flex align-items-center";
	var reset_password_button = document.createElement("a"); 
	reset_password_button.innerHTML = "Reset Password"; 
	reset_password_button.className = "btn btn-primary ml-auto";
	reset_password_button.href = "update-password"
	
	var parent_node =  document.getElementsByClassName("page-breadcrumbs")[0];
	div_reset_password_button.append(reset_password_button)
	parent_node.after(div_reset_password_button);
})

