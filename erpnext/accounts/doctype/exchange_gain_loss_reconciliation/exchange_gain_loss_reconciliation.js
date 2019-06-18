// Copyright (c) 2019, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on('Exchange Gain Loss Reconciliation', {
	refresh: function(frm) {

	},

	year: function(frm, cdt, cdn) {
		frm.events.set_period(frm, cdt, cdn);
	},

	month: function(frm, cdt, cdn) {
		frm.events.set_period(frm, cdt, cdn);
	},

	conversion_rate_sales: function(frm) {
		frm.events.get_period_invoices(frm);
	},

	conversion_rate_purchase: function(frm) {
		frm.events.get_period_invoices(frm);
	},

	set_period: function(frm, cdt, cdn){
		if(frm.doc.year && frm.doc.month){
			frappe.model.set_value(cdt, cdn, "period", frm.doc.month + "-" + frm.doc.year);
			frappe.call({
				method: "get_posting_date",
				doc: frm.doc,
				args: {
					"year": frm.doc.year,
					"month": frm.doc.month
				},
				callback: function(r, rt) {
					if (r.message) {
						frm.set_value("posting_date", r.message);
					}
				}
			});
		}
	},

	posting_date: function(frm, cdt, cdn) {
		if (frm.doc.posting_date) {
			frm.events.get_exchange_rate(frm, cdt, cdn);
		}
	},

	get_period_invoices: function(frm){
		if(frm.doc.conversion_rate_sales && frm.doc.conversion_rate_purchase){
			frm.clear_table("references");
			frappe.call({
				method: "get_period_invoices",
				doc: frm.doc,
				args: {
					"year": frm.doc.year,
					"month": frm.doc.month
				},
				callback: function(r, rt){
					if (r.message){
						$.each(r.message, function(i, invoice) {
							var c = frm.add_child("references");
							c.reference_doctype = invoice.reference_doctype;
							c.reference_name = invoice.reference_name;
							c.due_date = invoice.due_date;
							c.account = invoice.account;
							c.bill_no = invoice.bill_no;
							c.grand_total = invoice.grand_total;
							c.currency = invoice.currency;
							c.exchange_rate = invoice.exchange_rate;
							c.total_amount = invoice.total_amount;
							c.outstanding_amount = invoice.outstanding_amount;
							c.exchange_amount = invoice.outstanding_amount / invoice.exchange_rate;
							c.conversion_rate = invoice.conversion_rate;
							c.conversion_amount = c.exchange_amount * c.conversion_rate;
							c.exchange_difference = c.outstanding_amount - c.conversion_amount;
							frm.refresh_fields();
						});
					}
				}
			})
		}
	},

	get_exchange_rate: function(frm, cdt, cdn) {
		frappe.call({
			method: "get_exchange_rate",
			doc: frm.doc,
			args: {
				"transaction_date": frm.doc.posting_date,
				"from_currency": "USD",
				"to_currency": "PEN"
			},
			callback: function(r) {
				if(r.message){
					$.each(r.message, function(field, value) {
						frappe.model.set_value(cdt, cdn, field, value);
					});
					frm.refresh_fields();
				}
			}
		});
	},
});
