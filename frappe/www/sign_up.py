#!/usr/bin/python
# -*- coding: utf-8 -*-

# Copyright (c) 2019, Frappe Technologies and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
import re
from frappe.model.document import Document
from frappe.utils import validate_email_address
from frappe.utils.verified_command import get_signed_params, \
    verify_request
from frappe.website.utils import is_signup_enabled


@frappe.whitelist(allow_guest=True)
def sign_up(email,pwd,full_name,user_type,company_name,redirect_to):
	print ("inside sign up________________\n\n")
	try:
		user = frappe.db.get('User', {'email': email})
		check_if_user_enabled(user,email)
		user_ = create_user(user,email,full_name,pwd,user_type,company_name,redirect_to)
		if user_type == 'brand':
			check_if_type_brand(user_type,company_name)
			create_company(user_type,company_name,email)
		send_verification_mail_(user_)
		return "Success"
	except Exception as e:
		frappe.db.rollback()
		title = _("Error while processing sign for {0}").format(email)
		traceback = frappe.get_traceback()
		frappe.log_error(message=traceback , title=title)
	
	
		
def create_user(user,email,full_name,pwd,user_type,company_name,redirect_to):
	user = frappe.get_doc({  
	    'doctype': 'User',
	    'email': email,
	    'owner': email,
	    'first_name': full_name,
	    'enabled': 1,
	    'new_password': pwd,
	    'type': user_type,
	    'brand_name': company_name,
	    'verification_status':'Pending Verification',
	    'user_type': 'Website User'
	    })

	user.flags.ignore_permissions = True
	user.flags.ignore_password_policy = True
	user.flags.ignore_welcome_mail_to_user = True
	user.insert()

	# set default signup role as per Portal Settings

	default_role = frappe.db.get_value('Portal Settings', None,
	        'default_role')
	if default_role:
	    user.add_roles(default_role)

	if user_type == 'brand':
	    user.add_roles('Brand User')
	elif user_type == 'client':
	    user.add_roles('Brand User')
	elif user_type == 'fabric_supplier':
	    user.add_roles('Fabric Vendor')
	elif user_type == 'trimming_supplier':
	    user.add_roles('Trimming Vendor')
	elif user_type == 'packaging_supplier':
	    user.add_roles('Packaging Vendor')
	elif user_type == 'factory':
	    user.add_roles('Manufacturing User')

	if redirect_to:
		frappe.cache().hset('redirect_after_login', user.name, redirect_to)
	return user


def check_if_user_enabled(user,email):
	if not is_signup_enabled():
		frappe.throw(_('Sign Up is disabled'), title='Not Allowed')

	if user:
		if user.disabled:
			return (0, _('Registered but disabled'))
		else:
			return (0, _('Already Registered'))
	else:
		if frappe.db.sql("""select count(*) from tabUser where
			HOUR(TIMEDIFF(CURRENT_TIMESTAMP, TIMESTAMP(modified)))=1""")[0][0] > 300:

			frappe.respond_as_web_page(_('Temporarily Disabled'),
				_('''Too many users signed up recently, so the registration is disabled. Please try back in an hour'''), 
				http_status_code=429)

def check_if_type_brand(user_type,company_name):
	if user_type == 'brand':
		if isBrandNameExists(company_name):
			return (0, _('Company Name Already Exists'))

def create_company(user_type,company_name,email):
	if user_type == 'brand':
		company = frappe.get_doc({
		    'doctype': 'Company',
		    'company_name': company_name,
		    'email': email,
		    'default_currency': 'USD',
		    'enabled': 1,
		    })

		company.flags.ignore_permissions = True
		company.flags.ignore_password_policy = True
		company.insert()

def isBrandNameExists(company_name):
    existing_brands = frappe.get_all('User',
            filters={'brand_name': company_name})
    if len(existing_brands) > 0:
        return True
    else:
        return False

def send_verification_mail_(user_):
	print ("inside mail________________\n\n")
	print ("send_verification_mail_ mail________________\n\n")

	from frappe.utils import get_url
	from frappe.utils.user import get_user_fullname

	full_name = get_user_fullname(frappe.session['user'])
	if full_name == "Guest":
		full_name = "Administrator"

	host_name = frappe.local.site
	url = frappe.utils.get_url('/api/method/frappe.www.sign_up.confirm_verification'
	                         ) + '?' \
	    + get_signed_params({'email': user_.email, 'name': user_.name,
	                        'host_name': host_name})

	frappe.sendmail(recipients=user_.email,
	                subject=_('Email Verification'),
	                template='email_verification', delayed=False,args={
	    'first_name': user_.first_name or user_.last_name or "user",
	    'user': user_.name,
	    'site_url': get_url(),
	    'user_fullname': full_name,
	    'link': url,
	    }, header=[_('Email Verification'), 'green'])

@frappe.whitelist(allow_guest=True)
def confirm_verification(email, name, host_name):
	if not verify_request():
		return

	doc = frappe.get_doc("User", name)
	host_name = frappe.local.site
	if doc.verification_status == 'Pending Verification':
		doc.verification_status = 'Verified'
		doc.save(ignore_permissions=True)
		frappe.db.commit()
		frappe.respond_as_web_page(_("Confirmed"),
			_("Your account has been verified. Please login"),
			indicator_color='green',primary_label=_('Login'),primary_action = '/login')
	else:
		frappe.respond_as_web_page(_("Link Expired"),
			_("This link has already been activated for verification."),
			indicator_color='red')
		

@frappe.whitelist(allow_guest=True)
def verification():
	frappe.respond_as_web_page(_("Verification Sent"),
			_("The email has been sent for verification on registered Email ID. Please verify Email to login"),
			indicator_color='green')
