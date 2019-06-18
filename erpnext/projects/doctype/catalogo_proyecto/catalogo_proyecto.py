# -*- coding: utf-8 -*-
# Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document

class CatalogoProyecto(Document):
	pass


@frappe.whitelist()
def get_catalogo_productos(project):
	catalogo = frappe.get_doc("Catalogo Proyecto", project)
	productos = []
	for item in catalogo.items:
		productos.append(item.producto)
	return productos

@frappe.whitelist()
def get_catalogo_actividades(project):
	catalogo = frappe.get_doc("Catalogo Proyecto", project)
	actividades = []
	for activity_type in catalogo.activity_types:
		actividades.append(activity_type.tipo_actividad)
	return actividades


@frappe.whitelist()
def get_producto_info(project, producto):
	catalogo = frappe.get_doc("Catalogo Proyecto", project)
	item_info = frappe.get_doc("Item", producto)
	producto_info = {}
	for item in catalogo.items:
		if item.producto == producto:
			producto_info["nombre_proyecto"] = item.nombre_proyecto
			producto_info["grupo"] = item.grupo
			producto_info["precio"] = item.precio
			producto_info["stock_uom"] = item_info.stock_uom
			producto_info["brand"] = item_info.brand
			producto_info["serial_no"] = item_info.serial_no_series
	return producto_info

@frappe.whitelist()
def get_catalogo_actividades_info(project, actividad):
	catalogo = frappe.get_doc("Catalogo Proyecto", project)
	actividad_info = {}
	for activity_type in catalogo.activity_types:
		if activity_type.tipo_actividad == actividad:
			actividad_info["tipo_actividad"] = activity_type.tipo_actividad
			actividad_info["precio"] = activity_type.precio
	return actividad_info