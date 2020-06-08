// Copyright (c) 2020, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on('Educational Material Print', {
	// refresh: function(frm) {

	// }
	material_book_unit_1: function(frm, cdt, cdn) {
		if (frm.doc.material_book_unit_1) {
			frappe.call({
				method: "erpnext.education.doctype.educational_material_print.educational_material_print.get_educational_material_thumbnails",
				args: {
					"url": frm.doc.material_book_unit_1.replace("pdf", "thumbnails")
				},
				callback: function(r) {
					if (r.message) {
						cur_frm.clear_table("material_book_unit_1_thumbnails");
						frm.refresh_fields();
						var d = r.message;
						d.images.forEach(image => {
							var c = frm.add_child("material_book_unit_1_thumbnails");
							c.image_name = image;
							c.image = '<img src="' + frm.doc.material_book_unit_1.replace("pdf", "static/thumbnails").replace(d.nombre_archivo, image) + '">';
							debugger;
							var img = c.image;
						}); 
						frm.refresh_fields();
					}
				}
			})
		}
	},

	material_book_unit_2: function(frm, cdt, cdn) {
		if (frm.doc.material_book_unit_2) {
			frappe.call({
				method: "erpnext.education.doctype.educational_material_print.educational_material_print.get_educational_material_thumbnails",
				args: {
					"url": frm.doc.material_book_unit_2.replace("pdf", "thumbnails")
				},
				callback: function(r) {
					if (r.message) {
						var d = r.message;
						d.images.forEach(image => {
							var c = frm.add_child("material_book_unit_2_thumbnails");
							c.image_name = image;
							c.image = frm.doc.material_book_unit_2.replace("pdf", "static/thumbnails").replace(d.nombre_archivo, image);
						}); 
						frm.refresh_fields();
					}
				}
			})
		}
	},

	material_book_unit_3: function(frm, cdt, cdn) {
		if (frm.doc.material_book_unit_3) {
			frappe.call({
				method: "erpnext.education.doctype.educational_material_print.educational_material_print.get_educational_material_thumbnails",
				args: {
					"url": frm.doc.material_book_unit_3.replace("pdf", "thumbnails")
				},
				callback: function(r) {
					if (r.message) {
						var d = r.message;
						d.images.forEach(image => {
							var c = frm.add_child("material_book_unit_3_thumbnails");
							c.image_name = image;
							c.image = frm.doc.material_book_unit_3.replace("pdf", "static/thumbnails").replace(d.nombre_archivo, image);
						}); 
						frm.refresh_fields();
					}
				}
			})
		}
	},

	material_book_unit_4: function(frm, cdt, cdn) {
		if (frm.doc.material_book_unit_4) {
			frappe.call({
				method: "erpnext.education.doctype.educational_material_print.educational_material_print.get_educational_material_thumbnails",
				args: {
					"url": frm.doc.material_book_unit_4.replace("pdf", "thumbnails")
				},
				callback: function(r) {
					if (r.message) {
						var d = r.message;
						d.images.forEach(image => {
							var c = frm.add_child("material_book_unit_4_thumbnails");
							c.image_name = image;
							c.image = frm.doc.material_book_unit_4.replace("pdf", "static/thumbnails").replace(d.nombre_archivo, image);
						}); 
						frm.refresh_fields();
					}
				}
			})
		}
	},

	material_book_unit_5: function(frm, cdt, cdn) {
		if (frm.doc.material_book_unit_5) {
			frappe.call({
				method: "erpnext.education.doctype.educational_material_print.educational_material_print.get_educational_material_thumbnails",
				args: {
					"url": frm.doc.material_book_unit_5.replace("pdf", "thumbnails")
				},
				callback: function(r) {
					if (r.message) {
						var d = r.message;
						d.images.forEach(image => {
							var c = frm.add_child("material_book_unit_5_thumbnails");
							c.image_name = image;
							c.image = frm.doc.material_book_unit_5.replace("pdf", "static/thumbnails").replace(d.nombre_archivo, image);
						}); 
						frm.refresh_fields();
					}
				}
			})
		}
	},

	material_book_unit_6: function(frm, cdt, cdn) {
		if (frm.doc.material_book_unit_6) {
			frappe.call({
				method: "erpnext.education.doctype.educational_material_print.educational_material_print.get_educational_material_thumbnails",
				args: {
					"url": frm.doc.material_book_unit_6.replace("pdf", "thumbnails")
				},
				callback: function(r) {
					if (r.message) {
						var d = r.message;
						d.images.forEach(image => {
							var c = frm.add_child("material_book_unit_6_thumbnails");
							c.image_name = image;
							c.image = frm.doc.material_book_unit_6.replace("pdf", "static/thumbnails").replace(d.nombre_archivo, image);
						}); 
						frm.refresh_fields();
					}
				}
			})
		}
	},

	material_book_unit_7: function(frm, cdt, cdn) {
		if (frm.doc.material_book_unit_7) {
			frappe.call({
				method: "erpnext.education.doctype.educational_material_print.educational_material_print.get_educational_material_thumbnails",
				args: {
					"url": frm.doc.material_book_unit_7.replace("pdf", "thumbnails")
				},
				callback: function(r) {
					if (r.message) {
						var d = r.message;
						d.images.forEach(image => {
							var c = frm.add_child("material_book_unit_7_thumbnails");
							c.image_name = image;
							c.image = frm.doc.material_book_unit_7.replace("pdf", "static/thumbnails").replace(d.nombre_archivo, image);
						}); 
						frm.refresh_fields();
					}
				}
			})
		}
	},

	material_book_unit_8: function(frm, cdt, cdn) {
		if (frm.doc.material_book_unit_8) {
			frappe.call({
				method: "erpnext.education.doctype.educational_material_print.educational_material_print.get_educational_material_thumbnails",
				args: {
					"url": frm.doc.material_book_unit_8.replace("pdf", "thumbnails")
				},
				callback: function(r) {
					if (r.message) {
						var d = r.message;
						d.images.forEach(image => {
							var c = frm.add_child("material_book_unit_8_thumbnails");
							c.image_name = image;
							c.image = frm.doc.material_book_unit_8.replace("pdf", "static/thumbnails").replace(d.nombre_archivo, image);
						}); 
						frm.refresh_fields();
					}
				}
			})
		}
	},

	material_book_unit_9: function(frm, cdt, cdn) {
		if (frm.doc.material_book_unit_9) {
			frappe.call({
				method: "erpnext.education.doctype.educational_material_print.educational_material_print.get_educational_material_thumbnails",
				args: {
					"url": frm.doc.material_book_unit_9.replace("pdf", "thumbnails")
				},
				callback: function(r) {
					if (r.message) {
						var d = r.message;
						d.images.forEach(image => {
							var c = frm.add_child("material_book_unit_9_thumbnails");
							c.image_name = image;
							c.image = frm.doc.material_book_unit_9.replace("pdf", "static/thumbnails").replace(d.nombre_archivo, image);
						}); 
						frm.refresh_fields();
					}
				}
			})
		}
	},

	material_book_unit_10: function(frm, cdt, cdn) {
		if (frm.doc.material_book_unit_10) {
			frappe.call({
				method: "erpnext.education.doctype.educational_material_print.educational_material_print.get_educational_material_thumbnails",
				args: {
					"url": frm.doc.material_book_unit_10.replace("pdf", "thumbnails")
				},
				callback: function(r) {
					if (r.message) {
						var d = r.message;
						d.images.forEach(image => {
							var c = frm.add_child("material_book_unit_10_thumbnails");
							c.image_name = image;
							c.image = frm.doc.material_book_unit_10.replace("pdf", "static/thumbnails").replace(d.nombre_archivo, image);
						}); 
						frm.refresh_fields();
					}
				}
			})
		}
	},

	material_reader: function(frm, cdt, cdn) {
		if (frm.doc.material_reader) {
			frappe.call({
				method: "erpnext.education.doctype.educational_material_print.educational_material_print.get_educational_material_thumbnails",
				args: {
					"url": frm.doc.material_reader.replace("pdf", "thumbnails")
				},
				callback: function(r) {
					if (r.message) {
						var d = r.message;
						d.images.forEach(image => {
							var c = frm.add_child("material_reader_thumbnails");
							c.image_name = image;
							c.image = frm.doc.material_reader.replace("pdf", "static/thumbnails").replace(d.nombre_archivo, image);
						}); 
						frm.refresh_fields();
					}
				}
			})
		}
	}
});
