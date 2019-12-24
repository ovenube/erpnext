// Copyright (c) 2019, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt
{% include "erpnext/public/js/controllers/accounts.js" %}

frappe.ui.form.on('Massive Payment Tool', {
	refresh: function(frm) {

	},

	setup: function(frm) {
		frm.set_query("reference_doctype", "references", function() {
			if (frm.doc.payment_type=="Detraction" || frm.doc.payment_type=="Purchase Invoice"  || frm.doc.payment_type=="Factoring"){
				var doctypes = ["Purchase Invoice"];
			} else {
				if (frm.doc.party_type=="Customer") {
					var doctypes = ["Sales Order", "Sales Invoice"];
				} else if (frm.doc.party_type=="Supplier") {
					var doctypes = ["Purchase Order", "Purchase Invoice"];
				} else if (frm.doc.party_type=="Employee" || frm.doc.party_type=="Account") {
					var doctypes = ["Employee Advance"];
				}
			}			
			return {
				filters: { "name": ["in", doctypes] }
			};
		});

		frm.set_query("detail_doctype", "details", function() {
			if (frm.doc.party_type=="Customer") {
				var doctypes = ["Sales Order", "Sales Invoice"];
			} else if (frm.doc.party_type=="Supplier") {
				var doctypes = ["Purchase Order", "Purchase Invoice"];
			} else if (frm.doc.party_type=="Employee" || frm.doc.party_type=="Account") {
				var doctypes = ["Purchase Invoice", "Expense Claim"];
			}
			return {
				filters: { "name": ["in", doctypes] }
			};
		});

		frm.set_query("party_type", function() {
			if (frm.doc.payment_type=="Down Payment") {
				var doctypes = ["Employee"];
			} else if (frm.doc.payment_type=="Petty Cash"){
				var doctypes = ["Account"];
			} else if (frm.doc.payment_type=="Detraction"){
				var doctypes = [];
			}

			return{
				filters: { "name": ["in", doctypes] }
			}
		});

		frm.set_query("reference_name", "references", function() {
			if (frm.doc.payment_type=="Down Payment"){
				return{
					filters: {
						"employee": ["in", frm.doc.party],
						"is_processed": "0"
					}
				}
			} else if (frm.doc.payment_type=="Petty Cash"){
				return{
					filters: {
						"is_petty_cash": "1",
						"is_processed": "0"
					}
				}
			} else if (frm.doc.payment_type=="Detraction"){
				return{
					query: "erpnext.accounts.doctype.massive_payment_tool.massive_payment_tool.invoice_filter",
					filters: {
						"tdx_c_checkspot": "1",
						"status": ["Overdue", "Unpaid"]						
					}
				}
			} else if (frm.doc.payment_type=="Purchase Invoice" || frm.doc.payment_type=="Factoring"){
				return{
					filters: {
						"status": ["in", ["Overdue", "Unpaid"]]
					}
				}
			}
		});

		frm.set_query("detail_name", "details", function(doc, cdt, cdn) {
			var row = locals[cdt][cdn];
			if (frm.doc.payment_type=="Down Payment"){
				if (row.detail_doctype=="Purchase Invoice"){
					return{
						filters: {
							"tdx_c_er": ["in", frm.doc.party],
							"tdx_c_mcajaer": "1",
							"status": ["in", ["Overdue", "Unpaid"]]
						}
					}
				} else {
					return{
						filters: {
							"employee": ["in", frm.doc.party],
							"status": "Unpaid"
						}
					}
				}
			} else if (frm.doc.payment_type=="Petty Cash"){
				if (row.detail_doctype=="Purchase Invoice"){
					return{
						filters: {
							"tdx_c_caja": ["in", frm.doc.party],
							"tdx_c_mcajaer": "1",
							"status": ["in", ["Overdue", "Unpaid"]]
						}
					}
				} else {
					return{
						filters: {
							"is_petty_cash": "1",
							"status": "Unpaid"
						}
					}
				}
			}			
		});
	},

	posting_date: function(frm) {
		if (!frm.doc.posting_date) return;
		frappe.call({
			method:"frappe.client.get_value",
			args: {
				doctype: "Company",
				filters: {
					name: frm.doc.company
				},
				fieldname: ["default_currency"]
			},
			callback: function (r, rt){
				if (r.message){
					frappe.run_serially([
						() => {
							return frappe.call({
								method: "erpnext.setup.utils.get_exchange_rate",
								args: {
									transaction_date: frm.doc.posting_date,
									from_currency: "USD",
									to_currency: r.message.default_currency
								},
								callback: function(r) {
									frm.set_value("conversion_rate", flt(r.message));;
								}
							});
						}
					]);	
				}							
			}
		})	
	},

	mode_of_payment: function(frm) {
		get_payment_mode_account(frm, frm.doc.mode_of_payment, function(account){
			var payment_account_field = "paid_from";
			frm.set_value(payment_account_field, account);
		})
	},

	payment_type: function(frm) {
		frm.clear_table("references");
		frm.clear_table("details");
		frm.clear_table("reconciliations");
		frm.refresh_fields();
		$.each(["party", "party_type", "total_allocated_amount", "difference_allocated_amount", 
		"total_unallocated_amount", "purpose", "cheque_no", "advance_account", "cheque_date"], 
		function(i, field) {
			frm.set_value(field, null);
		});
	},

	party: function(frm) {
		frm.clear_table("references");
		frm.clear_table("details");
		frm.clear_table("reconciliations");
		if(frm.doc.payment_type && frm.doc.party_type && frm.doc.party) {
			if(!frm.doc.posting_date) {
				frappe.msgprint(__("Please select Posting Date before selecting Party"))
				frm.set_value("party", "");
				return ;
			}
			return frappe.call({
				method: "erpnext.accounts.doctype.payment_entry.payment_entry.get_party_details",
				args: {
					company: frm.doc.company,
					party_type: frm.doc.party_type,
					party: frm.doc.party,
					date: frm.doc.posting_date
				},
				callback: function(r, rt) {
					if(r.message) {
						frappe.run_serially([
							() => frm.set_value("party_name", r.message.party_name),
						]);
					}
				}
			});
		}
		frm.refresh_fields();
	},

	paid_from: function(frm) {
		frm.events.set_account_currency_and_balance(frm, frm.doc.paid_from,
			"paid_from_account_currency", "paid_from_account_balance", function(frm) {
				frm.events.paid_amount(frm);
			}
		);
	},

	set_account_currency_and_balance: function(frm, account, currency_field,
			balance_field, callback_function) {
		if (frm.doc.posting_date && account) {
			frappe.call({
				method: "erpnext.accounts.doctype.payment_entry.payment_entry.get_account_details",
				args: {
					"account": account,
					"date": frm.doc.posting_date
				},
				callback: function(r, rt) {
					if(r.message) {
						frappe.run_serially([
							() => frm.set_value(currency_field, r.message['account_currency']),
							() => frm.set_value(balance_field, r.message['account_balance'])							
						]);
					}
				}
			});			
		}
	},

	set_total_allocated_amount: function(frm) {
		var total_allocated_amount = 0.0;
		var difference_allocated_amount = 0.0;
		$.each(frm.doc.references, function(i, row) {
			if (row.allocated_amount) {
				total_allocated_amount += flt(row.allocated_amount);
				if (row.allocated_amount < row.total_amount){
					difference_allocated_amount += flt(row.total_amount - row.allocated_amount)
				}
			}
		});
		frm.set_value("total_allocated_amount", Math.abs(total_allocated_amount));
		frm.set_value("difference_allocated_amount", Math.abs(difference_allocated_amount));
		frm.refresh_fields();
	},

	set_total_amount: function(frm) {
		var total_amount = 0.0;
		$.each(frm.doc.references, function(i, row) {
			if (row.allocated_amount && row.currency!="USD") {
				total_amount += flt(row.allocated_amount);
			}
		});
		frm.set_value("total_amount", Math.abs(total_amount));
		frm.refresh_fields();
	},

	set_total_original_amount: function(frm) {
		var total_original_amount = 0.0;
		$.each(frm.doc.references, function(i, row) {
			if (row.original_amount && row.currency=="USD") {
				total_original_amount += flt(row.original_amount);
			}
		});
		frm.set_value("total_original_amount", Math.abs(total_original_amount));
		frm.refresh_fields();
	},

	set_total_unallocated_amount: function(frm) {
		var unallocated_amount = 0.0;
		$.each(frm.doc.references, function(i, row) {
			if (row.unallocated_amount) {
				unallocated_amount += flt(row.unallocated_amount);
			}
		});
		frm.set_value("total_unallocated_amount", Math.abs(unallocated_amount));
		frm.refresh_fields();
	},

	get_detraction_details: function(frm, cdt, cdn) {
		if (frm.doc.payment_type=="Detraction"){
			row = locals[cdt][cdn];
			frappe.call({
				method: "erpnext.accounts.doctype.massive_payment_tool.massive_payment_tool.get_detraction_details",
				args: {
					reference_doctype: row.reference_doctype,
					reference_name: row.reference_name,
				},
				callback: function(r, rt){
					if(r.message) {
						var c = frm.add_child("detractions");
						var d = r.message;
						c.detraction_type = d.detraction_type;
						c.detraction_name = d.detraction_name;
						c.detraction_description = d.detraction_description;
						c.detraction_perception = d.detraction_perception;
						c.detraction_percentage = d.detraction_percentage;
						c.detraction_amount = d.detraction_amount;
						c.detraction_date = frm.doc.detraction_date;
						c.detraction_record = frm.doc.detraction_record;
						c.detraction_invoice = row.reference_name;
						if(row.currency=="USD"){
							frappe.model.set_value(cdt, cdn, "original_amount", flt((row.grand_total * d.detraction_percentage / 100), 2));
							frappe.model.set_value(cdt, cdn, "exchange_amount", flt((row.original_amount * row.exchange_rate), 2));
						} else {
							frappe.model.set_value(cdt, cdn, "allocated_amount", flt(d.detraction_amount, 2));
							frappe.model.set_value(cdt, cdn, "original_amount", flt(d.detraction_amount, 2));
						}
						frm.refresh_fields();
					}
				}
			})
		}
	},
	
	write_off_difference_amount: function(frm, cdt, cdn) {
		frm.clear_table("reconciliations");

		if(frm.doc.total_unallocated_amount && frm.doc.purpose && frm.doc.advance_account){
			if(frm.doc.payment_type=="Down Payment"){
				var args = {
					"doctype": "Employee Advance",
					"employee": frm.doc.party,
					"purpose": frm.doc.purpose,
					"advance_amount": frm.doc.total_unallocated_amount,
					"advance_account": frm.doc.advance_account,
					"mode_of_payment": frm.doc.mode_of_payment,
				}
			} else {
				$.each(frm.doc.references, function(i, row) {
					if (row.idx == 1) {
						args = {
							"doctype": "Employee Advance",
							"reference_doctype": row.reference_doctype,
							"reference_name": row.reference_name,
							"purpose": frm.doc.purpose,
							"advance_amount": frm.doc.total_unallocated_amount,
							"advance_account": frm.doc.advance_account,
							"mode_of_payment": frm.doc.mode_of_payment,
							"payment_type": frm.doc.payment_type
						}
					}
				});
			}			
		} else if(frm.doc.difference_allocated_amount && frm.doc.cheque_no && frm.doc.cheque_date){
			$.each(frm.doc.references, function(i, row) {
				if (row.idx == 1) {
					args = {
						"doctype": "Journal Entry",
						"company": frm.doc.company,
						"posting_date": frm.doc.posting_date,
						"cheque_no": frm.doc.cheque_no,
						"cheque_date": frm.doc.cheque_date,
						"total_credit": frm.doc.difference_allocated_amount,
						"total_debit": frm.doc.difference_allocated_amount,
						"reference_doctype": row.reference_doctype,
						"reference_name": row.reference_name,
						"difference_amount": frm.doc.difference_allocated_amount,
						"party_type": frm.doc.party_type,
						"party": frm.doc.party,
						"paid_from": frm.doc.paid_from,
						"advance_account": row.account
					}
				}
			});			
		}
		if (args){
			frappe.call({
				method: "erpnext.accounts.doctype.massive_payment_tool.massive_payment_tool.create_reconciliation",
				args: {
					args: args
				},
				callback: function(r){
					if(r.message){
						var c = frm.add_child("reconciliations");
						var d = r.message;
						c.reconciliation_doctype = d.reconciliation_doctype;
						c.reconciliation_name = d.reconciliation_name;
						c.party_type = d.party_type;
						c.party = d.party;
						c.purpose = d.purpose;
						c.total_amount = d.total_amount;
						c.account = d.advance_account;
						c.mode_of_payment = d.mode_of_payment;
						c.due_date = d.due_date;
						c.cheque_no = d.cheque_no;
						c.cheque_date = d.cheque_date;
						c.total_credit = d.total_credit;
						c.total_debit = d.total_debit;
						frm.refresh_fields();
					}					
				}
			})
		}	
	},
});

