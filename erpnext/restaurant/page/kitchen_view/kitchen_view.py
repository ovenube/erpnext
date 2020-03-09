from __future__ import unicode_literals
import frappe
from erpnext.restaurant.doctype.restaurant_order.restaurant_order import get_order_kitchen, get_order_kitchen_delivery

@frappe.whitelist()
def get_orders_kitchen(kitchen):
    table_orders = []
    tables = frappe.get_list("Restaurant Table", fields=['name'])
    for table in tables:
        table_orders.append(get_order_kitchen(kitchen, table))
    delivery_orders = get_order_kitchen_delivery(kitchen)
    return table_orders + delivery_orders

@frappe.whitelist()
def open_restaurant_order(restaurant_order):
    order = frappe.get_doc("Restaurant Order", restaurant_order)
    if order.order_status == "Taken":
        order.order_status = "In progress"
        order.save()