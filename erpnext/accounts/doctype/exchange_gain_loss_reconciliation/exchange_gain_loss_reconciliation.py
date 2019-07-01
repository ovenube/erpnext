# -*- coding: utf-8 -*-
# Copyright (c) 2019, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from ple.ple_peru.utils import Utils
from frappe.utils import flt, add_days, nowdate
import datetime

class ExchangeGainLossReconciliation(Utils):
	def validate(self):
		posting_date = datetime.datetime.strptime(self.posting_date, "%Y-%m-%d")
		today_date = datetime.datetime.now()
		if today_date.date() < posting_date.date():
			frappe.throw("Invalid posting date")

	def on_submit(self):
		if self.references:
			for reference in self.references:
				invoice = frappe.get_doc(reference.reference_doctype, reference.reference_name)
				invoice.exchange_rate_monthly_closing = self.conversion_rate_sales if reference.reference_doctype == "Purchase Invoice" else self.conversion_rate_purchase
				invoice.save()

	def on_cancel(self):
		if self.references:
			for reference in self.references:
				invoice = frappe.get_doc(reference.reference_doctype, reference.reference_name)
				invoice.exchange_rate_monthly_closing = ""
				invoice.save()

	def get_period_invoices(self, year, month):
		from_date, to_date = self.get_dates(year, month)
		invoices = []
		purchase_invoices = frappe.get_all("Purchase Invoice", 
		filters={
			"docstatus": '1',
			"status": ["in", ['Overdue', 'Unpaid']],
			"currency": "USD",
			"posting_date": ["<=", to_date]
		},
		fields={
			"name", "bill_date", "credit_to", "bill_series", "bill_no", "grand_total", "currency", "conversion_rate", "base_grand_total", "outstanding_amount"
		})
		for purchase_invoice in purchase_invoices:
			invoices.append(frappe._dict({
				"reference_doctype": "Purchase Invoice",
				"reference_name": purchase_invoice.name,
				"due_date": purchase_invoice.bill_date,
				"account": purchase_invoice.credit_to,
				"bill_no": ((purchase_invoice.get("bill_series") + "-" if purchase_invoice.get("bill_series") else "")  + purchase_invoice.get("bill_no")) if purchase_invoice.get("bill_no") else "",
				"grand_total": purchase_invoice.grand_total,
				"currency": purchase_invoice.currency,
				"exchange_rate": purchase_invoice.conversion_rate,
				"total_amount": purchase_invoice.base_grand_total,
				"outstanding_amount": purchase_invoice.outstanding_amount,
				"exchange_amount": purchase_invoice.outstanding_amount / purchase_invoice.conversion_rate,
				"conversion_rate": self.conversion_rate_sales if purchase_invoice.currency=="USD" else 1
			}))
		sales_invoices = frappe.get_all("Sales Invoice", 
		filters={
			"docstatus": '1',
			"status": ["in", ['Overdue', 'Unpaid']],
			"currency": "USD",
			"posting_date": ["<=", to_date]
		},
		fields={
			"name", "posting_date", "debit_to", "grand_total", "currency", "conversion_rate", "base_grand_total", "outstanding_amount"
		})
		for sales_invoice in sales_invoices:
			invoices.append(frappe._dict({
				"reference_doctype": "Sales Invoice",
				"reference_name": sales_invoice.name,
				"due_date": sales_invoice.posting_date,
				"account": sales_invoice.debit_to,
				"bill_no": "",
				"grand_total": sales_invoice.grand_total,
				"currency": sales_invoice.currency,
				"exchange_rate": sales_invoice.conversion_rate,
				"total_amount": sales_invoice.base_grand_total,
				"outstanding_amount": sales_invoice.outstanding_amount
			}))
		return invoices

	def get_posting_date(self, year, month):
		to_date, from_date = self.get_dates(year, month)
		return from_date

	def get_exchange_rate(self, from_currency, to_currency, transaction_date=None):
		if not (from_currency and to_currency):
			# manqala 19/09/2016: Should this be an empty return or should it throw and exception?
			return

		if from_currency == to_currency:
			return frappe._dict({
				"conversion_rate_sales": 1,
				"conversion_rate_purchase": 1
			})

		if not transaction_date:
			transaction_date = nowdate()

		try:
			currency_exchange = frappe.get_doc("Currency Exchange", transaction_date + "-" + from_currency + "-" + to_currency)
			return frappe._dict({
				"conversion_rate_sales": currency_exchange.exchange_rate,
				"conversion_rate_purchase": currency_exchange.tdx_c_compra
			})
		except:
			frappe.throw(_("Currency Exchange don't exist"))