frappe.ui.form.on("Massive Payment Tool Reference", {
	reference_name: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if (row.reference_name && row.reference_doctype) {
			frappe.call({
				method: "erpnext.accounts.doctype.massive_payment_tool.massive_payment_tool.get_reference_details",
				args: {
					reference_doctype: row.reference_doctype,
					reference_name: row.reference_name,
					conversion_rate: frm.doc.conversion_rate
				},
				callback: function(r, rt) {
					if(r.message) {
						$.each(r.message, function(field, value) {
							frappe.model.set_value(cdt, cdn, field, value);
						});
						frm.refresh_fields();
						frm.events.get_detraction_details(frm, cdt, cdn);
					}
				}
			})
		}
	},

	allocated_amount: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if(frm.doc.payment_type=="Down Payment" || frm.doc.payment_type=="Petty Cash") {
			frm.events.set_total_allocated_amount(frm);
		} else if(row.currency!="USD"){
			frappe.model.set_value(cdt, cdn, "original_amount", row.allocated_amount);
			frm.events.set_total_amount(frm);
		}
	},

	unallocated_amount: function(frm) {
		if(frm.doc.payment_type=="Down Payment" || frm.doc.payment_type=="Petty Cash") {
			frm.events.set_total_unallocated_amount(frm);
		}
	},

	original_amount: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if (frm.doc.payment_type=="Detraction" || frm.doc.payment_type=="Purchase Invoice" && row.original_amount && row.currency=="USD") {
			frappe.model.set_value(cdt, cdn, "allocated_amount", flt((row.original_amount * row.conversion_rate), 2));
			frappe.model.set_value(cdt, cdn, "exchange_amount", flt((row.original_amount * row.exchange_rate), 2));
			frappe.model.set_value(cdt, cdn, "exchange_difference", flt((row.allocated_amount - row.exchange_amount), 2));
			frm.events.set_total_original_amount(frm);
			frm.refresh_fields();
		}
	},

	references_add: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if (frm.doc.payment_type == "Down Payment" || frm.doc.payment_type == "Petty Cash"){
			if (row.idx == 1){
				frm.get_field("references").grid.cannot_add_rows = true;
				frm.get_field("references").grid.only_sortable();
			}
		}
	},

	before_references_remove: function(frm, cdt, cdn){
		if (frm.doc.payment_type == "Detraction"){
			var row = locals[cdt][cdn];
			frm.get_field("detractions").grid.grid_rows[row.idx - 1].remove();
			frm.refresh_fields();
		}
	}
});

