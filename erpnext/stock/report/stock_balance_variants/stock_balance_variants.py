# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import flt, cint, getdate, now, date_diff, cstr
from erpnext.stock.utils import add_additional_uom_columns
from erpnext.stock.report.stock_ledger.stock_ledger import get_item_group_condition

from erpnext.stock.report.stock_ageing.stock_ageing import get_fifo_queue, get_average_age

from six import iteritems

def execute(filters=None):
	if not filters: filters = {}

	validate_filters(filters)

	from_date = filters.get('from_date')
	to_date = filters.get('to_date')

	include_uom = filters.get("include_uom")
	columns = get_columns(filters)
	row_items = get_row_items(filters)
	items = get_items(filters)
	sle = get_stock_ledger_entries(filters, items)

	if filters.get('show_stock_ageing_data'):
		filters['show_warehouse_wise_stock'] = True
		item_wise_fifo_queue = get_fifo_queue(filters, sle)

	# if no stock ledger entry found return
	if not sle:
		return columns, []

	iwb_map = get_item_warehouse_map(filters, sle)
	item_map = get_item_details(row_items, sle, filters)
	item_reorder_detail_map = get_item_reorder_details(item_map.keys())

	data = []
	conversion_factors = {}

	_func = lambda x: x[1]

	for (company, item, warehouse) in sorted(iwb_map):
		if item_map.get(item):
			qty_dict = iwb_map[(company, item, warehouse)]
			item_reorder_level = 0
			item_reorder_qty = 0
			if item + warehouse in item_reorder_detail_map:
				item_reorder_level = item_reorder_detail_map[item + warehouse]["warehouse_reorder_level"]
				item_reorder_qty = item_reorder_detail_map[item + warehouse]["warehouse_reorder_qty"]

			report_data = {
				'item_code': item,
				'warehouse': warehouse,
				'company': company,
				'reorder_level': item_reorder_level,
				'reorder_qty': item_reorder_qty,
			}
			report_data.update(item_map[item])
			report_data.update(qty_dict)

			if include_uom:
				conversion_factors.setdefault(item, item_map[item].conversion_factor)

			if filters.get('show_stock_ageing_data'):
				fifo_queue = item_wise_fifo_queue[(item, warehouse)].get('fifo_queue')

				stock_ageing_data = {
					'average_age': 0,
					'earliest_age': 0,
					'latest_age': 0
				}
				if fifo_queue:
					fifo_queue = sorted(filter(_func, fifo_queue), key=_func)
					if not fifo_queue: continue

					stock_ageing_data['average_age'] = get_average_age(fifo_queue, to_date)
					stock_ageing_data['earliest_age'] = date_diff(to_date, fifo_queue[0][1])
					stock_ageing_data['latest_age'] = date_diff(to_date, fifo_queue[-1][1])

				report_data.update(stock_ageing_data)

			data.append(report_data)

	add_additional_uom_columns(columns, data, include_uom, conversion_factors)
	return columns, data

def get_columns(filters):
	"""return columns"""

	columns = [
		{"label": _("Item"), "fieldname": "item_code", "fieldtype": "Link", "options": "Item", "width": 100},
		{"label": _("Item Name"), "fieldname": "item_name", "width": 150},
		{"label": _("Image"), "fieldname": "website_image", "width": 150},
		{"label": _("Item Group"), "fieldname": "item_group", "fieldtype": "Link", "options": "Item Group", "width": 100},
		{"label": _("Warehouse"), "fieldname": "warehouse", "fieldtype": "Link", "options": "Warehouse", "width": 100},
		{"label": _("Stock UOM"), "fieldname": "stock_uom", "fieldtype": "Link", "options": "UOM", "width": 90},
		{"label": _("Company"), "fieldname": "company", "fieldtype": "Link", "options": "Company", "width": 100}
	]

	if filters.get('show_stock_ageing_data'):
		columns += [{'label': _('Average Age'), 'fieldname': 'average_age', 'width': 100},
		{'label': _('Earliest Age'), 'fieldname': 'earliest_age', 'width': 100},
		{'label': _('Latest Age'), 'fieldname': 'latest_age', 'width': 100}]

	columns += [{'label': att_name, 'fieldname': att_name, 'width': 100} for att_name in get_talla_attribute()]

	return columns

def get_conditions(filters):
	conditions = ""
	if not filters.get("from_date"):
		frappe.throw(_("'From Date' is required"))

	if filters.get("to_date"):
		conditions += " and sle.posting_date <= %s" % frappe.db.escape(filters.get("to_date"))
	else:
		frappe.throw(_("'To Date' is required"))

	if filters.get("company"):
		conditions += " and sle.company = %s" % frappe.db.escape(filters.get("company"))

	if filters.get("warehouse"):
		warehouse_details = frappe.db.get_value("Warehouse",
			filters.get("warehouse"), ["lft", "rgt"], as_dict=1)
		if warehouse_details:
			conditions += " and exists (select name from `tabWarehouse` wh \
				where wh.lft >= %s and wh.rgt <= %s and sle.warehouse = wh.name)"%(warehouse_details.lft,
				warehouse_details.rgt)

	if filters.get("warehouse_type") and not filters.get("warehouse"):
		conditions += " and exists (select name from `tabWarehouse` wh \
			where wh.warehouse_type = '%s' and sle.warehouse = wh.name)"%(filters.get("warehouse_type"))

	return conditions

