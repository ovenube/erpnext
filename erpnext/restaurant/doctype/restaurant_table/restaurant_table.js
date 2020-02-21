// Copyright (c) 2017, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on('Restaurant Table', {
	refresh: function(frm) {

	},

	setup: function(frm) {
		frm.set_query("floor", function() {
			return {
				filters: {
					"restaurant": frm.doc.restaurant
				}
			};
		});
	}
});
