# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe
import requests

from frappe import _
from erpnext.education.doctype.education_settings.education_settings import get_token

@frappe.whitelist()
def open_url(cicle, material):
    token = get_token()
    if "Unidad " in material:
        material = material.replace("Unidad ", "material_book_unit_")
    else:
        material = "material_" + material.lower()
    educational_material = frappe.get_doc("Educational Material", cicle)
    url = educational_material.get(material)
    return frappe._dict({
        "url": url,
        "token": token
    })