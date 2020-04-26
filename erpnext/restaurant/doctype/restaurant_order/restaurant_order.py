# -*- coding: utf-8 -*-
# Copyright (c) 2020, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document

class RestaurantOrder(Document):
	pass

def get_order_kitchen(kitchen, table):
	kitchen_groups = frappe.get_doc("Restaurant Kitchen", kitchen).item_groups
	kitchen_item_groups = []
	for item_group in kitchen_groups:
		kitchen_item_groups.append(item_group.item_group)
	table_order = {
		"table": table['name'],
		"items": []
		}	
	orders = frappe.get_list("Restaurant Order", filters={'restaurant_table': table['name'], 'order_status': ['in', ('Taken', 'In progress', 'Precount')], 'attended': 0})
	if len(orders) == 1:
		order = frappe.get_doc("Restaurant Order", orders[0]['name'])
		table_order['order'] = order.name
		for order_item in order.items:
			item = frappe.get_doc("Item", order_item.item)
			if item.item_group in kitchen_item_groups:
				table_order["items"].append(item)
	return table_order

def get_order_kitchen_delivery(kitchen):
	delivery_orders = []
	kitchen_groups = frappe.get_doc("Restaurant Kitchen", kitchen).item_groups
	kitchen_item_groups = []
	for item_group in kitchen_groups:
		kitchen_item_groups.append(item_group.item_group)
	orders = frappe.get_list("Restaurant Order", filters={'restaurant_table': "",'order_status': ['in', ('Taken', 'In progress', 'Precount')], 'attended': 0})
	for order in orders:
		current_order = {}
		order = frappe.get_doc("Restaurant Order", order['name'])
		current_order = {
			'order': order.name,
			'time': order.time,
			'items': []
		}
		for order_item in order.items:
			item = frappe.get_doc("Item", order_item.item)
			if item.item_group in kitchen_item_groups:
				current_order["items"].append(item)
		delivery_orders.append(current_order)
	return delivery_orders