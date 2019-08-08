# -*- coding: utf-8 -*-
# Copyright (c) 2019, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
from frappe.website.website_generator import WebsiteGenerator
from frappe import _
import frappe

class EducationalMaterial(WebsiteGenerator):
	website = frappe._dict(
		template = "templates/generators/educational_material.html",
		condition_field = "published",
		page_title_field = "cicle",
		)
		
	def get_context(self, context):
		context.parents = [{'name': 'Educational Material', 'title': _('Materiales Educativos'), 'route': 'educational_material' }]		
	
def get_list_context(context):
	context.title = _("Materiales Educativos")
	context.introduction = _('Materiales Educativos disponibles para el alumno')
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
			program_enrollment_list = frappe.get_all('Program Enrollment', filters={'student': student.name}, fields=['name'])
			program_enrollment = frappe.get_doc('Program Enrollment', program_enrollment_list[0].name)
			courses = []
			for row in program_enrollment.courses:
				courses.append(row.course)
			for r in frappe.get_all('Educational Material', fields=['name', 'cicle'], filters=[('Educational Material', 'cicle', 'in', courses)]):
				data.append(r)
	return data
