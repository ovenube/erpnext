// Copyright (c) 2020, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on('Restaurant Order', {
	// refresh: function(frm) {

	// }
});

frappe.ui.form.on("Restaurant Order Item", {
	served_qty: function(frm, cdt, cdn) {
		var served_qty = 0;
		$.each(locals[cdt], function(key, item) {
			if (item.served_qty) {
				served_qty += item.served_qty;
			}
		});
		frm.set_value("served_qty", served_qty);
		if (served_qty == frm.doc.total_qty){
			frm.set_value("order_status", "Attended");
		}
		frm.refresh_fields();
	}
})