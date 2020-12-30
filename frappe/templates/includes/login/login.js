// login.js
// don't remove this line (used in test)

window.disable_signup = {{ disable_signup and "true" or "false" }};

window.login = {};

window.verify = {};

login.bind_events = function() {
	$(window).on("hashchange", function() {
		login.route();
	});

	$('#user-type').change(function () {
		if($(this).val()=='brand'){
			$('#brand_name').show()
		}else{
			$('#brand_name').val("")
			$('#brand_name').hide()
		}
	})

	if(window.location.hash === '#signup'){
		$('body').find('.btn-login-area').html(`<a href="#login" class="blue" style="margin: 56px">Do you have an account? Log-in</a>`)
	}

	$('body').find('.sign-up-message').on("click", function(event) { 
		$('body').find('.btn-login-area').html(`<a href="#login" class="blue" style="margin: 56px">Do you have an account? Log-in</a>`)
	})

	$(".form-login").on("submit", function(event) {
		event.preventDefault();
		var args = {};
		args.cmd = "login";
		args.usr = frappe.utils.xss_sanitise(($("#login_email").val() || "").trim());
		args.pwd = $("#login_password").val();
		args.device = "desktop";
		if(!args.usr || !args.pwd) {
			frappe.msgprint('{{ _("Both login and password required") }}');
			return false;
		}
		login.call(args);
		return false;
	});

	$(".form-signup").on("submit", function(event) {
		event.preventDefault();
		var args = {};
		args.cmd = "frappe.www.sign_up.sign_up";
		args.email = ($("#email_id").val() || "").trim();
		args.pwd = $("#new_password").val();
		args.confirm_pwd = $("#confirm_password").val(); 
		args.full_name = ($("#first_name").val() || "").trim();
		args.last_name = ($("#last_name").val() || "").trim();
		args.address = ($("#address").val() || "").trim();
		args.zip_code = ($("#zip_code").val() || "").trim();
		args.city = ($("#city").val() || "").trim();
		args.country = ($("#country").val() || "").trim();
		args.tax_id = ($("#tax_id").val() || "").trim();
		args.user_type = $('#user_type').val();
		args.company_name=$('#company_name').val();
		if(!args.email || !validate_email(args.email) || !args.full_name) {
			login.set_indicator('{{ _("Valid email and name required") }}', 'red');
			return false;
		}

		var $inputs = $('.form-signup :input');
        var values = {};
        $inputs.each(function () {
            values[this.name] = $(this).val();
        });
	   	validate_form(values)
		get_password_strength(args)
	});

	$(".form-forgot").on("submit", function(event) {
		event.preventDefault();
		var args = {};
		args.cmd = "frappe.core.doctype.user.user.reset_password";
		args.user = ($("#forgot_email").val() || "").trim();
		if(!args.user) {
			login.set_indicator('{{ _("Valid Login id required.") }}', 'red');
			return false;
		}
		login.call(args);
		return false;
	});
	$("#complete_signup").hide()
	$("#setup").click(function() {
		$("#complete_signup").toggle();
		return false;
	});

	$(".toggle-password").click(function() {
		$(this).toggleClass("fa-eye fa-eye-slash");
		var input = $($(this).attr("toggle"));
		if (input.attr("type") == "password") {
			input.attr("type", "text");
		} else {
			input.attr("type", "password");
		}
	});

	{% if ldap_settings and ldap_settings.enabled %}
		$(".btn-ldap-login").on("click", function(){
			var args = {};
			args.cmd = "{{ ldap_settings.method }}";
			args.usr = ($("#login_email").val() || "").trim();
			args.pwd = $("#login_password").val();
			args.device = "desktop";
			if(!args.usr || !args.pwd) {
				login.set_indicator('{{ _("Both login and password required") }}', 'red');
				return false;
			}
			login.call(args);
			return false;
		});
	{% endif %}
}




login.route = function() {
	var route = window.location.hash.slice(1);
	if(!route) route = "login";
	login[route]();
}

login.reset_sections = function(hide) {
	if(hide || hide===undefined) {
		$("section.for-login").toggle(false);
		$("section.for-forgot").toggle(false);
		$("section.for-signup").toggle(false);
	}
	$('section .indicator').each(function() {
		$(this).removeClass().addClass('indicator').addClass('blue')
			.text($(this).attr('data-text'));
	});
}

login.login = function() {
	login.reset_sections();
	$(".for-login").toggle(true);
}

login.steptwo = function() {
	login.reset_sections();
	$(".for-login").toggle(true);
}

