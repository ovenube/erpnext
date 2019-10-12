# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe
import requests
import json

from frappe import _
from erpnext.education.doctype.education_settings.education_settings import get_secure_url

@frappe.whitelist()
def open_url(cicle, material):
    secure_url = get_secure_url()
    if "Unidad " in material:
        material = material.replace("Unidad ", "material_book_unit_")
    else:
        material = "material_" + material.lower()
    educational_material = frappe.get_doc("Educational Material", cicle)
    url = educational_material.get(material)
    response = requests.get(url)
    encrypted_url = json.loads(response.content)
    return secure_url + encrypted_url.get("url")