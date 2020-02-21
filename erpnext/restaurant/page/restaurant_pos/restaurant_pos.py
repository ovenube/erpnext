from __future__ import unicode_literals
import frappe, json
from frappe.utils.nestedset import get_root_of
from frappe.utils import cint
from erpnext.selling.page.point_of_sale.point_of_sale import search_serial_or_batch_or_barcode_number, get_conditions

from six import string_types

@frappe.whitelist()
def get_items(start, page_length, price_list, search_value="", pos_profile=None):
	data = dict()
	warehouse = ""
	display_items_in_stock = 0

	if pos_profile:
		warehouse, display_items_in_stock = frappe.db.get_value('POS Profile', pos_profile, ['warehouse', 'display_items_in_stock'])

	if search_value:
		data = search_serial_or_batch_or_barcode_number(search_value)

	item_code = data.get("item_code") if data.get("item_code") else search_value
	serial_no = data.get("serial_no") if data.get("serial_no") else ""
	batch_no = data.get("batch_no") if data.get("batch_no") else ""
	barcode = data.get("barcode") if data.get("barcode") else ""

	condition = get_conditions(item_code, serial_no, batch_no, barcode)

	result = []

	items_data = frappe.db.sql(""" SELECT name as item_code,
			item_name, image as item_image, idx as idx,is_stock_item
		FROM
			`tabItem`
		WHERE
			disabled = 0 and has_variants = 0 and is_sales_item = 1
			and {condition} order by idx desc limit {start}, {page_length}"""
		.format(
			start=start, page_length=page_length,
			condition=condition
		), as_dict=1)

	if items_data:
		items = [d.item_code for d in items_data]
		item_prices_data = frappe.get_all("Item Price",
			fields = ["item_code", "price_list_rate", "currency"],
			filters = {'price_list': price_list, 'item_code': ['in', items]})

		item_prices, bin_data = {}, {}
		for d in item_prices_data:
			item_prices[d.item_code] = d


		if display_items_in_stock:
			filters = {'actual_qty': [">", 0], 'item_code': ['in', items]}

			if warehouse:
				filters['warehouse'] = warehouse

			bin_data = frappe._dict(
				frappe.get_all("Bin", fields = ["item_code", "sum(actual_qty) as actual_qty"],
				filters = filters, group_by = "item_code")
			)

		for item in items_data:
			row = {}

			row.update(item)
			item_price = item_prices.get(item.item_code) or {}
			row.update({
				'price_list_rate': item_price.get('price_list_rate'),
				'currency': item_price.get('currency'),
				'actual_qty': bin_data.get('actual_qty')
			})

			result.append(row)

	res = {
		'items': result
	}

	if serial_no:
		res.update({
			'serial_no': serial_no
		})

	if batch_no:
		res.update({
			'batch_no': batch_no
		})

	if barcode:
		res.update({
			'barcode': barcode
		})

	return res