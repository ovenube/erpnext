# -*- coding: utf-8 -*-
# Copyright (c) 2020, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from erpnext.shopping_cart.cart import get_party

class Wishlist(Document):
	pass

@frappe.whitelist()
def get_wishlist(customer):
	if customer:
		doc_customer = get_party(customer)
		if frappe.get_all("Wishlist", filters={"customer": doc_customer.name}):
			return [item.item for item in frappe.get_doc("Wishlist", doc_customer.name).items]
		else:
			return []

@frappe.whitelist()
def set_wishlist(customer, item):
	saved = False
	if customer and item:
		doc_customer = get_party(customer)
		if frappe.get_all("Wishlist", filters={"customer": doc_customer.name}):
			wishlist = frappe.get_doc("Wishlist", doc_customer.name)
			if wishlist.get('items'):
				if not item in get_wishlist(customer):
					wishlist.append("items", {
						"item": item
					})
					saved = True
				else:
					[wishlist.remove(row) for row in wishlist.items if row.item == item]
			else:
				wishlist.append("items", {
					"item": item
				})
				saved = True
			wishlist.save()
		else:
			wishlist = frappe.get_doc({
				"doctype": "Wishlist", 
				"customer": doc_customer.name,
				"items": [
					{"item": item}
				]
			})
			wishlist.insert()
			saved = True
		return saved