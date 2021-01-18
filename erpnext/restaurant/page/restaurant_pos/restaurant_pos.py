from __future__ import unicode_literals
import frappe
from nubefact_integration.nubefact_integration.facturacion_electronica import send_document, consult_document
from frappe.utils import now_datetime, nowtime
import json

@frappe.whitelist()
def generate_electronic_invoice(company, invoice, doctype):
    doc = frappe.get_doc(doctype, invoice)
    if doc:
        consult = consult_document(company, invoice, doctype)
        if consult.get('codigo') == 24:
            response = send_document(company, invoice, doctype)
            if response.get('codigo_hash'):
                doc.estado_sunat = "Aceptado" if response.get('codigo_hash') != "" else "Rechazado"
                doc.respuesta_sunat = response.get('sunat_descripcion')
                doc.codigo_qr_sunat = response.get('cadena_para_codigo_qr')
                doc.codigo_barras_sunat = response.get('codigo_de_barras')
                doc.codigo_hash_sunat = response.get('codigo_hash')
                doc.enlace_pdf = response.get('enlace_del_pdf')
                doc.save()
                doc.submit()
                pay_restaurant_order(doc.restaurant_table)
                update_table(doc.restaurant_table, 0)
                return response
            else:
                return ""
        else:
            doc.estado_sunat = "Aceptado" if consult.get('codigo_hash') != "" else "Rechazado"
            doc.respuesta_sunat = consult.get('sunat_descripcion')
            doc.codigo_qr_sunat = consult.get('cadena_para_codigo_qr')
            doc.codigo_barras_sunat = consult.get('codigo_de_barras')
            doc.codigo_hash_sunat = consult.get('codigo_hash')
            doc.enlace_pdf = consult.get('enlace_del_pdf')
            doc.save()
            doc.submit()
            pay_restaurant_order(doc.restaurant_table)
            return consult

@frappe.whitelist()
def pay_restaurant_order(order):
    order_doc = frappe.get_doc("Restaurant Order", order)
    order_doc.order_status = "Paid"
    if order_doc != "":
        update_table(order_doc.restaurant_table, 0)
    order_doc.save()

@frappe.whitelist()
def cancel_restaurant_order(order):
    order_doc = frappe.get_doc("Restaurant Order", order)
    order_doc.order_status = "Canceled"
    if order_doc != "":
        update_table(order_doc.restaurant_table, 0)
    order_doc.save()

@frappe.whitelist()
def update_table(restaurant_table, occupied):
    table = frappe.get_doc("Restaurant Table", restaurant_table)
    table.occupied = occupied
    if occupied == 1:
        table.time = now_datetime()
    else:
        table.time = ""
    table.save()
    return table.restaurant

@frappe.whitelist()
def update_order_items(order, items, total_qty):
    order_doc = frappe.get_doc("Restaurant Order", order)
    current_items = order_doc.items
    if order_doc.total_qty != total_qty:
        order_doc.attended = 0
    items = json.loads(items)
    item_dicts = []
    for item in items:
        served_qty = 0
        for current_item in current_items:
            if current_item.item == item['item_code']:
                served_qty = current_item.served_qty
        item_dicts.append({
            'item': item['item_code'],
            'item_name': item['item_name'],
            'qty': item['qty'],
            'served_qty': served_qty,
            'rate': item['rate'],
            'discount': item['discount_percentage'],
            'observations': item.get('observations') if item.get('observations') else ""
        })
    order_doc.items = {}
    for item_dict in item_dicts:
        order_doc.append("items", item_dict)
    order_doc.total_qty = total_qty
    order_doc.save()

@frappe.whitelist()
def update_order_totals(order, grand_total, total_taxes_and_charges):
    order_doc = frappe.get_doc("Restaurant Order", order)
    order_doc.total_amount = grand_total
    order_doc.total_taxes_and_charges = total_taxes_and_charges
    order_doc.save()

@frappe.whitelist()
def update_order_customer(order, customer):
    order_doc = frappe.get_doc("Restaurant Order", order)
    order_doc.customer = customer
    order_doc.save()

@frappe.whitelist()
def update_order_table(order, table):
    order_doc = frappe.get_doc("Restaurant Order", order)
    update_table(order_doc.restaurant_table, 0)
    order_doc.restaurant_table = table
    update_table(order_doc.restaurant_table, 1)
    order_doc.save()

@frappe.whitelist()
def get_precount(order, restaurant):
    order_doc = frappe.get_doc("Restaurant Order", order)
    settings = frappe.get_doc("Restaurant", restaurant)
    print_format = settings.print_format
    if order_doc.order_status != "Precount":
        order_doc.order_status = "Precount"
        order_doc.precount_time = nowtime()
        order_doc.save()
    return print_format or ""