login.forgot = function() {
	login.reset_sections();
	$(".for-forgot").toggle(true);
}

login.signup = function() {
	login.reset_sections();
	$(".for-signup").toggle(true);
}


// Login
login.call = function(args, callback) {
	login.set_indicator('{{ _("Verifying...") }}', 'blue');

	return frappe.call({
		type: "POST",
		args: args,
		callback: callback,
		freeze: true,
		statusCode: login.login_handlers
	});
}

login.set_indicator = function(message, color) {
	$('section:visible .indicator')
		.removeClass().addClass('indicator').addClass(color).text(message)
}

login.login_handlers = (function() {
	var get_error_handler = function(default_message) {
		return function(xhr, data) {
			if(xhr.responseJSON) {
				data = xhr.responseJSON;
			}

			var message = default_message;
			if (data._server_messages) {
				message = ($.map(JSON.parse(data._server_messages || '[]'), function(v) {
					// temp fix for messages sent as dict
					try {
						return JSON.parse(v).message;
					} catch (e) {
						return v;
					}
				}) || []).join('<br>') || default_message;
			}

			if(message===default_message) {
				login.set_indicator(message, 'red');
			} else {
				login.reset_sections(false);
			}

		};
	}

	var login_handlers = {
		200: function(data) {
			if(data.message == 'Logged In'){
				login.set_indicator('{{ _("Success") }}', 'green');
				window.location.href = frappe.utils.get_url_arg("redirect-to") || data.home_page;
			} else if(data.message == 'Password Reset'){
				window.location.href = data.redirect_to;
			} else if(data.message=="No App") {
				login.set_indicator("{{ _("Success") }}", 'green');
				if(localStorage) {
					var last_visited =
						localStorage.getItem("last_visited")
						|| frappe.utils.get_url_arg("redirect-to");
					localStorage.removeItem("last_visited");
				}

				if(data.redirect_to) {
					window.location.href = data.redirect_to;
				}

				if(last_visited && last_visited != "/login") {
					window.location.href = last_visited;
				} else {
					window.location.href = data.home_page;
				}
			} else if(window.location.hash === '#forgot') {
				if(data.message==='not found') {
					login.set_indicator('{{ _("Not a valid user") }}', 'red');
				} else if (data.message=='not allowed') {
					login.set_indicator('{{ _("Not Allowed") }}', 'red');
				} else if (data.message=='disabled') {
					login.set_indicator('{{ _("Not Allowed: Disabled User") }}', 'red');
				} else {
					login.set_indicator('{{ _("Instructions Emailed") }}', 'green');
				}
			} else if(window.location.hash === '#signup'){
				if(data.message=='Success') {
					window.location = window.location.host + '/api/method/frappe.www.sign_up.verification';
				}
			}

			/* else if(window.location.hash === '#signup') {
				if(cint(data.message[0])==0) {
					login.set_indicator(data.message[1], 'red');
				} else {
					login.set_indicator('{{ _("Success") }}', 'green');
					frappe.msgprint(data.message[1])
				}
				//login.set_indicator(__(data.message), 'green');
			}*/

			//OTP verification
			if(data.verification && data.message != 'Logged In') {
				login.set_indicator('{{ _("Success") }}', 'green');

				document.cookie = "tmp_id="+data.tmp_id;

				if (data.verification.method == 'OTP App'){
					continue_otp_app(data.verification.setup, data.verification.qrcode);
				} else if (data.verification.method == 'SMS'){
					continue_sms(data.verification.setup, data.verification.prompt);
				} else if (data.verification.method == 'Email'){
					continue_email(data.verification.setup, data.verification.prompt);
				}
			}
		},
		401: get_error_handler('{{ _("Invalid Login. Try again.") }}'),
		417: get_error_handler('{{ _("Oops! Something went wrong") }}')
	};
	return login_handlers;
} )();

frappe.ready(function() {

	login.bind_events();

	if (!window.location.hash) {
		window.location.hash = "#login";
	} else {
		$(window).trigger("hashchange");
	}

	$(".form-signup, .form-forgot").removeClass("hide");
	$(document).trigger('login_rendered');
});

var verify_token =  function(event) {
	$(".form-verify").on("submit", function(eventx) {
		eventx.preventDefault();
		var args = {};
		args.cmd = "login";
		args.otp = $("#login_token").val();
		args.tmp_id = frappe.get_cookie('tmp_id');
		if(!args.otp) {
			frappe.msgprint('{{ _("Login token required") }}');
			return false;
		}
		login.call(args);
		return false;
	});
}