def get_stock_ledger_entries(filters, items):
	item_conditions_sql = ''
	if items:
		item_conditions_sql = ' and sle.item_code in ({})'\
			.format(', '.join([frappe.db.escape(i, percent=False) for i in items]))

	conditions = get_conditions(filters)

	return frappe.db.sql("""
		select
			sle.item_code, warehouse, sle.posting_date, sle.actual_qty, sle.valuation_rate,
			sle.company, sle.voucher_type, sle.qty_after_transaction, sle.stock_value_difference,
			sle.item_code as name, sle.voucher_no, item.variant_of as variant_of, item.name as item_name
		from
			`tabStock Ledger Entry` sle force index (posting_sort_index) left join `tabItem` as item
		on sle.item_code = item.item_code
		where sle.docstatus < 2 %s %s
		order by sle.posting_date, sle.posting_time, sle.creation, sle.actual_qty""" % #nosec
		(item_conditions_sql, conditions), as_dict=1)

def get_item_warehouse_map(filters, sle):
	iwb_map = {}
	variant_qty_diff = None
	talla_attributes = get_talla_attribute()
	from_date = getdate(filters.get("from_date"))
	to_date = getdate(filters.get("to_date"))

	float_precision = cint(frappe.db.get_default("float_precision")) or 3

	for d in sle:
		if d.variant_of:
			key = (d.company, d.variant_of, d.warehouse)
			attribute_value = get_item_attribute_value(d.item_name)
		else:
			key = (d.company, d.item_code, d.warehouse)
		if key not in iwb_map:
			iwb_map[key] = frappe._dict({
				"total": 0.0
			})
			for talla in talla_attributes:
				iwb_map[key][talla] = 0.0

		if d.variant_of:
			qty_dict = iwb_map[(d.company, d.variant_of, d.warehouse)]
		else:
			qty_dict = iwb_map[(d.company, d.item_code, d.warehouse)]

		if d.voucher_type == "Stock Reconciliation":
			if d.variant_of:
				if attribute_value:
					variant_qty_diff = flt(d.qty_after_transaction) - qty_dict[attribute_value]
			else:
				qty_diff = flt(d.qty_after_transaction) - flt(qty_dict.total)
		else:
			if d.variant_of:
				variant_qty_diff = flt(d.actual_qty)
			else:
				qty_diff = flt(d.actual_qty)

		if d.variant_of:
			if attribute_value:
				qty_dict[attribute_value] += variant_qty_diff
				qty_dict.total += qty_dict[attribute_value]
		else:
			qty_dict.total += qty_diff

	iwb_map = filter_items_with_no_transactions(iwb_map, float_precision)

	return iwb_map

def filter_items_with_no_transactions(iwb_map, float_precision):
	for (company, item, warehouse) in sorted(iwb_map):
		qty_dict = iwb_map[(company, item, warehouse)]

		no_transactions = True
		for key, val in iteritems(qty_dict):
			val = flt(val, float_precision)
			qty_dict[key] = val
			if key != "val_rate" and val:
				no_transactions = False

		if no_transactions:
			iwb_map.pop((company, item, warehouse))

	return iwb_map

def get_row_items(filters):
	conditions = []
	conditions.append("item.variant_of IS NULL")

	if filters.get("item_code"):
		conditions.append("item.name=%(item_code)s")
	else:
		if filters.get("item_group"):
			conditions.append(get_item_group_condition(filters.get("item_group")))

	items = []
	if conditions:
		items = frappe.db.sql_list("""select name from `tabItem` item where {}"""
			.format(" and ".join(conditions)), filters)
	
	return items

def get_items(filters):
	conditions = []
	if filters.get("item_code"):
		conditions.append("item.name=%(item_code)s")
	else:
		if filters.get("item_group"):
			conditions.append(get_item_group_condition(filters.get("item_group")))

	items = []
	if conditions:
		items = frappe.db.sql_list("""select name from `tabItem` item where {}"""
			.format(" and ".join(conditions)), filters)
	
	return items

def get_item_details(items, sle, filters):
	item_details = {}
	if not items:
		items = list(set([d.item_code for d in sle]))

	if not items:
		return item_details

	cf_field = cf_join = ""
	if filters.get("include_uom"):
		cf_field = ", ucd.conversion_factor"
		cf_join = "left join `tabUOM Conversion Detail` ucd on ucd.parent=item.name and ucd.uom=%s" \
			% frappe.db.escape(filters.get("include_uom"))

	site_name = cstr(frappe.local.site)

	res = frappe.db.sql("""
		select
			item.name, concat(%s, item.website_image) as image, item.item_name, item.description, item.item_group, item.brand, item.stock_uom %s
		from
			`tabItem` item
			%s
		where
			item.name in (%s)
	""" % (site_name, cf_field, cf_join, ','.join(['%s'] *len(items))), items, as_dict=1)

	for item in res:
		item_details.setdefault(item.name, item)

	return item_details

def get_item_reorder_details(items):
	item_reorder_details = frappe._dict()

	if items:
		item_reorder_details = frappe.db.sql("""
			select parent, warehouse, warehouse_reorder_qty, warehouse_reorder_level
			from `tabItem Reorder`
			where parent in ({0})
		""".format(', '.join([frappe.db.escape(i, percent=False) for i in items])), as_dict=1)

	return dict((d.parent + d.warehouse, d) for d in item_reorder_details)

def validate_filters(filters):
	if not (filters.get("item_code") or filters.get("warehouse")):
		sle_count = flt(frappe.db.sql("""select count(name) from `tabStock Ledger Entry`""")[0][0])
		if sle_count > 500000:
			frappe.throw(_("Please set filter based on Item or Warehouse due to a large amount of entries."))

def get_talla_attribute():
	'''Return all item variant attributes.'''
	attributes = frappe.get_doc('Item Attribute', "TALLA")
	return [i.attribute_value for i in attributes.item_attribute_values]

def get_item_attribute_value(item_name):
	attributes = frappe.get_doc("Item", item_name).attributes
	attribute_value = ""
	for attr in attributes:
		if attr.attribute == "TALLA":
			attribute_value = attr.attribute_value
	return attribute_value
