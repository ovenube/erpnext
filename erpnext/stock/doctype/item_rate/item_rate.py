# -*- coding: utf-8 -*-
# Copyright (c) 2020, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
import numpy as np

class ItemRate(Document):
	pass

def get_item_rate(item_code):
	if frappe.get_all("Item Rate", filters={"item": item_code}):
		return [int(vote.rate) for vote in frappe.get_doc("Item Rate", item_code).votes]

@frappe.whitelist()
def set_item_rate(item_code, rate):
	user = frappe.session.user
	if item_code:
		if frappe.get_all("Item Rate", filters={"item": item_code}):
			item_rate = frappe.get_doc("Item Rate", item_code)
			for row in item_rate.votes:
				if row.user == user:
					row.rate = rate
			item_rate.save()
		else:
			item_rate = frappe.get_doc({
				"doctype": "Item Rate",
				"item": item_code,
				"votes": [
					{
						"user": user,
						"rate": rate
					}
				]
			})
			item_rate.insert()
		item = frappe.get_doc("Item", item_code)
		item.item_rate = int(round(np.mean(get_item_rate(item_code))))
		item.item_votes = len(get_item_rate(item_code))
		item.save(ignore_permissions=True)
		return item.item_rate
		