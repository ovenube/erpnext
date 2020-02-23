frappe.pages['table-board'].on_page_load = function(wrapper) {
	new TableBoard(wrapper);
};

TableBoard = Class.extend({
	init: function(wrapper) {
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: 'Table Board',
			single_column: true
		});

		const assets = [
			'assets/erpnext/css/table_board.css'
		];

		frappe.require(assets, () => {
			this.make();
		});
	},

	make: function() {
		return frappe.run_serially([
			() => $(frappe.render_template("table_board", this)).appendTo(this.page.main),
			() => this.load_floors(),
			() => this.load_tables()
		]);
	},

	load_floors: function() {
		frappe.db.get_list("Restaurant Floor", {fields: ["floor"]}).then((result) => {
			if (result == []){
				frappe.throw(__("Restaurant Floor is required to use Table Board"));
			} else {
				result.forEach(floor => {
					$('#floors').append($('<option>').val(floor.floor).text(floor.floor));
				});
			}
		});
	},

	load_tables: function() {
		var floors = document.getElementById("floors");
		floors.onchange = function(){
			$("#tables").empty();
			var selected_floor = floors.options[floors.selectedIndex].text;
			frappe.db.get_list("Restaurant Table", {filters: {floor: selected_floor}}).then((result) => {
				if (result == []){
					frappe.msgprint(__("Please add Restaurant Tables"));
				} else {
					result.forEach(table => {
						$('#tables').append(`
						<div class="col-sm-2 col-xs-4 tableList">
							<a href="#restaurant-pos/` + table.name.replace(" ", "%20") + `">
								<img src="assets/erpnext/images/table.svg" alt="store">
								<h2>`+ table.name + `</h2>
							</a>
						</div>`);
					});
				}
			});
		};
	},
});