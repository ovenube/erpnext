# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe
import requests
import json
from erpnext.education.doctype.education_settings.education_settings import get_secure_url

@frappe.whitelist()
def open_url(cicle, material):
    secure_url = get_secure_url() + "printer/"
    if "Unidad " in material:
        material = material.replace("Unidad ", "material_book_unit_")
    else:
        material = "material_" + material.lower()
    education_settings = frappe.get_single("Education Settings")
    url = education_settings.get("educational_material_print_url")
    educational_material_print = frappe.get_doc("Educational Material Print", cicle)
    material_data = educational_material_print.get(material).split("//")[-1].split("/")[2:]
    material_images = []
    for img in educational_material_print.get(material + "_thumbnails"):
        if img.print == 1:
            material_images.append(img.image_name)
    content = {
        "numero_libro": material_data[0],
        "tipo": material_data[1],
        "nombre_archivo": material_data[2],
        "images": material_images
    }
    response = requests.post(url, data=json.dumps(content))
    encrypted_url = json.loads(response.content)
    return secure_url + encrypted_url.get("url")

    