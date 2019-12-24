# -*- coding: utf-8 -*-
# Copyright (c) 2019, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe, json
from frappe.utils import flt
from frappe.model.document import Document
from erpnext.controllers.accounts_controller import AccountsController
from frappe import _, throw

class MassivePaymentTool(Document):
	def __init__(self, *args, **kwargs):
		gain_account = loss_account = ""
		accounts_settings = frappe.get_doc("Accounts Settings", "Accounts Settings")
		for account in accounts_settings.exchange_difference_accounts:
			if account.account_type == "Gain" and account.currency == "USD":
				self.gain_account = account.account
			elif account.account_type == "Loss" and account.currency == "USD":
				self.loss_account = account.account
		self.exchange_difference_cost_center = accounts_settings.exchange_difference_cost_center
		return super(MassivePaymentTool, self).__init__(*args, **kwargs)

	def before_submit(self):
		try:
			self.make_journal_entry()
			self.process_employee_advance()
			self.make_payment_entries()
			self.process_detraction()
			self.submit_journal_entry()
		except:
			self.make_journal_entry(cancel=1)
			throw(_("Error while validating Massive Payment Tool"))

	def before_cancel(self):
		try:
			self.make_journal_entry(cancel=1)
			self.process_employee_advance(cancel=1)
			self.make_payment_entries(cancel=1)
			self.process_detraction(cancel=1)
			self.submit_journal_entry(cancel=1)			
		except:
			throw(_("Error while canceling Massive Payment Tool"))

	def make_journal_entry(self, cancel=0):
		allocated_amount = 0.0
		if self.payment_type == "Petty Cash" or self.payment_type == "Down Payment":
			document = {
				"doctype": "Journal Entry",
				"voucher_type": "Journal Entry",
				"posting_date": self.posting_date,
				"cheque_no": self.cheque_no,
				"cheque_date": self.cheque_date,
				"total_debit": self.total_allocated_amount,
				"total_credit": self.total_allocated_amount,
			}
			document['accounts'] = []
			for detail in self.get('details'):
				if detail.detail_doctype == "Purchase Invoice":
					allocated_amount += detail.total_amount
					document['accounts'].append({
						"account": detail.account,
						"party_type": detail.party_type,
						"party": detail.party,
						"debit_in_account_currency": detail.total_amount if detail.currency != "USD" else detail.exchange_amount,
						"original_amount_debit": detail.grand_total if detail.currency == "USD" else 0.0,
						"conversion_rate": self.conversion_rate if detail.currency == "USD" else 0.0,
						"reference_type": detail.detail_doctype,
						"reference_name": detail.detail_name
					})
					if detail.currency == "USD":
						document['accounts'].append({
							"account": self.loss_account if detail.exchange_difference > 0 else self.gain_account,
							"debit_in_account_currency": detail.exchange_difference if detail.exchange_difference > 0 else 0.0,
							"credit_in_account_currency": (detail.exchange_difference * -1) if detail.exchange_difference < 0 else 0.0,
							"cost_center": self.exchange_difference_cost_center,
						})
				elif detail.detail_doctype == "Expense Claim":
					allocated_amount += detail.total_amount
					document['accounts'].append({
						"account": detail.account,
						"party_type": detail.party_type,
						"party": detail.party,
						"debit_in_account_currency": detail.total_amount,
						"original_amount_debit": detail.grand_total,
						"conversion_rate": 1,
						"reference_type": detail.detail_doctype,
						"reference_name": detail.detail_name
					})
			if self.get('references'):
				for reference in self.get('references'):
					employee_advance = frappe.get_doc(reference.reference_doctype, reference.reference_name)
					document['accounts'].append({
						"account": reference.account,
						"party_type": "Employee",
						"party": employee_advance.employee,
						"credit_in_account_currency": allocated_amount,
						"reference_type": reference.reference_doctype,
						"reference_name": reference.reference_name
					})
			journal_entry = frappe.get_doc(document)
			if cancel == 0:
				try:					
					journal_entry.insert()
				except:
					throw(_("Error while validating Journal Account"))
				else:
					journal_entry.submit()
			else:
				for journal_entry_name in self.find_journal_entries(allocated_amount):
					journal_entry = frappe.get_doc("Journal Entry", journal_entry_name)
					journal_entry.flags.ignore_links = True
					journal_entry.cancel()

	def make_payment_entries(self, cancel=0):
		payment_entry_names = []
		documents = []
		if self.references:
			for reference in self.get('references'):
				if reference.reference_doctype == "Purchase Invoice" or reference.reference_doctype == "Factoring":
					purchase_invoice = frappe.get_doc(reference.reference_doctype, reference.reference_name)
					document = {
						"party_type": "Supplier",
						"party": purchase_invoice.supplier,
						"paid_from": self.paid_from,
						"paid_to": reference.account,
						"paid_amount": reference.original_amount,
						"received_amount": reference.exchange_amount,
						"base_paid_amount": reference.allocated_amount,
						"source_exchange_rate": reference.conversion_rate,
					}
					document['references'] = {
						"reference_doctype": reference.reference_doctype,
						"reference_name": reference.reference_name,
						"bill_no": reference.bill_no,
						"total_amount": reference.total_amount,
						"outstanding_amount": reference.total_amount,
						"currency": reference.currency,
						"allocated_amount": reference.exchange_amount if reference.exchange_amount else reference.allocated_amount,
						"original_allocated_amount": reference.original_amount
					}
					if reference.exchange_difference and reference.currency == "USD":
						document['deductions'] = {
							"account": self.gain_account if reference.exchange_difference < 0 else self.loss_account,
							"cost_center": self.exchange_difference_cost_center,
							"amount": reference.exchange_difference
						}
					documents.append(document)
		if self.reconciliations:
			for reconciliation in self.get("reconciliations"):
				if reconciliation.reconciliation_doctype == "Employee Advance":
					if self.submit_employee_advance():
						document = {
							"party_type": reconciliation.party_type,
							"party": reconciliation.party,
							"paid_from": self.paid_from,
							"paid_to": reconciliation.account,
							"paid_amount": reconciliation.total_amount,
							"source_exchange_rate": reference.conversion_rate,
						}
						document['references'] = {
							"reference_doctype": reconciliation.reconciliation_doctype,
							"reference_name": reconciliation.reconciliation_name,
							"total_amount": reconciliation.total_amount,
							"outstanding_amount": reconciliation.total_amount,
							"allocated_amount": reconciliation.total_amount
						}
						documents.append(document)
		if documents:
			if cancel == 0:
				for document in documents:				
					payment_entry_names.append(self.make_payment_entry(document))	
			else:
				for payment_entry_name in self.find_payment_entries():
					payment_entry_names.append(payment_entry_name['name'])
		if payment_entry_names:
			self.submit_payment_entries(payment_entry_names, cancel)

	def find_payment_entries(self):
		payment_entries_names = frappe.get_all('Payment Entry', filters={
			'payment_type': 'Pay',
			'docstatus': 1,
			'posting_date': self.posting_date,
			'mode_of_payment': self.mode_of_payment,
			'reference_no': self.reference_no,
			'reference_date': self.reference_date
		}, fields=['name'])
		return payment_entries_names

	def find_journal_entries(self, allocated_amount):
		journal_entries_names = frappe.get_all('Journal Entry', filters={
			'voucher_type': 'Journal Entry',
			'docstatus': 1,
			'posting_date': self.posting_date,
			'total_debit': allocated_amount,
			'total_credit': allocated_amount
		}, fields=['name'])
		return journal_entries_names

	def make_payment_entry(self, document):
		if self.payment_type == "Detraction" or self.payment_type == "Purchase Invoice" or self.payment_type == "Factoring":
			if document.get('deductions'):
				payment_entry = frappe.get_doc({
					"doctype": "Payment Entry",
					"posting_date": self.posting_date,
					"payment_type": "Pay",
					"mode_of_payment": self.mode_of_payment,
					"party_type": document['party_type'],
					"party": document['party'],
					"paid_from": document['paid_from'],
					"paid_to": document['paid_to'],
					"paid_amount": document['paid_amount'],
					"received_amount": document['received_amount'] if document.get('received_amount') else document['paid_amount'],
					"source_exchange_rate": document.get('source_exchange_rate'),
					"reference_no": self.reference_no,
					"reference_date": self.reference_date,
					"references": [
						{
							"reference_doctype": document['references']['reference_doctype'],
							"reference_name": document['references']['reference_name'],
							"bill_no": document['references'].get('bill_no'),
							"total_amount": document['references']['total_amount'],
							"currency": document['references']['currency'],
							"outstanding_amount": document['references']['outstanding_amount'],
							"allocated_amount": document['references']['allocated_amount'],
							"original_allocated_amount": document['references']['original_allocated_amount']
						}
					],
					"deductions": [
						{
							"account": document['deductions']['account'],
							"cost_center": document['deductions']['cost_center'],
							"amount": document['deductions']['amount']
						}
					]
				})
			else:
				payment_entry = frappe.get_doc({
					"doctype": "Payment Entry",
					"posting_date": self.posting_date,
					"payment_type": "Pay",
					"mode_of_payment": self.mode_of_payment,
					"party_type": document['party_type'],
					"party": document['party'],
					"paid_from": document['paid_from'],
					"paid_to": document['paid_to'],
					"source_exchange_rate": document.get('source_exchange_rate'),
					"paid_amount": document['paid_amount'],
					"received_amount": document['paid_amount'],
					"reference_no": self.reference_no,
					"reference_date": self.reference_date,
					"references": [
						{
							"reference_doctype": document['references']['reference_doctype'],
							"reference_name": document['references']['reference_name'],
							"bill_no": document['references'].get('bill_no'),
							"total_amount": document['references']['total_amount'],
							"outstanding_amount": document['references']['outstanding_amount'],
							"allocated_amount": document['references']['allocated_amount']
						}
					]
				})
		else:
			payment_entry = frappe.get_doc({
				"doctype": "Payment Entry",
				"posting_date": self.posting_date,
				"payment_type": "Pay",
				"mode_of_payment": self.mode_of_payment,
				"party_type": document['party_type'],
				"party": document['party'],
				"paid_from": document['paid_from'],
				"paid_to": document['paid_to'],
				"source_exchange_rate": document.get('source_exchange_rate'),
				"paid_amount": document['paid_amount'],
				"received_amount": document['paid_amount'],
				"reference_no": self.reference_no,
				"reference_date": self.reference_date,
				"references": [
					{
						"reference_doctype": document['references']['reference_doctype'],
						"reference_name": document['references']['reference_name'],
						"bill_no": document['references'].get('bill_no'),
						"total_amount": document['references']['total_amount'],
						"outstanding_amount": document['references']['outstanding_amount'],
						"allocated_amount": document['references']['allocated_amount']
					}
				]
			})
		try:
			payment_entry.insert()			
		except:
			throw(_("Error while validating Payment Entry"))
		else:
			return payment_entry.name	

	def submit_payment_entries(self, payment_entry_names, cancel=0):
		for payment_entry_name in payment_entry_names:
			payment_entry = frappe.get_doc("Payment Entry", payment_entry_name)
			if cancel == 0:				
				payment_entry.submit()
			else:
				payment_entry.cancel()

	def submit_employee_advance(self, cancel=0):
		if self.reconciliations:
			for reconciliation in self.get('reconciliations'):
				if reconciliation.reconciliation_doctype == "Employee Advance":
					rec_doc = frappe.get_all("Employee Advance", filters={
						"employee": reconciliation.party,
						"purpose": self.purpose,
						"advance_amount": reconciliation.total_amount,
						"advance_account": self.advance_account,
						"mode_of_payment": reconciliation.mode_of_payment,
						"docstatus": 0
					}, fields=["name"])
					if rec_doc:
						reconciliation_doc = frappe.get_doc("Employee Advance", rec_doc[0].name)
						if cancel == 0:
							reconciliation_doc.submit()
							return reconciliation_doc.name
						else:
							reconciliation_doc.cancel()

	def submit_journal_entry(self, cancel=0, journal_entry_name=""):
		if self.reconciliations:
			for reconciliation in self.get("reconciliations"):
				if reconciliation.reconciliation_doctype == "Journal Entry":
					journal_entry = frappe.get_doc("Journal Entry", reconciliation.reconciliation_name)
					if cancel == 0:
						journal_entry.submit()
					else:
						journal_entry.flags.ignore_links = True
						journal_entry.cancel()
	
	def get_paid_to_account_reference(self):
		if self.references:
			for reference in self.get("references"):
				if reference.idx == 1:
					return reference.account

	def process_detraction(self, cancel=0):
		if self.detractions and self.payment_type == "Detraction":
			for detraction in self.get("detractions"):
				frappe.db.sql(
                    """UPDATE `tab{0}` SET tdx_c_figv_fechaconstancia={1}, tdx_c_figv_constancia={2} WHERE parent='{3}' AND tdx_c_figv_codigo='{4}'""".format("Fiscalizacion del IGV Compra", 
					"'" + detraction.detraction_date + "'" if cancel==0 else "NULL", 
					"'" + detraction.detraction_record + "'" if cancel==0 else "NULL", 
					detraction.detraction_invoice,
					detraction.detraction_type))
				frappe.db.commit()

	def process_employee_advance(self, cancel=0):
		if self.payment_type == "Down Payment" or self.payment_type == "Petty Cash":
			if self.references:
				for reference in self.get('references'):
					if reference.idx == 1:
						frappe.db.sql(
						"""UPDATE `tab{0}` SET is_processed='{1}' WHERE name='{2}'""".format(reference.reference_doctype, '1' if cancel==0 else '0', reference.reference_name))
						frappe.db.commit()

