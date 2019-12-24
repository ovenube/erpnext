// Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

cur_frm.add_fetch('producto', 'item_name', 'nombre_producto');
cur_frm.add_fetch('producto', 'description', 'descripcion_producto');
cur_frm.add_fetch('producto', 'item_group', 'grupo');

frappe.ui.form.on('Catalogo Proyecto', {
	refresh: function(frm) {

	}
});
