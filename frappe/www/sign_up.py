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
def sign_up(**kwargs):
	try:
		user = frappe.db.get('User', {'email': kwargs.get('email')})
		check_if_user_enabled(user,kwargs.get('email'))
		user_ = create_user(user,kwargs)
		if kwargs.get('user_type') == 'brand':
			check_if_type_brand(kwargs.get('user_type'),kwargs.get('company_name'))
			create_company(kwargs.get('user_type'),kwargs.get('company_name'),kwargs.get('email'))
		send_verification_mail_(user_)
		return "Success"
	except Exception as e:
		frappe.db.rollback()
		title = _("Error while processing sign for {0}").format(kwargs.get('email'))
		traceback = frappe.get_traceback()
		frappe.log_error(message=traceback , title=title)
		frappe.throw(_("Something went wrong, please contact Administrator to check Error Log"))

		
def create_user(user,kwargs):
	user_type = kwargs.get('user_type')
	user = frappe.get_doc({  
	    'doctype': 'User',
	    'email': kwargs.get('email'),
	    'owner': kwargs.get('email'),
	    'first_name': kwargs.get('full_name'),
	    'last_name':kwargs.get('last_name'),
	    'full_name':kwargs.get('full_name'),
	    'enabled': 0,
	    'new_password': kwargs.get('pwd'),
	    'type': kwargs.get('user_type'),
	    'brand_name': kwargs.get('company_name'),
	    'verification_status':'Pending Verification',
	    'user_type': 'Website User',
	    'address1':kwargs.get('address'),
	    'zip_code':kwargs.get('zip_code'),
	    'city':kwargs.get('city'),
	    'country':kwargs.get('country'),
	    'tax_id':kwargs.get('tax_id'),
	    'language':'en'
	    })

	user.flags.ignore_permissions = True
	user.flags.ignore_password_policy = True
	user.flags.ignore_welcome_mail_to_user = True
	user.insert()

	return user

def add_user_roles(user):

	# set default signup role as per Portal Settings
	default_role = frappe.db.get_value('Portal Settings', None,
	        'default_role')
	if default_role:
	    user.add_roles(default_role)

	if user.type == 'brand':
	    user.add_roles('Brand User')
	elif user.type == 'client':
	    user.add_roles('Brand User')
	elif user.type == 'fabric_supplier':
	    user.add_roles('Fabric Vendor')
	elif user.type == 'trimming_supplier':
	    user.add_roles('Trimming Vendor')
	elif user.type == 'packaging_supplier':
	    user.add_roles('Packaging Vendor')
	elif user.type == 'factory':
	    user.add_roles('Manufacturing User')

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
		doc.enabled = 1
		doc.save(ignore_permissions=True)
		add_user_roles(doc)
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