@frappe.whitelist()
def get_reference_details(reference_doctype, reference_name, conversion_rate=0):
	ref_doc = frappe.get_doc(reference_doctype, reference_name)
	if reference_doctype == "Employee Advance":
		total_amount = ref_doc.advance_amount
		outstanding_amount = ref_doc.advance_amount - flt(ref_doc.paid_amount)
		account = ref_doc.get("advance_account")
		return frappe._dict({
			"due_date": ref_doc.get("due_date"),
			"total_amount": total_amount,
			"outstanding_amount": outstanding_amount,
			"account": account
		})
	elif reference_doctype == "Purchase Invoice":
		bill_no = (ref_doc.get("bill_series") + "-" if ref_doc.get("bill_series") else "")  + ref_doc.get("bill_no")
		return frappe._dict({
			"due_date": ref_doc.bill_date,
			"account": ref_doc.credit_to,
			"bill_no": bill_no,
			"grand_total": ref_doc.grand_total if ref_doc.currency == "USD" else "",
			"currency": ref_doc.currency,
			"total_amount": ref_doc.base_grand_total,
			"outstanding_amount": ref_doc.outstanding_amount,
			"exchange_rate": ref_doc.exchange_rate_monthly_closing if ref_doc.exchange_rate_monthly_closing else ref_doc.conversion_rate,
			"conversion_rate": conversion_rate if ref_doc.currency=="USD" else 1
		})