frappe.ui.form.on("Massive Payment Tool Detail", {
	detail_name: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if (row.detail_name && row.detail_doctype) {
			return frappe.call({
				method: "erpnext.accounts.doctype.massive_payment_tool.massive_payment_tool.get_document_details",
				args: {
					detail_doctype: row.detail_doctype,
					detail_name: row.detail_name,
					conversion_rate: frm.doc.conversion_rate
				},
				callback: function(r, rt) {
					if(r.message) {
						$.each(r.message, function(field, value) {
							frappe.model.set_value(cdt, cdn, field, value);
						})
						frm.refresh_fields();
					}
				}
			})
		}
	},

	total_amount: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		$.each(locals["Massive Payment Tool Reference"], function(key, reference){
			var allocated_amount = 0;
			if(reference.idx==1){
				$.each(locals[cdt], function(key, detail){
					if(detail.total_amount){
						allocated_amount += detail.total_amount;
					}
				})
				if(reference.total_amount < allocated_amount){							
					frappe.model.set_value("Massive Payment Tool Reference", reference.name, "unallocated_amount", flt((allocated_amount - reference.total_amount), 2));
					allocated_amount = reference.total_amount;
				}
				frappe.model.set_value("Massive Payment Tool Reference", reference.name, "allocated_amount", flt(allocated_amount, 2));
				frm.refresh_fields();	
			}
		});		
	}
});