# -*- coding: utf-8 -*-
# Copyright (c) 2020, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.website.website_generator import WebsiteGenerator
from frappe import _
import requests
import json

class EducationalMaterialPrint(WebsiteGenerator):
	website = frappe._dict(
		template = "templates/generators/educational_material_print.html",
		condition_field = "published",
		page_title_field = "cicle",
		)
		
	def get_context(self, context):
		context.parents = [{'name': 'Educational Material Print', 'title': _('Impresión de Materiales Educativos'), 'route': 'educational_material_print' }]

def get_list_context(context):
	context.title = _("Impresión de Materiales Educativos")
	context.introduction = _('Impresión de Materiales Educativos disponibles para el alumno')
	return {
		"get_list": get_cicle_list
	}

def get_cicle_list(doctype, txt=None, filters=None, limit_start=0, limit_page_length=20, order_by="modified"):
	user = frappe.session.user
	data = []
	if user != "Guest":
		student_list = frappe.get_all('Student', filters={'student_email_id': user}, fields=['name'])
		if student_list:
			student = student_list[0]
			courses = []
			program_enrollment_list = frappe.get_all('Program Enrollment', filters={'student': student.name}, fields=['name'])
			for r in program_enrollment_list:
				program_enrollment = frappe.get_doc('Program Enrollment', r.name)
				for row in program_enrollment.courses:
					if not row.course[:3] in courses:
						courses.append(row.course[:3])
			for r in frappe.get_all('Educational Material Print', fields=['name', 'cicle'], filters=[('Educational Material Print', 'cicle', 'in', courses)]):
				data.append(r)
	return data

@frappe.whitelist()
def get_educational_material_thumbnails(url):
	response = requests.get(url)
	return json.loads(response.content)
