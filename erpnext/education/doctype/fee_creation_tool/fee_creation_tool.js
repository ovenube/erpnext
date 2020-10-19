// Copyright (c) 2020, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt
frappe.ui.form.on('Fee Creation Tool', {
	setup: function(frm) {
		frm.add_fetch("fee_structure", "receivable_account", "receivable_account");
		frm.add_fetch("fee_structure", "income_account", "income_account");
		frm.add_fetch("fee_structure", "cost_center", "cost_center");
	},

	onload: function(frm) {
		frm.set_query("receivable_account", function(doc) {
			return {
				filters: {
					'account_type': 'Receivable',
					'is_group': 0,
					'company': doc.company
				}
			};
		});
		frm.set_query("income_account", function(doc) {
			return {
				filters: {
					'account_type': 'Income Account',
					'is_group': 0,
					'company': doc.company
				}
			};
		});
	},

	student_group: function(frm) {
		frm.clear_table('students');
		if (frm.doc.student_group != undefined){
			frappe.db.get_doc("Student Group", frm.doc.student_group).then(doc => {
				doc.students.forEach(student => {
					if (student.fee_created == 0){
						var c = frm.add_child('students');
						c.student = student.student;
						c.student_name = student.student_name;
						c.group_roll_number = student.group_roll_number;
						c.active = student.active;
						c.fee_created = student.fee_created;
					}
				});
				refresh_field('students');
			})
		}
	},

	fee_structure: function(frm) {
		frm.clear_table('components');
		if (frm.doc.fee_structure != undefined){
			frappe.db.get_doc("Fee Structure", frm.doc.fee_structure).then(doc => {
				doc.components.forEach(component => {
					var c = frm.add_child('components');
					c.fees_category = component.fees_category;
					c.description = component.description;
					c.amount = component.amount;
				});
				refresh_field('components');
			})
		}
	}
});

frappe.ui.form.on('Fee Component', {
	fees_category: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		frappe.db.get_value("Fee Category", row.fees_category, "is_course", (r) => {
			frappe.model.set_value(cdt, cdn, "is_course", r.is_course);
			frm.refresh_fields();
		})
	}
})