var request_otp = function(r){
	$('.login-content').empty().append($('<div>').attr({'id':'twofactor_div'}).html(
		'<form class="form-verify">\
			<div class="page-card-head">\
				<span class="indicator blue" data-text="Verification">{{ _("Verification") }}</span>\
			</div>\
			<div id="otp_div"></div>\
			<input type="text" id="login_token" autocomplete="off" class="form-control" placeholder={{ _("Verification Code") }} required="" autofocus="">\
			<button class="btn btn-sm btn-primary btn-block" id="verify_token">{{ _("Verify") }}</button>\
		</form>'));
	// add event handler for submit button
	verify_token();
}

var continue_otp_app = function(setup, qrcode){
	request_otp();
	var qrcode_div = $('<div class="text-muted" style="padding-bottom: 15px;"></div>');

	if (setup){
		direction = $('<div>').attr('id','qr_info').text('{{ _("Enter Code displayed in OTP App.") }}');
		qrcode_div.append(direction);
		$('#otp_div').prepend(qrcode_div);
	} else {
		direction = $('<div>').attr('id','qr_info').text('{{ _("OTP setup using OTP App was not completed. Please contact Administrator.") }}');
		qrcode_div.append(direction);
		$('#otp_div').prepend(qrcode_div);
	}
}

var continue_sms = function(setup, prompt){
	request_otp();
	var sms_div = $('<div class="text-muted" style="padding-bottom: 15px;"></div>');

	if (setup){
		sms_div.append(prompt)
		$('#otp_div').prepend(sms_div);
	} else {
		direction = $('<div>').attr('id','qr_info').text(prompt || '{{ _("SMS was not sent. Please contact Administrator.") }}');
		sms_div.append(direction);
		$('#otp_div').prepend(sms_div)
	}
}

var continue_email = function(setup, prompt){
	request_otp();
	var email_div = $('<div class="text-muted" style="padding-bottom: 15px;"></div>');

	if (setup){
		email_div.append(prompt)
		$('#otp_div').prepend(email_div);
	} else {
		var direction = $('<div>').attr('id','qr_info').text(prompt || '{{ _("Verification code email not sent. Please contact Administrator.") }}');
		email_div.append(direction);
		$('#otp_div').prepend(email_div);
	}
}

var validate_zipcode = function(elementValue) {
        var zipCodePattern = /^\d{5}$|^\d{5}-\d{4}$/;
        if(elementValue && !zipCodePattern.test(elementValue)){
        	frappe.throw(__('Please enter zip code correctly!'));
        }
    }

var get_password_strength = function(args_) {
		frappe.call({
			type: 'POST',
			method: 'frappe.core.doctype.user.user.test_password_strength',
			args: {
				new_password: args_.pwd || ''
			},
			callback: function(r) {
				var result = r.message
				if (result && result.feedback && !result.feedback.password_policy_validation_passed) {
    				var suggestions = result['feedback']['suggestions'][0] ? result['feedback']['suggestions'] : ''
    				var warning = result['feedback']['warning'] ? result['feedback']['warning'] : ''
    				suggestions += "<br>" + __(" Hint: Include symbols, numbers and capital letters in the password") + '<br>'
    				frappe.throw(__('Invalid Password: '+ warning + suggestions))
				}
				if(args_.confirm_pwd != args_.pwd) {
					frappe.throw(__('Password and Confirm Passwords are not matching'));
				}
				validate_zipcode(args_.zip_code)

				login.call(args_);

				document.getElementById("sign_up").disabled = true;
				$('body').find('.form-control').attr("disabled", true);
				return false;
			}

		});
	}
var validate_form = function (input) {
		        if (input['company_name']) {
		        	validate_number(input['company_name'],"Company Name")
		        }
		        if (input['first_name']){
		        	validate_number(input['first_name'],"First Name")
		        }
		        if (input['last_name']){
		        	validate_number(input['last_name'],"Last Name")
		        }
		        if (input['address']){
		        	validate_number(input['address'],"Address")
		        }
		        if (input['city']){
		        	validate_number(input['city'],"City")
		        }
		        if (input['tax_id']){
		        	validate_number(input['tax_id'],"Intraco Vat")
		        }
    
	}	

var validate_number = function (input,field) {
	var numericPattern = /^[0-9]*$/;
	if(numericPattern.test(input)){
        	frappe.throw(__('Please enter alphanumeric input for ' +field));
        }

}