# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals

import frappe
from erpnext.shopping_cart.cart import _get_cart_quotation
from erpnext.shopping_cart.doctype.shopping_cart_settings.shopping_cart_settings \
	import get_shopping_cart_settings, show_quantity_in_website
from erpnext.utilities.product import get_price, get_qty_in_stock, get_non_stock_item_status

@frappe.whitelist(allow_guest=True)
def get_product_info_for_website(item_code):
	"""get product price / stock info for website"""

	cart_settings = get_shopping_cart_settings()
	if not cart_settings.enabled:
		return frappe._dict()

	cart_quotation = _get_cart_quotation()

	price = get_price(
			item_code,
			cart_settings.price_list,
			cart_settings.default_customer_group,
			cart_settings.company
		)
	referencial_price = get_price(
		item_code,
		cart_settings.referencial_price_list,
		cart_settings.default_customer_group,
		cart_settings.company
	)
	discount = round((referencial_price.price_list_rate - price.price_list_rate)/referencial_price.price_list_rate * 100) if referencial_price is not None else 0

	stock_status = get_qty_in_stock(item_code, "website_warehouse")

	product_info = {
		"price": price,
		"referencial_price": referencial_price or None,
		"discount": discount,
		"stock_qty": stock_status.stock_qty,
		"in_stock": stock_status.in_stock if stock_status.is_stock_item else get_non_stock_item_status(item_code, "website_warehouse"),
		"qty": 0,
		"uom": frappe.db.get_value("Item", item_code, "stock_uom"),
		"show_stock_qty": show_quantity_in_website(),
		"sales_uom": frappe.db.get_value("Item", item_code, "sales_uom")
	}

	if product_info["price"]:
		item = cart_quotation.get({"item_code": item_code})
		if item:
			product_info["qty"] = item[0].qty

	return frappe._dict({
		"product_info": product_info,
		"cart_settings": cart_settings
	})

def set_product_info_for_website(item):
	"""set product price uom for website"""
	product_info = get_product_info_for_website(item.item_code)

	if product_info:
		item.update(product_info)
		item["stock_uom"] = product_info.get("uom")
		item["sales_uom"] = product_info.get("sales_uom")
		if product_info.get("price"):
			item["price_stock_uom"] = product_info.get("price").get("formatted_price")
			item["price_sales_uom"] = product_info.get("price").get("formatted_price_sales_uom")
		else:
			item["price_stock_uom"] = ""
			item["price_sales_uom"] = ""