@frappe.whitelist()
def invoice_filter(doctype, txt, searchfield, start, page_len, filters):
	invoice_items_sql = """
		SELECT pi.name, pi.supplier, pi.supplier_name
		FROM `tabPurchase Invoice` as pi,
		`tabFiscalizacion del IGV Compra` as dc
		WHERE pi.name = dc.parent
		AND pi.tdx_c_checkspot = "{spot}"
		AND pi.status in ('{status}')
		AND dc.tdx_c_figv_fechaconstancia IS NULL
		AND dc.tdx_c_figv_constancia IS NULL
		AND (pi.supplier_name LIKE "%{txt}%"
			OR pi.supplier LIKE "%{txt}%"
			OR pi.name LIKE "%{txt}%")
		""".format(
		spot=filters["tdx_c_checkspot"],
		status="','".join(filters["status"]),
		txt=txt)
	return frappe.db.sql(invoice_items_sql)

@frappe.whitelist()
def get_document_details(detail_doctype, detail_name, conversion_rate):
	bill_no = account = currency = ""
	grand_total = exchange_rate = exchange_amount = exchange_difference = 0.0
	det_doc = frappe.get_doc(detail_doctype, detail_name)
	if detail_doctype == "Purchase Invoice":
		grand_total = det_doc.grand_total
		due_date = det_doc.get("bill_date")
		bill_no = (det_doc.get("bill_series") + "-" if det_doc.get("bill_series") else "")  + det_doc.get("bill_no")
		party_type = "Supplier"
		party = det_doc.supplier
		account = det_doc.credit_to
		currency = det_doc.currency
		exchange_rate = round(det_doc.conversion_rate, 4) if currency == "USD" else 0.0
		conversion_rate = float(conversion_rate) if currency == "USD" else 0.0
		exchange_amount = round(exchange_rate * grand_total, 4) if currency == "USD" else 0.0
		total_amount = round(conversion_rate * grand_total, 4) if currency == "USD" else det_doc.grand_total
		exchange_difference = round(total_amount - exchange_amount, 4) if currency == "USD" else 0.0
	elif detail_doctype == "Expense Claim":
		due_date = det_doc.get("posting_date")
		party_type = "Employee"
		party = det_doc.employee
		account = det_doc.payable_account
		total_amount = det_doc.total_claimed_amount

	return frappe._dict({
		"bill_no": bill_no,
		"due_date": due_date,
		"party_type": party_type,
		"party": party,
		"total_amount": total_amount,
		"grand_total": grand_total,
		"account": account,
		"currency": currency,
		"exchange_rate": exchange_rate,
		"conversion_rate": conversion_rate,
		"exchange_amount": exchange_amount,
		"exchange_difference": exchange_difference
	})

