# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe
import requests
import json

from frappe import _
from erpnext.education.doctype.education_settings.education_settings import get_secure_url

def get_domain(url):
    return url.split("//")[-1].split("/")[0].split('?')[0]

@frappe.whitelist()
def open_url(cicle, material):
    secure_url = get_secure_url()
    if "Unidad " in material:
        material = material.replace("Unidad ", "material_book_unit_")
        secure_url = secure_url + "pdf/"
    else:
        material = "material_" + material.lower()
        secure_url = secure_url + "audio/"
    educational_material = frappe.get_doc("Educational Material", cicle)
    url = educational_material.get(material)
    if get_domain(url) == get_domain(secure_url):
        response = requests.get(url)
        encrypted_url = json.loads(response.content)
        return secure_url + encrypted_url.get("url")
    else:
        return url