// Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt
frappe.provide("projects.rango_perforado")

frappe.ui.form.on('Rango Perforado', {
	refresh: function(frm) {

	}
});

frappe.ui.form.on("Rango Perforado", 'desde', function(frm, cdt, cdn) {
	projects.rango_perforado.check_mandatory_to_set_name(frm, cdt, cdn);
});

frappe.ui.form.on("Rango Perforado", 'hasta', function(frm, cdt, cdn) {
	projects.rango_perforado.check_mandatory_to_set_name(frm, cdt, cdn);
});

projects.rango_perforado.check_mandatory_to_set_name = function(frm, cdt, cdn) {
	if (frm.doc.desde !== undefined && frm.doc.hasta !== undefined){
		if (frm.doc.desde < frm.doc.hasta){
			frappe.model.set_value(cdt, cdn, "nombre", frm.doc.desde + "-" + frm.doc.hasta);
		}
		else {
			frappe.throw("El valor de Hasta debe ser mayor que Desde");
			frappe.model.set_value(cdt, cdn, "hasta", "");
		}
	}
};