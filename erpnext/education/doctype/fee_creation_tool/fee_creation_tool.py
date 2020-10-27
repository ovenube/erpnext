# -*- coding: utf-8 -*-
# Copyright (c) 2020, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from nubefact_integration.nubefact_integration.facturacion_electronica import set_fees_fields
from erpnext.setup.doctype.naming_series.naming_series import NamingSeries

class FeeCreationTool(NamingSeries):
	def validate(self):
		for student in self.students:
			if student.fee_created == 1:
				frappe.throw("Student {0} already has a Fee created").format(studen.student_name)

	def before_submit(self):
		self.create_fees()

	def create_fees(self):
		error = False
		doc = frappe.get_doc("Fee Structure", self.fee_structure)
		for student in self.students:
			fees = frappe.get_list("Fees", filters={'student': student.student, 'student_group': self.student_group})
			if student.fee_created == 0 and not fees:
				try:
					fees_doc = get_mapped_doc("Fee Creation Tool", self.name, {
						"Fee Creation Tool": {
							"doctype": "Fees",
							"field_map": {
								"name": "Fee Creation Tool"
							}
						}
					})
					fees_doc.naming_series = self.fee_naming_series
					fees_doc.student = student.student
					fees_doc.student_name = student.student_name
					fees_doc.save()
					set_fees_fields(fees_doc)
					fees_doc.submit()
					update_student_group(student.student, self.student_group, created=1)
				except Exception as e:
					error = True
					print(e)
		if error:
			frappe.db.rollback()
			frappe.throw("Error while submitting")
	
	def get_fee_series(self):
		fee_series = self.get_options("Fees")
		fee_series.replace("\n\n", "\n")
		fee_series.split("\n")
		return fee_series

def update_student_group(student, student_group, created=0):
	frappe.db.sql("""UPDATE `tabStudent Group Student`
						SET fee_created=%s
						WHERE parent=%s
						AND student=%s""", (created, student_group, student))
