# -*- coding: utf-8 -*-
# Copyright (c) 2020, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
# import frappe
from frappe.model.document import Document
import frappe
from frappe.sessions import get_geo_ip_country

class GuestToken(Document):
	pass

@frappe.whitelist(allow_guest = True)
def token():
    dtoken = frappe.new_doc('Guest Token')

    dtoken.token = frappe.generate_hash()
    dtoken.ip_address = frappe.local.request_ip
    country = get_geo_ip_country(dtoken.ip_address)
    if country:
        dtoken.country = country['iso_code']
    dtoken.save(ignore_permissions = True)

    return dtoken.token