@frappe.whitelist()
def get_detraction_details(reference_doctype, reference_name):
	ref_doc = frappe.get_doc(reference_doctype, reference_name)
	if ref_doc.tdx_c_checkspot:
		detraction = ref_doc.get("tdx_c_spot")[0]
		return frappe._dict({
			"detraction_type": detraction.tdx_c_figv_codigo,
			"detraction_name": detraction.tdx_c_figv_nombre,
			"detraction_description": detraction.tdx_c_figv_ddetraccion,
			"detraction_perception": detraction.tdx_c_figv_dpercepcion,
			"detraction_percentage": detraction.tdx_c_figv_porcentaje,
			"detraction_amount": detraction.tdx_c_figv_monto,
		})

@frappe.whitelist()
def create_reconciliation(args):
	reconciliation = frappe._dict()
	if isinstance(args, basestring):
		args = json.loads(args)
	
	if args.get("doctype") == "Employee Advance":
		reconciliation = create_reconciliation_employee_advance(args)
	elif args.get("doctype") == "Journal Entry":
		reconciliation = create_reconciliation_journal_entry(args)
	return reconciliation

def create_reconciliation_employee_advance(args):
	if not args.get('employee'):
		employee = frappe.get_doc(args.get('reference_doctype'), args.get('reference_name'))
		args['employee'] = employee.get('employee')
	employee_advance = frappe.get_all(args.get("doctype"), filters={
		"employee": args.get("employee"),
		"purpose": args.get("purpose"),
		"advance_amount": args.get("advance_amount"),
		"advance_account": args.get("advance_account"),
		"mode_of_payment": args.get("mode_of_payment")
	}, fields=["name", "employee", "purpose", "advance_amount", "advance_account", "mode_of_payment", "posting_date"])
	if not employee_advance:
		employee_advance = frappe.get_doc({
			"doctype": args.get("doctype"),
			"employee": args.get("employee"),
			"purpose": args.get("purpose"),
			"advance_amount": args.get("advance_amount"),
			"advance_account": args.get("advance_account"),
			"mode_of_payment": args.get("mode_of_payment"),
			"is_petty_cash": 1 if args.get("payment_type") == "Petty Cash" else 0,
			"is_processed": 1
		})
		employee_advance.insert()
	else:
		employee_advance = employee_advance[0]
		
	return frappe._dict({
		"reconciliation_doctype": employee_advance.doctype,
		"reconciliation_name": employee_advance.name,
		"party_type": "Employee",
		"party": employee_advance.employee,
		"purpose": employee_advance.purpose,
		"total_amount": employee_advance.advance_amount,
		"advance_account": employee_advance.advance_account,
		"mode_of_payment": employee_advance.mode_of_payment,
		"due_date": employee_advance.posting_date
	})

