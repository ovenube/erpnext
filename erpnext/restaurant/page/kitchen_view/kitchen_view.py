from __future__ import unicode_literals
import frappe
from erpnext.restaurant.doctype.restaurant_order.restaurant_order import get_order_kitchen

@frappe.whitelist()
def get_orders_kitchen(kitchen):
    kitchen_orders = []
    tables = frappe.get_list("Restaurant Table", fields=['name'])
    for table in tables:
        kitchen_orders.append(get_order_kitchen(kitchen, table))
    return kitchen_orders