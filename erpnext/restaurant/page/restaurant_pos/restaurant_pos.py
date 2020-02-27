from __future__ import unicode_literals
import frappe
from nubefact_integration.nubefact_integration.facturacion_electronica import send_document, consult_document


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

def pay_restaurant_order(restaurant_table):
    order = frappe.get_list("Restaurant Order", filters={"restaurant_table": restaurant_table, "order_status": "Taken"})
    if len(order) == 1:
        order_doc = frappe.get_doc("Restaurant Order", order[0].name)
        order_doc.order_status = "Paid"
        order_doc.save()