def create_reconciliation_journal_entry(args):
	journal_entry = frappe.get_all(args.get("doctype"), filters={
		"company": args.get("company"),
		"posting_date": args.get("posting_date"),
		"cheque_no": args.get("cheque_no"),
		"cheque_date": args.get("cheque_date"),
		"total_debit": args.get("total_debit"),
		"total_credit": args.get("total_credit")
	}, fields=["voucher_type", "name", "company", "posting_date", "cheque_no", "cheque_date", "total_debit", "total_credit"])
	if not journal_entry:
		journal_entry = frappe.get_doc({
			"doctype": args.get("doctype"),
			"posting_date": args.get("posting_date"),
			"cheque_no": args.get("cheque_no"),
			"cheque_date": args.get("cheque_date"),
			"total_debit": args.get("total_debit"),
			"total_credit": args.get("total_credit"),
			"accounts": [
				{
					"account": args.get("paid_from"),
					"debit_in_account_currency": args.get("difference_amount"),
					"reference_type": args.get("reference_doctype"),
					"reference_name": args.get("reference_name")
				},
				{
					"account": args.get("advance_account"),
					"party_type": args.get("party_type"),
					"party": args.get("party"),
					"credit_in_account_currency": args.get("difference_amount"),
					"reference_type": args.get("reference_doctype"),
					"reference_name": args.get("reference_name")
				}
			]
		})
		journal_entry.insert()
	else:
		journal_entry = journal_entry[0]
		
	return frappe._dict({
		"reconciliation_doctype": journal_entry.voucher_type,
		"reconciliation_name": journal_entry.name,
		"party_type": "Company",
		"party": journal_entry.company,
		"cheque_no": journal_entry.cheque_no,
		"cheque_date": journal_entry.cheque_date,
		"total_credit": journal_entry.total_credit,
		"total_debit": journal_entry.total_debit,
		"due_date": journal_entry.posting_date
	})