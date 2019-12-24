# -*- coding: utf-8 -*-
# Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document

class ValoracionPerforado(Document):
	pass


@frappe.whitelist()
def get_valoracion_perforado(project):
	valoraciones = frappe.get_doc("Valoracion Perforado", project)
	rango = []
	for valoracion in valoraciones.perforado:
		rango.append(valoracion.rango)
	return rango


@frappe.whitelist()
def get_rango_info(project, rango):
	valoraciones = frappe.get_doc("Valoracion Perforado", project)
	rango_info = {}
	for valoracion in valoraciones.perforado:
		if valoracion.rango == rango:
			rango_info = valoracion
	return rango_info
